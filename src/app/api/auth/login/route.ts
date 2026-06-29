import { NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { verifyPin, setSession, type Role } from "@/lib/auth";

type UserRow = { id: number; name: string; role: Role; pin_hash: string };

export async function POST(req: Request) {
  let body: { userId?: number; pin?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "คำขอไม่ถูกต้อง" }, { status: 400 });
  }
  const userId = Number(body.userId);
  const pin = String(body.pin ?? "");
  if (!userId || !pin) {
    return NextResponse.json({ error: "กรุณาเลือกชื่อและใส่ PIN" }, { status: 400 });
  }
  const user = await queryOne<UserRow>(
    `select id, name, role, pin_hash from users where id = $1 and active = true`,
    [userId],
  );
  if (!user || !verifyPin(pin, user.pin_hash)) {
    return NextResponse.json({ error: "PIN ไม่ถูกต้อง" }, { status: 401 });
  }
  await setSession({ userId: user.id, name: user.name, role: user.role });
  return NextResponse.json({ ok: true, role: user.role });
}
