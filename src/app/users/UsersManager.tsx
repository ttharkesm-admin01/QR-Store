"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PublicUser } from "@/lib/data";

export default function UsersManager({
  users,
  currentUserId,
}: {
  users: PublicUser[];
  currentUserId: number;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [role, setRole] = useState<"STAFF" | "ADMIN">("STAFF");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, pin, role }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "เพิ่มผู้ใช้ไม่สำเร็จ");
        return;
      }
      setName("");
      setPin("");
      setRole("STAFF");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function deactivate(u: PublicUser) {
    if (!confirm(`ปิดการใช้งาน "${u.name}" ?`)) return;
    const res = await fetch(`/api/users/${u.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      alert(data.error ?? "ทำรายการไม่สำเร็จ");
      return;
    }
    router.refresh();
  }

  const field =
    "w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-teal-500 focus:outline-none";

  return (
    <div className="space-y-4">
      <form onSubmit={add} className="space-y-3 rounded-xl bg-white p-4 shadow-sm">
        <h2 className="font-semibold">เพิ่มผู้ใช้</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="text-sm sm:col-span-1">
            ชื่อ
            <input
              className={field}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="text-sm">
            PIN (4–8 หลัก)
            <input
              className={`${field} tracking-widest`}
              type="password"
              inputMode="numeric"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            />
          </label>
          <label className="text-sm">
            บทบาท
            <select
              className={field}
              value={role}
              onChange={(e) => setRole(e.target.value as "STAFF" | "ADMIN")}
            >
              <option value="STAFF">พนักงาน (เบิกของ)</option>
              <option value="ADMIN">ผู้ดูแล</option>
            </select>
          </label>
        </div>
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <button
          type="submit"
          disabled={busy || !name || !pin}
          className="rounded-lg bg-teal-600 px-4 py-2 font-medium text-white disabled:opacity-50"
        >
          เพิ่มผู้ใช้
        </button>
      </form>

      <div className="overflow-hidden rounded-xl bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-3 py-2">ชื่อ</th>
              <th className="px-3 py-2">บทบาท</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((u) => (
              <tr key={u.id}>
                <td className="px-3 py-2 font-medium">{u.name}</td>
                <td className="px-3 py-2">
                  {u.role === "ADMIN" ? "ผู้ดูแล" : "พนักงาน"}
                </td>
                <td className="px-3 py-2 text-right">
                  {u.id !== currentUserId && (
                    <button
                      onClick={() => deactivate(u)}
                      className="rounded-md bg-rose-50 px-2 py-1 text-xs text-rose-600 hover:bg-rose-100"
                    >
                      ปิดการใช้งาน
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
