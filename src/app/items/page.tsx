import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { listItems } from "@/lib/data";
import Nav from "@/components/Nav";
import ItemsManager from "./ItemsManager";

export const dynamic = "force-dynamic";

export default async function ItemsPage() {
  const session = await requireAdmin();
  const items = await listItems();
  return (
    <>
      <Nav session={session} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h1 className="text-2xl font-bold">จัดการของในคลัง</h1>
          <Link
            href="/qr"
            className="shrink-0 rounded-lg border border-teal-600 px-3 py-2 text-sm text-teal-700 hover:bg-teal-50"
          >
            🖨️ พิมพ์ QR รวม
          </Link>
        </div>
        <p className="mb-4 text-sm text-slate-500">
          ติด <b>QR รวม</b> ที่จุดเบิกจุดเดียว พนักงานสแกนแล้วเลือกรายการเองได้ —
          ไม่ต้องติด QR ทุกชิ้น
        </p>
        <ItemsManager items={items} />
      </main>
    </>
  );
}
