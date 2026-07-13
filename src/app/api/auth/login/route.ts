import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { verifyPin, setSession, type Role } from "@/lib/auth";

type UserRow = {
  id: number;
  name: string;
  role: Role;
  pin_hash: string;
  failed_logins: number;
  locked_until: string | null;
};

// กัน brute-force PIN: พลาดติดกันครบ MAX_FAILS ครั้ง → ล็อก LOCK_MINUTES นาที
// (นับใน DB เพราะบน serverless เก็บตัวนับใน memory ไม่ได้ — แต่ละ request คนละ instance)
const MAX_FAILS = 5;
const LOCK_MINUTES = 15;

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
    if (!userId || !pin) {
      return NextResponse.json(
        { error: "กรุณาเลือกชื่อและใส่ PIN" },
        { status: 400 },
      );
    }

    const user = await queryOne<UserRow>(
      `select id, name, role, pin_hash, failed_logins, locked_until
       from users where id = $1 and active = true`,
      [userId],
    );

    // แยก log ให้เห็นสาเหตุจริง (ฝั่ง server) — ข้อความฝั่ง client แยกได้ไม่เสี่ยง
    // enumeration เพราะรายชื่อผู้ใช้แสดงบนหน้า login อยู่แล้ว (เลือกชื่อจากลิสต์)
    if (!user) {
      console.warn(`[login] 401: ไม่พบผู้ใช้ที่ active (userId=${userId})`);
      return NextResponse.json({ error: "เข้าสู่ระบบไม่สำเร็จ" }, { status: 401 });
    }

    if (user.locked_until) {
      const until = new Date(user.locked_until).getTime();
      if (until > Date.now()) {
        const mins = Math.max(1, Math.ceil((until - Date.now()) / 60_000));
        console.warn(`[login] 429: ถูกล็อกชั่วคราว (user=${user.name}, userId=${userId})`);
        return NextResponse.json(
          { error: `ใส่ PIN ผิดหลายครั้ง — ล็อกชั่วคราว ลองใหม่ในอีก ${mins} นาที` },
          { status: 429 },
        );
      }
      // หมดเวลาล็อกแล้ว — เริ่มนับใหม่ ให้โอกาสครบ MAX_FAILS อีกรอบ
      await query(
        `update users set failed_logins = 0, locked_until = null where id = $1`,
        [userId],
      );
    }

    if (!verifyPin(pin, user.pin_hash)) {
      // เพิ่มตัวนับ + ตั้งเวลาล็อกใน statement เดียว (atomic แม้ยิงพร้อมกันหลาย request)
      await query(
        `update users set failed_logins = failed_logins + 1,
           locked_until = case when failed_logins + 1 >= $2
                               then now() + make_interval(mins => $3)
                               else locked_until end
         where id = $1`,
        [userId, MAX_FAILS, LOCK_MINUTES],
      );
      console.warn(
        `[login] 401: PIN ไม่ถูกต้อง (user=${user.name}, userId=${userId})`,
      );
      return NextResponse.json({ error: "PIN ไม่ถูกต้อง" }, { status: 401 });
    }

    if (user.failed_logins > 0 || user.locked_until) {
      await query(
        `update users set failed_logins = 0, locked_until = null where id = $1`,
        [userId],
      );
    }
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
