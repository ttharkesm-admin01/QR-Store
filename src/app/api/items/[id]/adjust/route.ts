import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { adjustStock } from "@/lib/data";
import { errorJson, parseId } from "@/lib/http";

// ปรับ/เติมสต็อก (admin) — body: { delta: number, note?: string }
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "ต้องเป็นผู้ดูแลระบบ" }, { status: 403 });
  }
  try {
    const id = parseId((await ctx.params).id);
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
    return errorJson("adjust", err, "ปรับสต็อกไม่สำเร็จ");
  }
}
