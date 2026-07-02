/* eslint-disable @next/next/no-img-element */
import QRCode from "qrcode";
import Link from "next/link";
import { headers } from "next/headers";
import { requireAdmin } from "@/lib/auth";
import PrintButton from "../items/[id]/qr/PrintButton";

export const dynamic = "force-dynamic";

// QR รวมอันเดียว — สแกนแล้วเข้าหน้าเบิก (เลือกรายการเองจากลิสต์) ติดที่จุดเบิกจุดเดียวพอ
export default async function UniversalQrPage() {
  await requireAdmin();

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto =
    h.get("x-forwarded-proto") ??
    (/localhost|127\.0\.0\.1/.test(host) ? "http" : "https");
  const scanUrl = host ? `${proto}://${host}/scan` : "/scan";

  const dataUrl = await QRCode.toDataURL(scanUrl, { width: 600, margin: 1 });

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-8">
      <div className="no-print mb-4 flex items-center justify-between">
        <Link href="/items" className="text-sm text-teal-700">
          ← กลับ
        </Link>
        <div className="flex gap-2">
          <a
            href={dataUrl}
            download="qr-store-เบิกของ.png"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-100"
          >
            ดาวน์โหลด PNG
          </a>
          <PrintButton />
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <img src={dataUrl} alt="QR เบิกของ" className="mx-auto h-56 w-56" />
        <h1 className="mt-4 text-xl font-bold">สแกนเพื่อเบิกของ</h1>
        <p className="mt-1 text-sm text-slate-500">
          สแกนด้วยกล้องมือถือ แล้วเลือกรายการที่จะเบิกได้เลย
        </p>
      </div>

      <p className="no-print mt-4 text-center text-xs text-slate-400">
        พิมพ์แผ่นนี้แผ่นเดียว นำไปติดที่จุดเบิกของ — ไม่ต้องติด QR ทุกชิ้น
      </p>
    </main>
  );
}
