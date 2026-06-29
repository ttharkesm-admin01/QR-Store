"use client";

import { useEffect, useState } from "react";
import type { Item, MovementView, PublicUser } from "@/lib/data";

const TYPE_LABEL: Record<MovementView["type"], string> = {
  WITHDRAW: "เบิก",
  RESTOCK: "เติม",
  ADJUST: "ปรับ",
};

export default function HistoryClient({
  initialRows,
  items,
  users,
}: {
  initialRows: MovementView[];
  items: Item[];
  users: PublicUser[];
}) {
  const [rows, setRows] = useState(initialRows);
  const [itemId, setItemId] = useState("");
  const [userId, setUserId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(false);

  function buildQuery() {
    const p = new URLSearchParams();
    if (itemId) p.set("itemId", itemId);
    if (userId) p.set("userId", userId);
    if (from) p.set("from", from);
    if (to) p.set("to", `${to}T23:59:59`);
    return p;
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/movements?${buildQuery().toString()}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setRows(data);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId, userId, from, to]);

  const csvHref = `/api/movements?format=csv&${buildQuery().toString()}`;
  const select =
    "rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2 rounded-xl bg-white p-3 shadow-sm">
        <select
          className={select}
          value={itemId}
          onChange={(e) => setItemId(e.target.value)}
        >
          <option value="">ทุกรายการ</option>
          {items.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </select>
        <select
          className={select}
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
        >
          <option value="">ทุกคน</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
        <input
          type="date"
          className={select}
          value={from}
          onChange={(e) => setFrom(e.target.value)}
        />
        <input
          type="date"
          className={select}
          value={to}
          onChange={(e) => setTo(e.target.value)}
        />
        <a
          href={csvHref}
          className="ml-auto rounded-lg border border-teal-600 px-3 py-2 text-sm text-teal-700 hover:bg-teal-50"
        >
          ⬇ Export CSV
        </a>
      </div>

      <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-3 py-2">วันเวลา</th>
              <th className="px-3 py-2">รายการ</th>
              <th className="px-3 py-2 text-center">ประเภท</th>
              <th className="px-3 py-2 text-right">จำนวน</th>
              <th className="px-3 py-2">โดย</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((m) => (
              <tr key={m.id}>
                <td className="whitespace-nowrap px-3 py-2 text-slate-500">
                  {new Date(m.created_at).toLocaleString("th-TH", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </td>
                <td className="px-3 py-2">
                  <div>{m.item_name}</div>
                  {m.note && (
                    <div className="text-xs text-slate-400">{m.note}</div>
                  )}
                </td>
                <td className="px-3 py-2 text-center">{TYPE_LABEL[m.type]}</td>
                <td
                  className={`px-3 py-2 text-right font-medium ${
                    m.delta < 0 ? "text-rose-600" : "text-emerald-600"
                  }`}
                >
                  {m.delta > 0 ? `+${m.delta}` : m.delta}
                </td>
                <td className="px-3 py-2">{m.user_name}</td>
              </tr>
            ))}
            {rows.length === 0 && !loading && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-slate-400">
                  ไม่มีรายการ
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {loading && (
        <p className="text-center text-sm text-slate-400">กำลังโหลด…</p>
      )}
    </div>
  );
}
