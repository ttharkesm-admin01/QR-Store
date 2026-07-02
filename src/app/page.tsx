import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { listItems } from "@/lib/data";
import Nav from "@/components/Nav";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await requireSession();
  const items = await listItems();
  const lowStock = items.filter((i) => i.quantity <= i.low_stock);

  return (
    <>
      <Nav session={session} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
        <p className="text-slate-500">สวัสดี</p>
        <h1 className="mb-6 text-2xl font-bold">{session.name}</h1>

        <Link
          href="/scan"
          className="mb-6 flex items-center justify-center gap-3 rounded-2xl bg-teal-600 px-6 py-8 text-xl font-semibold text-white shadow-sm hover:bg-teal-700"
        >
          ➖ เบิกของ (เลือกรายการ)
        </Link>

        <div className="mb-6 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">รายการทั้งหมด</p>
            <p className="text-2xl font-bold">{items.length}</p>
          </div>
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">ใกล้หมด</p>
            <p
              className={`text-2xl font-bold ${
                lowStock.length ? "text-rose-600" : "text-slate-800"
              }`}
            >
              {lowStock.length}
            </p>
          </div>
        </div>

        <section className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="mb-3 font-semibold">ของที่ใกล้หมด</h2>
          {lowStock.length === 0 ? (
            <p className="text-sm text-slate-500">ไม่มี — สต็อกเพียงพอทั้งหมด ✅</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {lowStock.map((i) => (
                <li
                  key={i.id}
                  className="flex items-center justify-between py-2"
                >
                  <span>{i.name}</span>
                  <span className="rounded-full bg-rose-50 px-2.5 py-0.5 text-sm font-medium text-rose-600">
                    เหลือ {i.quantity} {i.unit}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </>
  );
}
