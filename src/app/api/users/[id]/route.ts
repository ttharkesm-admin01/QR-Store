import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { deactivateUser } from "@/lib/data";
import { errorJson, parseId } from "@/lib/http";

// ปิดการใช้งานผู้ใช้ (admin เท่านั้น) — ไม่ลบจริงเพื่อรักษาประวัติ
export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "ต้องเป็นผู้ดูแลระบบ" }, { status: 403 });
  }
  try {
    const id = parseId((await ctx.params).id);
    if (id === session.userId) {
      return NextResponse.json(
        { error: "ปิดการใช้งานบัญชีตัวเองไม่ได้" },
        { status: 400 },
      );
    }
    // กันปิดผู้ดูแลคนสุดท้ายไว้ใน statement เดียว (เช็คใน deactivateUser)
    const result = await deactivateUser(id);
    if (result === "last_admin") {
      return NextResponse.json(
        { error: "ต้องมีผู้ดูแลอย่างน้อย 1 คน" },
        { status: 400 },
      );
    }
    if (result === "not_found") {
      return NextResponse.json({ error: "ไม่พบผู้ใช้" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorJson("users", err, "ระบบขัดข้องชั่วคราว");
  }
}
