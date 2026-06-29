"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import QrScanner from "@/components/QrScanner";
import type { Item } from "@/lib/data";

type Stage = "scanning" | "review" | "done";

// รับได้ทั้ง URL (เช่น https://.../scan?code=A4-001) และรหัสล้วน (A4-001)
function extractCode(text: string): string {
  const t = text.trim();
  try {
    const u = new URL(t);
    const c = u.searchParams.get("code");
    if (c) return c.trim();
  } catch {
    /* ไม่ใช่ URL — ใช้เป็นรหัสตรง ๆ */
  }
  return t;
}

export default function ScanClient({ initialCode }: { initialCode?: string }) {
  const [stage, setStage] = useState<Stage>("scanning");
  const [cameraOn, setCameraOn] = useState(false);
  const [scannerKey, setScannerKey] = useState(0);
  const [item, setItem] = useState<Item | null>(null);
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");
  const [manual, setManual] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState("");

  const lookupRef = useRef<(code: string) => void>(() => {});

  function rescan() {
    setItem(null);
    setQty(1);
    setNote("");
    setManual("");
    setError("");
    setResult("");
    setCameraOn(false);
    setStage("scanning");
  }

  async function lookup(raw: string) {
    const code = extractCode(raw);
    if (!code) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(
        `/api/items/lookup?code=${encodeURIComponent(code)}`,
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "ไม่พบรายการ");
        if (cameraOn) setScannerKey((k) => k + 1); // เริ่มสแกนกล้องใหม่
        return;
      }
      setItem(data);
      setQty(1);
      setStage("review");
    } catch {
      setError("เชื่อมต่อไม่ได้");
      if (cameraOn) setScannerKey((k) => k + 1);
    } finally {
      setBusy(false);
    }
  }
  lookupRef.current = lookup;

  // มากับลิงก์ที่มี ?code= (สแกนด้วยกล้องมือถือ) → ค้นหาให้อัตโนมัติ ไม่ต้องเปิดกล้องในเว็บ
  const did = useRef(false);
  useEffect(() => {
    if (initialCode && !did.current) {
      did.current = true;
      lookupRef.current(initialCode);
    }
  }, [initialCode]);

  async function confirm() {
    if (!item) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: item.id, quantity: qty, note }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "เบิกไม่สำเร็จ");
        return;
      }
      setResult(data.message);
      setStage("done");
    } catch {
      setError("เชื่อมต่อไม่ได้");
    } finally {
      setBusy(false);
    }
  }

  if (stage === "done") {
    return (
      <div className="rounded-2xl bg-white p-6 text-center shadow-sm">
        <div className="text-5xl">✅</div>
        <p className="mt-3 text-lg font-semibold">เบิกสำเร็จ</p>
        <p className="mt-1 text-slate-600">{result}</p>
        <div className="mt-6 flex flex-col gap-2">
          <button
            onClick={rescan}
            className="rounded-xl bg-teal-600 py-3 font-medium text-white hover:bg-teal-700"
          >
            เบิกรายการอื่น
          </button>
          <Link
            href="/"
            className="rounded-xl py-3 text-center text-slate-600 hover:bg-slate-100"
          >
            กลับหน้าหลัก
          </Link>
        </div>
      </div>
    );
  }

  if (stage === "review" && item) {
    const remaining = item.quantity - qty;
    return (
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold">{item.name}</h2>
        <p className="font-mono text-sm text-slate-400">{item.code}</p>
        <p className="mt-2 text-slate-600">
          คงเหลือ{" "}
          <span className="font-semibold">
            {item.quantity} {item.unit}
          </span>
        </p>

        <div className="mt-5">
          <p className="mb-2 text-sm text-slate-500">จำนวนที่เบิก</p>
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              className="h-12 w-12 rounded-full bg-slate-100 text-2xl hover:bg-slate-200"
            >
              −
            </button>
            <input
              type="number"
              inputMode="numeric"
              value={qty}
              onChange={(e) =>
                setQty(Math.max(1, Math.trunc(Number(e.target.value) || 1)))
              }
              className="w-20 rounded-lg border border-slate-300 py-2 text-center text-2xl"
            />
            <button
              onClick={() => setQty((q) => q + 1)}
              className="h-12 w-12 rounded-full bg-slate-100 text-2xl hover:bg-slate-200"
            >
              +
            </button>
          </div>
          <p
            className={`mt-2 text-center text-sm ${
              remaining < 0 ? "text-rose-600" : "text-slate-400"
            }`}
          >
            {remaining < 0
              ? "สต็อกไม่พอ"
              : `เบิกแล้วจะเหลือ ${remaining} ${item.unit}`}
          </p>
        </div>

        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="หมายเหตุ (ไม่บังคับ)"
          className="mt-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />

        {error && (
          <p className="mt-3 text-center text-sm text-rose-600">{error}</p>
        )}

        <div className="mt-5 flex flex-col gap-2">
          <button
            onClick={confirm}
            disabled={busy || remaining < 0}
            className="rounded-xl bg-teal-600 py-3 font-medium text-white disabled:opacity-50"
          >
            {busy ? "กำลังเบิก…" : `ยืนยันเบิก ${qty} ${item.unit}`}
          </button>
          <button
            onClick={rescan}
            className="rounded-xl py-2 text-slate-600 hover:bg-slate-100"
          >
            ยกเลิก / เบิกรายการอื่น
          </button>
        </div>
      </div>
    );
  }

  // stage === "scanning"
  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-teal-50 p-4 text-sm text-teal-800">
        💡 วิธีที่ง่ายที่สุด: ใช้ <b>กล้องถ่ายรูปของมือถือ</b> สแกน QR ที่ติดไว้ที่ของ
        แล้วแตะลิงก์ที่ขึ้นมา ระบบจะพามาที่หน้าเบิกของชิ้นนั้นทันที
      </div>

      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <p className="mb-2 text-sm text-slate-500">หรือกรอกรหัสของเอง</p>
        <div className="flex gap-2">
          <input
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && lookup(manual)}
            placeholder="เช่น PEN-001"
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2"
          />
          <button
            onClick={() => lookup(manual)}
            disabled={busy}
            className="rounded-lg bg-teal-600 px-4 py-2 font-medium text-white disabled:opacity-50"
          >
            ค้นหา
          </button>
        </div>
      </div>

      <div className="rounded-2xl bg-white p-4 shadow-sm">
        {cameraOn ? (
          <>
            <QrScanner key={scannerKey} onScan={lookup} />
            <p className="mt-3 text-center text-sm text-slate-500">
              เล็ง QR ให้อยู่ในกรอบ ถือห่าง ~15–20 ซม. ในที่สว่าง
            </p>
            <button
              onClick={() => setCameraOn(false)}
              className="mt-2 w-full rounded-lg py-2 text-sm text-slate-500 hover:bg-slate-100"
            >
              ปิดกล้อง
            </button>
          </>
        ) : (
          <button
            onClick={() => {
              setError("");
              setScannerKey((k) => k + 1);
              setCameraOn(true);
            }}
            className="w-full rounded-xl border border-slate-200 py-4 font-medium text-slate-700 hover:border-teal-400 hover:bg-teal-50"
          >
            📷 หรือเปิดกล้องสแกนในหน้านี้
          </button>
        )}
      </div>

      {error && (
        <p className="rounded-lg bg-rose-50 p-3 text-center text-sm text-rose-600">
          {error}
        </p>
      )}
    </div>
  );
}
