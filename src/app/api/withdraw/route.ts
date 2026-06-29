import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { AppError, getItemByCode, withdraw } from "@/lib/data";

// เบิกของ + ตัดสต็อก — body: { code?: string, itemId?: number, quantity: number, note?: string }
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "ยังไม่ได้เข้าสู่ระบบ" }, { status: 401 });
  }
  try {
    const b = await req.json();
    const quantity = Math.trunc(Number(b.quantity));

    let itemId = Number(b.itemId) || 0;
    if (!itemId && b.code) {
      const item = await getItemByCode(String(b.code).trim());
      if (!item) throw new AppError(`ไม่พบรายการสำหรับรหัสนี้`, 404);
      itemId = item.id;
    }
    if (!itemId) throw new AppError("ไม่ได้ระบุรายการ", 400);

    const updated = await withdraw(
      session.userId,
      itemId,
      quantity,
      b.note ? String(b.note).trim() : null,
    );
    return NextResponse.json({
      ok: true,
      item: updated,
      message: `เบิก ${quantity} ${updated.unit} แล้ว เหลือ ${updated.quantity} ${updated.unit}`,
    });
  } catch (err) {
    const e = err as AppError;
    return NextResponse.json(
      { error: e.message ?? "เบิกไม่สำเร็จ" },
      { status: e.status ?? 500 },
    );
  }
}
