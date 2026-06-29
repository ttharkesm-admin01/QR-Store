import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { AppError, deleteItem, updateItem } from "@/lib/data";

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "ต้องเป็นผู้ดูแลระบบ" }, { status: 403 });
  }
  const id = Number((await ctx.params).id);
  try {
    const b = await req.json();
    const code = String(b.code ?? "").trim();
    const name = String(b.name ?? "").trim();
    if (!code || !name) throw new AppError("กรุณากรอกรหัสและชื่อ", 400);
    const item = await updateItem(id, {
      code,
      name,
      unit: String(b.unit ?? "ชิ้น").trim() || "ชิ้น",
      low_stock: Math.max(0, Math.trunc(Number(b.low_stock) || 0)),
      note: b.note ? String(b.note).trim() : null,
    });
    return NextResponse.json(item);
  } catch (err) {
    const e = err as AppError;
    return NextResponse.json(
      { error: e.message ?? "แก้ไขไม่สำเร็จ" },
      { status: e.status ?? 500 },
    );
  }
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "ต้องเป็นผู้ดูแลระบบ" }, { status: 403 });
  }
  const id = Number((await ctx.params).id);
  await deleteItem(id);
  return NextResponse.json({ ok: true });
}
