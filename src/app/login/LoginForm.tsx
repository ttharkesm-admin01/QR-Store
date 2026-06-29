"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PublicUser } from "@/lib/data";

export default function LoginForm({
  users,
  next = "/",
}: {
  users: PublicUser[];
  next?: string;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<PublicUser | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selected.id, pin }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "เข้าสู่ระบบไม่สำเร็จ");
        setPin("");
        return;
      }
      router.replace(next);
      router.refresh();
    } catch {
      setError("เชื่อมต่อไม่ได้ ลองใหม่อีกครั้ง");
    } finally {
      setLoading(false);
    }
  }

  if (!selected) {
    return (
      <div className="grid grid-cols-2 gap-3">
        {users.map((u) => (
          <button
            key={u.id}
            onClick={() => {
              setSelected(u);
              setError("");
            }}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-4 text-center font-medium text-slate-700 hover:border-teal-400 hover:bg-teal-50"
          >
            {u.name}
            {u.role === "ADMIN" && (
              <span className="mt-1 block text-xs text-teal-600">ผู้ดูแล</span>
            )}
          </button>
        ))}
        {users.length === 0 && (
          <p className="col-span-2 text-center text-sm text-slate-500">
            ยังไม่มีผู้ใช้ในระบบ
          </p>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="text-center">
        <p className="text-sm text-slate-500">เข้าสู่ระบบในชื่อ</p>
        <p className="text-lg font-semibold text-slate-800">{selected.name}</p>
      </div>
      <input
        autoFocus
        type="password"
        inputMode="numeric"
        autoComplete="off"
        placeholder="ใส่ PIN"
        value={pin}
        onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
        className="w-full rounded-xl border border-slate-300 px-4 py-3 text-center text-2xl tracking-widest focus:border-teal-500 focus:outline-none"
      />
      {error && <p className="text-center text-sm text-rose-600">{error}</p>}
      <button
        type="submit"
        disabled={loading || pin.length === 0}
        className="w-full rounded-xl bg-teal-600 py-3 font-medium text-white disabled:opacity-50"
      >
        {loading ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}
      </button>
      <button
        type="button"
        onClick={() => {
          setSelected(null);
          setPin("");
          setError("");
        }}
        className="w-full text-center text-sm text-slate-500"
      >
        ← เลือกชื่ออื่น
      </button>
    </form>
  );
}
