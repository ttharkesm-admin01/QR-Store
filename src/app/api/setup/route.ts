import { NextResponse } from "next/server";
import { ensureSchema, query, queryOne } from "@/lib/db";
import { hashPin, setSession } from "@/lib/auth";

const SAMPLE_ITEMS = [
  ["PEN-001", "ปากกาน้ำเงิน", 50, "ด้าม", 10],
  ["A4-001", "กระดาษ A4 (รีม)", 20, "รีม", 5],
  ["GLOVE-001", "ถุงมือยาง (กล่อง)", 8, "กล่อง", 10],
  ["MASK-001", "หน้ากากอนามัย (กล่อง)", 15, "กล่อง", 5],
] as const;

// ตั้งค่าครั้งแรก: สร้างผู้ดูแลคนแรกผ่านเว็บ (ไม่ต้องรันสคริปต์ในเครื่อง)
export async function POST(req: Request) {
  await ensureSchema();

  let body: { name?: string; pin?: string; sampleData?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "คำขอไม่ถูกต้อง" }, { status: 400 });
  }
  const name = String(body.name ?? "").trim();
  const pin = String(body.pin ?? "").trim();
  if (!name) return NextResponse.json({ error: "กรุณากรอกชื่อผู้ดูแล" }, { status: 400 });
  if (!/^\d{4,8}$/.test(pin)) {
    return NextResponse.json({ error: "PIN ต้องเป็นตัวเลข 4–8 หลัก" }, { status: 400 });
  }

  // สร้าง admin แบบ atomic — สำเร็จเฉพาะเมื่อยังไม่มีผู้ใช้คนใดในระบบ (กันสร้างซ้ำ)
  const admin = await queryOne<{ id: number; name: string }>(
    `insert into users (name, pin_hash, role)
     select $1, $2, 'ADMIN'
     where not exists (select 1 from users)
     returning id, name`,
    [name, hashPin(pin)],
  );
  if (!admin) {
    return NextResponse.json(
      { error: "ระบบถูกตั้งค่าไปแล้ว — เข้าสู่ระบบได้เลย" },
      { status: 409 },
    );
  }

  if (body.sampleData) {
    for (const [code, itemName, qty, unit, low] of SAMPLE_ITEMS) {
      await query(
        `insert into items (code, name, quantity, unit, low_stock) values ($1,$2,$3,$4,$5)`,
        [code, itemName, qty, unit, low],
      );
    }
  }

  await setSession({ userId: admin.id, name: admin.name, role: "ADMIN" });
  return NextResponse.json({ ok: true });
}
