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
  const [error, setError] = useState("");
  const [expired, setExpired] = useState(false);

  function buildQuery() {
    const p = new URLSearchParams();
    if (itemId) p.set("itemId", itemId);
    if (userId) p.set("userId", userId);
    // แปลงเป็น ISO (UTC) จากเที่ยงคืนตามเวลาเครื่องผู้ใช้ — ถ้าส่งวันที่ล้วน
    // Postgres จะตีความเป็นเที่ยงคืน UTC ทำให้ขอบเขตวันคลาดไป 7 ชม. สำหรับเวลาไทย
    if (from) p.set("from", new Date(`${from}T00:00:00`).toISOString());
    if (to) p.set("to", new Date(`${to}T23:59:59.999`).toISOString());
    return p;
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    // ❗ ต้องเช็ค res.ok และรูปร่างข้อมูลก่อน setRows
    // /api/movements ตอบ { error } ได้ทั้ง 401 (session ถูกเพิกถอนกลางคัน — ตั้งใจให้เกิดได้)
    // และ 500 ถ้าเอาไปใส่ rows ตรง ๆ จะกลายเป็น rows.map is not a function
    // → หน้าพังเป็น "โหลดหน้าไม่สำเร็จ" ทั้งที่ SSR เพิ่ง render ตารางสำเร็จ
    fetch(`/api/movements?${buildQuery().toString()}`)
      .then(async (r) => {
        // ❗ ห้ามเด้งไป /login อัตโนมัติ: ถ้า /login ยังเห็น session ว่าใช้ได้
        // มันจะเด้งกลับมา /history แล้วได้ 401 อีก = วนไม่รู้จบ
        // แสดงข้อความ + ลิงก์ให้ผู้ใช้กดเองแทน (ข้อมูลเดิมบนตารางยังอยู่)
        if (r.status === 401) {
          setExpired(true);
          throw new Error("เซสชันหมดอายุ — กรุณาเข้าสู่ระบบอีกครั้ง");
        }
        const data = await r.json().catch(() => null);
        if (!r.ok || !Array.isArray(data)) {
          throw new Error(data?.error ?? "โหลดประวัติไม่สำเร็จ");
        }
        return data as MovementView[];
      })
      .then((data) => {
        if (cancelled || !data) return;
        setRows(data);
        setError("");
        setExpired(false);
      })
      .catch((e: unknown) => {
        // เน็ตหลุด (เกิดบ่อยบนมือถือในห้องเก็บของ) — คงข้อมูลเดิมไว้ แล้วบอกผู้ใช้
        // fetch โยน TypeError เมื่อต่อไม่ติด ซึ่ง message เป็นภาษาอังกฤษของเบราว์เซอร์
        // ("Failed to fetch") ไม่ควรโชว์ให้ผู้ใช้ — แปลงเป็นข้อความไทยแทน
        if (cancelled) return;
        setError(
          e instanceof TypeError
            ? "เชื่อมต่อไม่ได้ — ตรวจสอบสัญญาณอินเทอร์เน็ต"
            : ((e as Error)?.message ?? "โหลดประวัติไม่สำเร็จ"),
        );
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

      {error && (
        <p className="rounded-lg bg-rose-50 p-3 text-center text-sm text-rose-600">
          {error}
          {expired && (
            <>
              {" "}
              <a href="/login?next=%2Fhistory" className="font-medium underline">
                เข้าสู่ระบบ
              </a>
            </>
          )}
        </p>
      )}

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
