"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import QrScanner from "@/components/QrScanner";
import type { Item } from "@/lib/data";

type Stage = "picking" | "review" | "done";

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

export default function ScanClient({
  initialCode,
  items,
}: {
  initialCode?: string;
  items: Item[];
}) {
  const [stage, setStage] = useState<Stage>("picking");
  const [list, setList] = useState<Item[]>(items);
  const [q, setQ] = useState(""); // คำค้นหาในลิสต์
  const [cameraOn, setCameraOn] = useState(false);
  const [showScan, setShowScan] = useState(false); // ซ่อน/แสดงตัวเลือกสแกน QR รายชิ้น
  const [scannerKey, setScannerKey] = useState(0);
  const [item, setItem] = useState<Item | null>(null);
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");
  const [manual, setManual] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState("");

  const lookupRef = useRef<(code: string) => void>(() => {});
  const fileRef = useRef<HTMLInputElement>(null);

  async function refreshList() {
    try {
      const res = await fetch("/api/items");
      if (res.ok) setList(await res.json());
    } catch {
      /* ใช้ลิสต์เดิม */
    }
  }

  function rescan() {
    setItem(null);
    setQty(1);
    setNote("");
    setManual("");
    setQ("");
    setError("");
    setResult("");
    setCameraOn(false);
    setShowScan(false);
    setStage("picking");
    refreshList(); // ดึงสต็อกล่าสุด
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
        if (cameraOn) setScannerKey((k) => k + 1);
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

  // มากับลิงก์ที่มี ?code= (สแกน QR รายชิ้น) → ค้นหาให้อัตโนมัติ
  const did = useRef(false);
  useEffect(() => {
    if (initialCode && !did.current) {
      did.current = true;
      lookupRef.current(initialCode);
    }
  }, [initialCode]);

  // ถ่ายรูป QR แล้วถอดรหัสจากรูป — เสถียรบน iPhone (ไม่ใช้ video stream ต่อเนื่อง)
  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setError("");
    const el = document.createElement("div");
    el.id = `qr-file-${Date.now()}`;
    el.style.display = "none";
    document.body.appendChild(el);
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const reader = new Html5Qrcode(el.id, { verbose: false });
      const decoded = await reader.scanFile(file, false);
      try {
        reader.clear();
      } catch {
        /* ไม่เป็นไร */
      }
      await lookup(decoded);
    } catch {
      setError("อ่าน QR จากรูปไม่ได้ — ถ่ายให้ชัดและเต็มกรอบ แล้วลองใหม่");
    } finally {
      el.remove();
      setBusy(false);
    }
  }

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
              onClick={() => setQty((n) => Math.max(1, n - 1))}
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
              onClick={() => setQty((n) => n + 1)}
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
            ← เลือกรายการอื่น
          </button>
        </div>
      </div>
    );
  }

  // stage === "picking"
  const keyword = q.trim().toLowerCase();
  const filtered = keyword
    ? list.filter(
        (i) =>
          i.name.toLowerCase().includes(keyword) ||
          i.code.toLowerCase().includes(keyword),
      )
    : list;

  return (
    <div className="space-y-4">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="ค้นหาชื่อของหรือรหัส…"
        className="w-full rounded-xl border border-slate-300 px-4 py-3 focus:border-teal-500 focus:outline-none"
      />

      <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
        <ul className="divide-y divide-slate-100">
          {filtered.map((it) => {
            const low = it.quantity <= it.low_stock;
            return (
              <li key={it.id}>
                <button
                  onClick={() => lookup(it.code)}
                  disabled={busy}
                  className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-teal-50 disabled:opacity-50"
                >
                  <span>
                    <span className="font-medium">{it.name}</span>
                    <span className="block text-xs text-slate-400">
                      {it.code}
                    </span>
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-sm ${
                      low
                        ? "bg-rose-50 font-medium text-rose-600"
                        : "text-slate-500"
                    }`}
                  >
                    เหลือ {it.quantity} {it.unit}
                  </span>
                </button>
              </li>
            );
          })}
          {filtered.length === 0 && (
            <li className="px-4 py-6 text-center text-sm text-slate-400">
              {list.length === 0 ? "ยังไม่มีรายการของ" : "ไม่พบรายการที่ค้นหา"}
            </li>
          )}
        </ul>
      </div>

      {error && (
        <p className="rounded-lg bg-rose-50 p-3 text-center text-sm text-rose-600">
          {error}
        </p>
      )}

      {/* ทางเลือกเสริม: สแกน QR รายชิ้น (ถ้ามีติดไว้) */}
      <div className="rounded-2xl bg-white p-4 shadow-sm">
        {!showScan ? (
          <button
            onClick={() => setShowScan(true)}
            className="w-full text-center text-sm text-slate-500 hover:text-teal-700"
          >
            หรือสแกน QR รายชิ้น / กรอกรหัสเอง
          </button>
        ) : (
          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                value={manual}
                onChange={(e) => setManual(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && lookup(manual)}
                placeholder="กรอกรหัส เช่น PEN-001"
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

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={onPhoto}
            />
            <button
              onClick={() => {
                setError("");
                fileRef.current?.click();
              }}
              disabled={busy}
              className="w-full rounded-lg border border-slate-200 py-2 text-sm text-slate-600 hover:border-teal-400 hover:bg-teal-50 disabled:opacity-50"
            >
              📷 ถ่ายรูป QR เพื่อสแกน
            </button>

            {cameraOn ? (
              <>
                <QrScanner key={scannerKey} onScan={lookup} />
                <button
                  onClick={() => setCameraOn(false)}
                  className="w-full rounded-lg py-2 text-sm text-slate-500 hover:bg-slate-100"
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
                className="w-full rounded-lg py-2 text-sm text-slate-400 hover:bg-slate-100"
              >
                เปิดกล้องสแกนต่อเนื่อง
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
