"use client";

import { useEffect, useId, useRef, useState } from "react";

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
    let scanner: import("html5-qrcode").Html5Qrcode | null = null;
    let stopped = false;

    (async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (stopped) return; // ถูก unmount ระหว่างโหลดไลบรารี
        scanner = new Html5Qrcode(containerId.current, { verbose: false });
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (decoded) => {
            if (stopped) return;
            stopped = true;
            // หยุดกล้องก่อนแล้วค่อยส่งผลลัพธ์ขึ้นไป
            scanner
              ?.stop()
              .catch(() => {})
              .finally(() => onScanRef.current(decoded));
          },
          () => {
            /* ไม่เจอ QR ในเฟรมนี้ — ปกติ ไม่ต้องทำอะไร */
          },
        );
        if (stopped) {
          // ถูก unmount ระหว่างกล้องกำลังเริ่ม — ปิดกล้องทันที
          scanner.stop().catch(() => {});
        }
      } catch {
        setError(
          "เปิดกล้องไม่ได้ — ตรวจสอบสิทธิ์กล้อง หรือใช้ช่องกรอกรหัสด้านล่างแทน",
        );
      }
    })();

    return () => {
      stopped = true;
      if (scanner) {
        scanner
          .stop()
          .catch(() => {})
          .finally(() => scanner?.clear());
      }
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
