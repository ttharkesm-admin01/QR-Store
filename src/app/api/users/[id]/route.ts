import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { countActiveAdmins, deactivateUser, getUserRole } from "@/lib/data";

// ปิดการใช้งานผู้ใช้ (admin เท่านั้น) — ไม่ลบจริงเพื่อรักษาประวัติ
export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "ต้องเป็นผู้ดูแลระบบ" }, { status: 403 });
  }
  const id = Number((await ctx.params).id);
  if (id === session.userId) {
    return NextResponse.json(
      { error: "ปิดการใช้งานบัญชีตัวเองไม่ได้" },
      { status: 400 },
    );
  }
  // กันปิดผู้ดูแลคนสุดท้าย (ไม่งั้นจะไม่มีใครจัดการระบบได้)
  if ((await getUserRole(id)) === "ADMIN" && (await countActiveAdmins()) <= 1) {
    return NextResponse.json(
      { error: "ต้องมีผู้ดูแลอย่างน้อย 1 คน" },
      { status: 400 },
    );
  }
  await deactivateUser(id);
  return NextResponse.json({ ok: true });
}
