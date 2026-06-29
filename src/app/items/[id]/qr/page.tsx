/* eslint-disable @next/next/no-img-element */
import QRCode from "qrcode";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getItemById } from "@/lib/data";
import PrintButton from "./PrintButton";

export const dynamic = "force-dynamic";

export default async function QrPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const id = Number((await params).id);
  const item = await getItemById(id);
  if (!item) notFound();

  const dataUrl = await QRCode.toDataURL(item.code, { width: 600, margin: 1 });

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-8">
      <div className="no-print mb-4 flex items-center justify-between">
        <Link href="/items" className="text-sm text-teal-700">
          ← กลับ
        </Link>
        <div className="flex gap-2">
          <a
            href={dataUrl}
            download={`qr-${item.code}.png`}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-100"
          >
            ดาวน์โหลด PNG
          </a>
          <PrintButton />
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <img
          src={dataUrl}
          alt={`QR ${item.code}`}
          className="mx-auto h-56 w-56"
        />
        <h1 className="mt-4 text-xl font-bold">{item.name}</h1>
        <p className="mt-1 font-mono text-slate-500">{item.code}</p>
        <p className="mt-2 text-sm text-slate-400">
          สแกนเพื่อเบิก · หน่วย: {item.unit}
        </p>
      </div>

      <p className="no-print mt-4 text-center text-xs text-slate-400">
        พิมพ์แล้วนำไปติดที่ชั้นวาง/กล่องของรายการนี้
      </p>
    </main>
  );
}
