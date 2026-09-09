import { NextResponse } from "next/server";
import { ensureSchema, query, queryOne } from "@/lib/db";
import { verifyPin, setSession, type Role } from "@/lib/auth";

type UserRow = {
  id: number;
  name: string;
  role: Role;
  pin_hash: string;
};

// กัน brute-force PIN โดยไม่เปิดช่องให้กลั่นแกล้ง (นับใน DB เพราะบน serverless
// เก็บตัวนับใน memory ไม่ได้ — แต่ละ request คนละ instance)
//
// ❗ ทำไมไม่ล็อก "ต่อผู้ใช้" อย่างเดียว: หน้า /login โชว์รายชื่อ + id ของทุกคน
// ใครก็ได้ที่ยังไม่ล็อกอินจึงยิง PIN ผิดคนละ 5 ครั้ง เพื่อล็อกพนักงานทั้งร้าน
// 15 นาที วนไปเรื่อย ๆ ได้ = พนักงานเบิกของไม่ได้ทั้งกะ
// จึงล็อกเป็น "คู่ (IP, ผู้ใช้)" แทน — คนร้ายล็อกได้แค่ต้นทางของตัวเอง
// ส่วนพนักงานที่ยืนอยู่หน้าร้าน (คนละ IP) ยังล็อกอินได้ตามปกติ
const MAX_FAILS = 5; // ต่อคู่ (IP, ผู้ใช้)
const LOCK_MINUTES = 15;

// ชั้นที่สอง: กัน IP เดียวไล่ล็อกทีละบัญชีจนครบทั้งหน่วยงาน
// ❗ ตั้งเพดานให้สูงพอ เพราะแม่บ้านทุกคนเบิกของจากที่ทำงานเดียวกัน = ออกเน็ตด้วย IP เดียวกัน
// ถ้าตั้งต่ำ คนกด PIN ผิดกันหลายคนในเช้าเดียวจะล็อกทั้งออฟฟิศ
// ตัวนับรีเซ็ตทุกครั้งที่ล็อกอิน "สำเร็จ" จาก IP นั้น — IP ของออฟฟิศที่มีคนใช้งานทั้งวัน
// จึงแทบไม่มีทางสะสมถึงเพดาน ส่วน IP ที่ยิงผิดรัว ๆ โดยไม่เคยสำเร็จเลยจะโดนบล็อก
const IP_MAX_FAILS = 30;

// บน Vercel ทั้ง x-real-ip และ x-forwarded-for ตั้งโดยแพลตฟอร์ม (เชื่อถือได้)
// x-real-ip เป็นค่าเดียวจึงกำกวมน้อยกว่า ใช้เป็นตัวแรก
// ตอน dev ไม่มี proxy จะไม่มี header — รวมเป็นถัง "unknown" ถังเดียว พอสำหรับ dev
function clientIp(req: Request): string {
  const real = req.headers.get("x-real-ip")?.trim();
  if (real) return real;
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

// อ่านเวลาปลดล็อกที่ยังไม่หมดอายุ (null = ไม่ได้ถูกล็อก)
async function lockedUntil(ip: string, userId: number): Promise<Date | null> {
  const row = await queryOne<{ locked_until: string }>(
    `select locked_until from login_throttle
     where ip = $1 and user_id = $2
       and locked_until is not null and locked_until > now()`,
    [ip, userId],
  );
  return row ? new Date(row.locked_until) : null;
}

// เพิ่มตัวนับ + ตั้งเวลาล็อกใน statement เดียว (atomic แม้ยิงพร้อมกันหลาย request)
// ถ้าเลยเวลาล็อกรอบก่อนมาแล้ว ให้เริ่มนับใหม่จาก 1 แทนสะสมต่อไปไม่รู้จบ
async function bumpFails(ip: string, userId: number, max: number) {
  await query(
    `insert into login_throttle (ip, user_id, fails, updated_at)
     values ($1, $2, 1, now())
     on conflict (ip, user_id) do update set
       fails = case when login_throttle.locked_until is not null
                     and login_throttle.locked_until <= now()
                    then 1 else login_throttle.fails + 1 end,
       locked_until = case
         when (case when login_throttle.locked_until is not null
                     and login_throttle.locked_until <= now()
                    then 1 else login_throttle.fails + 1 end) >= $3
         then now() + make_interval(mins => $4)
         else login_throttle.locked_until end,
       updated_at = now()`,
    [ip, userId, max, LOCK_MINUTES],
  );
}

function lockedResponse(until: Date) {
  const mins = Math.max(1, Math.ceil((until.getTime() - Date.now()) / 60_000));
  return NextResponse.json(
    { error: `ใส่ PIN ผิดหลายครั้ง — ล็อกชั่วคราว ลองใหม่ในอีก ${mins} นาที` },
    { status: 429 },
  );
}

// เข้าสู่ระบบด้วย userId + PIN (ไม่มี JWT/bcrypt — ใช้ scrypt + HMAC cookie)
export async function POST(req: Request) {
  try {
    let body: { userId?: number; pin?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "คำขอไม่ถูกต้อง" }, { status: 400 });
    }
    const userId = Number(body.userId);
    const pin = String(body.pin ?? "");
    if (!Number.isInteger(userId) || userId <= 0 || !pin) {
      return NextResponse.json(
        { error: "กรุณาเลือกชื่อและใส่ PIN" },
        { status: 400 },
      );
    }

    // ตาราง login_throttle ต้องมีก่อนใช้ (เผื่อยิง API ตรงโดยไม่ผ่านหน้า /login)
    // ensureSchema จำผลไว้ต่อ process จึงเสียแค่ครั้งแรกตอน cold start
    await ensureSchema();
    const ip = clientIp(req);

    // ❗ เช็คก่อนแตะ DB ฝั่งผู้ใช้ และต้องเช็คทั้งสองชั้นก่อน verify
    const ipLock = await lockedUntil(ip, 0);
    if (ipLock) {
      console.warn(`[login] 429: IP ถูกบล็อกชั่วคราว (ip=${ip})`);
      return NextResponse.json(
        { error: "พยายามเข้าสู่ระบบผิดหลายครั้งเกินไป ลองใหม่ในภายหลัง" },
        { status: 429 },
      );
    }
    const pairLock = await lockedUntil(ip, userId);
    if (pairLock) {
      console.warn(`[login] 429: ถูกล็อกชั่วคราว (userId=${userId}, ip=${ip})`);
      return lockedResponse(pairLock);
    }

    const user = await queryOne<UserRow>(
      `select id, name, role, pin_hash from users where id = $1 and active = true`,
      [userId],
    );

    // แยก log ให้เห็นสาเหตุจริง (ฝั่ง server) — ข้อความฝั่ง client แยกได้ไม่เสี่ยง
    // enumeration เพราะรายชื่อผู้ใช้แสดงบนหน้า login อยู่แล้ว (เลือกชื่อจากลิสต์)
    if (!user) {
      await bumpFails(ip, 0, IP_MAX_FAILS);
      console.warn(`[login] 401: ไม่พบผู้ใช้ที่ active (userId=${userId})`);
      return NextResponse.json({ error: "เข้าสู่ระบบไม่สำเร็จ" }, { status: 401 });
    }

    if (!verifyPin(pin, user.pin_hash)) {
      await bumpFails(ip, userId, MAX_FAILS); // คู่ (IP, ผู้ใช้)
      await bumpFails(ip, 0, IP_MAX_FAILS); // รวมทั้ง IP
      console.warn(
        `[login] 401: PIN ไม่ถูกต้อง (user=${user.name}, userId=${userId}, ip=${ip})`,
      );
      return NextResponse.json({ error: "PIN ไม่ถูกต้อง" }, { status: 401 });
    }

    // สำเร็จ = IP นี้ไม่ใช่ผู้บุกรุก ล้างตัวนับของ IP นี้ทั้งหมด
    await query(`delete from login_throttle where ip = $1`, [ip]);
    await setSession({ userId: user.id, name: user.name, role: user.role });
    console.log(
      `[login] สำเร็จ: ${user.name} (userId=${userId}, role=${user.role})`,
    );
    return NextResponse.json({ ok: true, role: user.role });
  } catch (err) {
    // error ที่ไม่คาดคิด (เช่น DB ล่ม) — คืน 500 พร้อมข้อความ ไม่ปล่อยดิบ
    console.error("[login] error ไม่คาดคิด:", (err as Error).message);
    return NextResponse.json(
      { error: "ระบบขัดข้องชั่วคราว ลองใหม่อีกครั้ง" },
      { status: 500 },
    );
  }
}
