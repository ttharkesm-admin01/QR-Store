import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listMovements, type MovementView } from "@/lib/data";

const TYPE_LABEL: Record<MovementView["type"], string> = {
  WITHDRAW: "เบิก",
  RESTOCK: "เติม",
  ADJUST: "ปรับ",
};

function toCsv(rows: MovementView[]): string {
  const header = ["วันเวลา", "รายการ", "รหัส", "ประเภท", "จำนวน", "ผู้ทำรายการ", "หมายเหตุ"];
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = rows.map((m) =>
    [
      new Date(m.created_at).toLocaleString("th-TH"),
      m.item_name,
      m.item_code,
      TYPE_LABEL[m.type],
      String(m.delta),
      m.user_name,
      m.note ?? "",
    ]
      .map(esc)
      .join(","),
  );
  return "﻿" + [header.map(esc).join(","), ...lines].join("\r\n");
}

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "ยังไม่ได้เข้าสู่ระบบ" }, { status: 401 });

  const sp = new URL(req.url).searchParams;
  const rows = await listMovements({
    itemId: sp.get("itemId") ? Number(sp.get("itemId")) : undefined,
    userId: sp.get("userId") ? Number(sp.get("userId")) : undefined,
    from: sp.get("from") || undefined,
    to: sp.get("to") || undefined,
    limit: sp.get("format") === "csv" ? 5000 : 200,
  });

  if (sp.get("format") === "csv") {
    return new NextResponse(toCsv(rows), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="movements-${Date.now()}.csv"`,
      },
    });
  }
  return NextResponse.json(rows);
}
