"use client";

import { useEffect, useId, useRef, useState } from "react";

type Scanner = import("html5-qrcode").Html5Qrcode;

// สำคัญ: stop()/clear() ของ html5-qrcode "throw แบบ synchronous" ถ้ากล้องไม่ได้กำลังทำงาน
// (เช่น "Cannot stop, scanner is not running or paused.") — .catch() ดักไม่ทัน
// ต้องครอบ try/catch เสมอ ไม่งั้น throw จะหลุดไปทำทั้งหน้าเว็บพัง
function safeStop(s: Scanner | null) {
  if (!s) return;
  try {
    const p = s.stop();
    if (p && typeof p.then === "function") {
      p.then(() => {
        try {
          s.clear();
        } catch {
          /* ไม่เป็นไร */
        }
      }).catch(() => {});
    }
  } catch {
    try {
      s.clear();
    } catch {
      /* ไม่เป็นไร */
    }
  }
}

// อ่าน QR จากกล้องมือถือด้วย html5-qrcode (ทำงานเฉพาะบน HTTPS หรือ localhost)
export default function QrScanner({
  onScan,
}: {
  onScan: (code: string) => void;
}) {
  // useId ให้ค่าเดียวกันทั้งฝั่ง server/client — เลี่ยง hydration mismatch
  const containerId = useRef(`qr-reader-${useId().replace(/:/g, "")}`);
  const [error, setError] = useState("");
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  useEffect(() => {
    let scanner: Scanner | null = null;
    let stopped = false;

    (async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (stopped) return; // ถูก unmount ระหว่างโหลดไลบรารี
        scanner = new Html5Qrcode(containerId.current, {
          verbose: false,
          experimentalFeatures: { useBarCodeDetectorIfSupported: true },
        });
        // กรอบสแกนยืดตามขนาดจอ (ราว 70% ของด้านสั้น)
        const qrbox = (vw: number, vh: number) => {
          const size = Math.max(160, Math.floor(Math.min(vw, vh) * 0.7));
          return { width: size, height: size };
        };
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox },
          (decoded) => {
            if (stopped) return;
            stopped = true;
            safeStop(scanner); // ปิดกล้อง (กัน throw แบบ sync)
            onScanRef.current(decoded);
          },
          () => {
            /* ไม่เจอ QR ในเฟรมนี้ — ปกติ */
          },
        );
        if (stopped) safeStop(scanner); // ถูก unmount ระหว่างกล้องกำลังเริ่ม
      } catch {
        setError(
          "เปิดกล้องไม่ได้ — ตรวจสอบสิทธิ์กล้อง หรือใช้วิธี 'ถ่ายรูป QR' / กรอกรหัสด้านบนแทน",
        );
      }
    })();

    return () => {
      stopped = true;
      safeStop(scanner);
    };
  }, []);

  return (
    <div>
      <div
        id={containerId.current}
        className="mx-auto w-full max-w-xs overflow-hidden rounded-xl bg-black"
      />
      {error && (
        <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-700">
          {error}
        </p>
      )}
    </div>
  );
}
