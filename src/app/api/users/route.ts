import { NextResponse } from "next/server";
import { getSession, type Role } from "@/lib/auth";
import { AppError, createUser } from "@/lib/data";

// เพิ่มผู้ใช้ (admin เท่านั้น)
export async function POST(req: Request) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "ต้องเป็นผู้ดูแลระบบ" }, { status: 403 });
  }
  try {
    const b = await req.json();
    const user = await createUser({
      name: String(b.name ?? ""),
      pin: String(b.pin ?? ""),
      role: (b.role === "ADMIN" ? "ADMIN" : "STAFF") as Role,
    });
    return NextResponse.json(user, { status: 201 });
  } catch (err) {
    const e = err as AppError;
    return NextResponse.json(
      { error: e.message ?? "เพิ่มผู้ใช้ไม่สำเร็จ" },
      { status: e.status ?? 500 },
    );
  }
}
