import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getItemByCode } from "@/lib/data";

// ค้นหารายการจาก code ที่สแกนได้ — GET /api/items/lookup?code=PEN-001
export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "ยังไม่ได้เข้าสู่ระบบ" }, { status: 401 });
    }
    const code = new URL(req.url).searchParams.get("code")?.trim();
    if (!code) return NextResponse.json({ error: "ไม่มีรหัส" }, { status: 400 });
    const item = await getItemByCode(code);
    if (!item) {
      return NextResponse.json(
        { error: `ไม่พบรายการสำหรับรหัส "${code}"` },
        { status: 404 },
      );
    }
    return NextResponse.json(item);
  } catch (err) {
    console.error("[lookup] error:", (err as Error).message);
    return NextResponse.json({ error: "ระบบขัดข้องชั่วคราว" }, { status: 500 });
  }
}
