import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { AppError, adjustStock } from "@/lib/data";

// ปรับ/เติมสต็อก (admin) — body: { delta: number, note?: string }
export async function POST(
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
    const delta = Math.trunc(Number(b.delta));
    const item = await adjustStock(
      session.userId,
      id,
      delta,
      b.note ? String(b.note).trim() : null,
    );
    return NextResponse.json(item);
  } catch (err) {
    const e = err as AppError;
    return NextResponse.json(
      { error: e.message ?? "ปรับสต็อกไม่สำเร็จ" },
      { status: e.status ?? 500 },
    );
  }
}
