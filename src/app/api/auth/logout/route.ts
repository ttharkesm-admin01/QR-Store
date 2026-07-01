import { NextResponse } from "next/server";
import { clearSession } from "@/lib/auth";

export async function POST() {
  try {
    await clearSession();
  } catch (err) {
    // logout ควรสำเร็จเสมอจากมุมผู้ใช้ แม้ลบ cookie พลาด
    console.error("[logout] error:", (err as Error).message);
  }
  return NextResponse.json({ ok: true });
}
