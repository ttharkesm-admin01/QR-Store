"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SetupForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [sampleData, setSampleData] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!/^\d{4,8}$/.test(pin)) {
      setError("PIN ต้องเป็นตัวเลข 4–8 หลัก");
      return;
    }
    if (pin !== pin2) {
      setError("PIN ทั้งสองช่องไม่ตรงกัน");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, pin, sampleData }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "ตั้งค่าไม่สำเร็จ");
        return;
      }
      router.replace("/");
      router.refresh();
    } catch {
      setError("เชื่อมต่อไม่ได้ ลองใหม่อีกครั้ง");
    } finally {
      setLoading(false);
    }
  }

  const field =
    "w-full rounded-xl border border-slate-300 px-4 py-3 focus:border-teal-500 focus:outline-none";

  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block text-sm">
        ชื่อผู้ดูแล
        <input
          autoFocus
          className={field}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="เช่น ผู้ดูแลระบบ"
        />
      </label>
      <label className="block text-sm">
        ตั้ง PIN (ตัวเลข 4–8 หลัก)
        <input
          className={`${field} tracking-widest`}
          type="password"
          inputMode="numeric"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
        />
      </label>
      <label className="block text-sm">
        ยืนยัน PIN อีกครั้ง
        <input
          className={`${field} tracking-widest`}
          type="password"
          inputMode="numeric"
          value={pin2}
          onChange={(e) => setPin2(e.target.value.replace(/\D/g, ""))}
        />
      </label>
      <label className="flex items-center gap-2 text-sm text-slate-600">
        <input
          type="checkbox"
          checked={sampleData}
          onChange={(e) => setSampleData(e.target.checked)}
        />
        ใส่ข้อมูลตัวอย่าง (ของ 4 รายการ) เพื่อทดลองใช้
      </label>
      {error && <p className="text-center text-sm text-rose-600">{error}</p>}
      <button
        type="submit"
        disabled={loading || !name || pin.length === 0}
        className="w-full rounded-xl bg-teal-600 py-3 font-medium text-white disabled:opacity-50"
      >
        {loading ? "กำลังตั้งค่า…" : "สร้างผู้ดูแล & เริ่มใช้งาน"}
      </button>
    </form>
  );
}
