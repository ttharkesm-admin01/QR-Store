import { NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { verifyPin, setSession, type Role } from "@/lib/auth";

type UserRow = { id: number; name: string; role: Role; pin_hash: string };

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
      `select id, name, role, pin_hash from users where id = $1 and active = true`,
      [userId],
    );

    // แยก log ให้เห็นสาเหตุจริงของ 401 (ฝั่ง server) แต่ไม่บอก client ว่าเป็นเพราะอะไร
    if (!user) {
      console.warn(`[login] 401: ไม่พบผู้ใช้ที่ active (userId=${userId})`);
      return NextResponse.json({ error: "เข้าสู่ระบบไม่สำเร็จ" }, { status: 401 });
    }
    if (!verifyPin(pin, user.pin_hash)) {
      console.warn(
        `[login] 401: PIN ไม่ถูกต้อง (user=${user.name}, userId=${userId})`,
      );
      return NextResponse.json({ error: "PIN ไม่ถูกต้อง" }, { status: 401 });
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
