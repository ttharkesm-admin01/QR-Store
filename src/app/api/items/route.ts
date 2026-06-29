import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { AppError, createItem, listItems } from "@/lib/data";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "ยังไม่ได้เข้าสู่ระบบ" }, { status: 401 });
  return NextResponse.json(await listItems());
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "ต้องเป็นผู้ดูแลระบบ" }, { status: 403 });
  }
  try {
    const b = await req.json();
    const code = String(b.code ?? "").trim();
    const name = String(b.name ?? "").trim();
    if (!code || !name) throw new AppError("กรุณากรอกรหัสและชื่อ", 400);
    const item = await createItem({
      code,
      name,
      quantity: Math.max(0, Math.trunc(Number(b.quantity) || 0)),
      unit: String(b.unit ?? "ชิ้น").trim() || "ชิ้น",
      low_stock: Math.max(0, Math.trunc(Number(b.low_stock) || 0)),
      note: b.note ? String(b.note).trim() : null,
    });
    return NextResponse.json(item, { status: 201 });
  } catch (err) {
    const e = err as AppError;
    return NextResponse.json(
      { error: e.message ?? "บันทึกไม่สำเร็จ" },
      { status: e.status ?? 500 },
    );
  }
}
