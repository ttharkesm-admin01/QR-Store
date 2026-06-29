"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Item } from "@/lib/data";

type FormState = {
  code: string;
  name: string;
  quantity: string;
  unit: string;
  low_stock: string;
  note: string;
};

const empty: FormState = {
  code: "",
  name: "",
  quantity: "0",
  unit: "ชิ้น",
  low_stock: "0",
  note: "",
};

export default function ItemsManager({ items }: { items: Item[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(empty);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function startAdd() {
    setForm(empty);
    setAdding(true);
    setEditingId(null);
    setError("");
  }

  function startEdit(it: Item) {
    setForm({
      code: it.code,
      name: it.name,
      quantity: String(it.quantity),
      unit: it.unit,
      low_stock: String(it.low_stock),
      note: it.note ?? "",
    });
    setEditingId(it.id);
    setAdding(false);
    setError("");
  }

  function cancel() {
    setAdding(false);
    setEditingId(null);
    setError("");
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const url = editingId ? `/api/items/${editingId}` : "/api/items";
    const method = editingId ? "PATCH" : "POST";
    const body: Record<string, unknown> = {
      code: form.code,
      name: form.name,
      unit: form.unit,
      low_stock: Number(form.low_stock),
      note: form.note,
    };
    if (!editingId) body.quantity = Number(form.quantity);
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "บันทึกไม่สำเร็จ");
        return;
      }
      cancel();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function remove(it: Item) {
    if (!confirm(`ลบ "${it.name}" ?`)) return;
    await fetch(`/api/items/${it.id}`, { method: "DELETE" });
    router.refresh();
  }

  async function adjust(it: Item) {
    const input = prompt(
      `ปรับสต็อก "${it.name}" (คงเหลือ ${it.quantity})\nใส่จำนวนที่เปลี่ยน เช่น 10 (เติม) หรือ -3 (ลด)`,
    );
    if (input === null) return;
    const delta = Math.trunc(Number(input));
    if (!delta) return;
    const res = await fetch(`/api/items/${it.id}/adjust`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ delta }),
    });
    if (!res.ok) {
      const data = await res.json();
      alert(data.error ?? "ปรับไม่สำเร็จ");
      return;
    }
    router.refresh();
  }

  const field =
    "w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-teal-500 focus:outline-none";

  return (
    <div className="space-y-4">
      {!adding && editingId === null && (
        <button
          onClick={startAdd}
          className="rounded-lg bg-teal-600 px-4 py-2 font-medium text-white hover:bg-teal-700"
        >
          + เพิ่มรายการ
        </button>
      )}

      {(adding || editingId !== null) && (
        <form
          onSubmit={save}
          className="space-y-3 rounded-xl bg-white p-4 shadow-sm"
        >
          <h2 className="font-semibold">
            {editingId ? "แก้ไขรายการ" : "เพิ่มรายการใหม่"}
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm">
              รหัส (code) *
              <input
                className={field}
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="เช่น PEN-001"
              />
            </label>
            <label className="text-sm">
              ชื่อ *
              <input
                className={field}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>
            {!editingId && (
              <label className="text-sm">
                จำนวนเริ่มต้น
                <input
                  className={field}
                  type="number"
                  value={form.quantity}
                  onChange={(e) =>
                    setForm({ ...form, quantity: e.target.value })
                  }
                />
              </label>
            )}
            <label className="text-sm">
              หน่วย
              <input
                className={field}
                value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
              />
            </label>
            <label className="text-sm">
              เตือนเมื่อเหลือ ≤
              <input
                className={field}
                type="number"
                value={form.low_stock}
                onChange={(e) =>
                  setForm({ ...form, low_stock: e.target.value })
                }
              />
            </label>
            <label className="col-span-2 text-sm">
              หมายเหตุ
              <input
                className={field}
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
              />
            </label>
          </div>
          {error && <p className="text-sm text-rose-600">{error}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-teal-600 px-4 py-2 font-medium text-white disabled:opacity-50"
            >
              บันทึก
            </button>
            <button
              type="button"
              onClick={cancel}
              className="rounded-lg px-4 py-2 text-slate-600 hover:bg-slate-100"
            >
              ยกเลิก
            </button>
          </div>
        </form>
      )}

      <div className="overflow-hidden rounded-xl bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-3 py-2">รายการ</th>
              <th className="px-3 py-2 text-right">คงเหลือ</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((it) => {
              const low = it.quantity <= it.low_stock;
              return (
                <tr key={it.id}>
                  <td className="px-3 py-2">
                    <div className="font-medium">{it.name}</div>
                    <div className="text-xs text-slate-400">{it.code}</div>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <span
                      className={
                        low ? "font-semibold text-rose-600" : "text-slate-700"
                      }
                    >
                      {it.quantity} {it.unit}
                    </span>
                    {low && (
                      <div className="text-xs text-rose-500">ใกล้หมด</div>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap justify-end gap-1 text-xs">
                      <button
                        onClick={() => adjust(it)}
                        className="rounded-md bg-slate-100 px-2 py-1 hover:bg-slate-200"
                      >
                        +/− สต็อก
                      </button>
                      <button
                        onClick={() => startEdit(it)}
                        className="rounded-md bg-slate-100 px-2 py-1 hover:bg-slate-200"
                      >
                        แก้ไข
                      </button>
                      <Link
                        href={`/items/${it.id}/qr`}
                        className="rounded-md bg-slate-100 px-2 py-1 hover:bg-slate-200"
                      >
                        QR
                      </Link>
                      <button
                        onClick={() => remove(it)}
                        className="rounded-md bg-rose-50 px-2 py-1 text-rose-600 hover:bg-rose-100"
                      >
                        ลบ
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {items.length === 0 && (
              <tr>
                <td colSpan={3} className="px-3 py-6 text-center text-slate-400">
                  ยังไม่มีรายการ
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
