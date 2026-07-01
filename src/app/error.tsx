"use client";

import { useEffect } from "react";

// จับ error ระดับหน้า (server/client) แล้วแสดงหน้าเป็นมิตรพร้อมปุ่มลองใหม่
// แทนที่จะปล่อยให้เบราว์เซอร์ขึ้น "This page couldn't load"
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[page error]", error);
  }, [error]);

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="text-center">
        <div className="text-4xl">⚠️</div>
        <h1 className="mt-3 text-lg font-semibold">โหลดหน้าไม่สำเร็จ</h1>
        <p className="mt-1 text-sm text-slate-500">
          อาจเป็นการเชื่อมต่อชั่วคราว ลองใหม่อีกครั้งได้เลย
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <button
            onClick={reset}
            className="rounded-xl bg-teal-600 px-5 py-2 font-medium text-white hover:bg-teal-700"
          >
            ลองใหม่
          </button>
          <a
            href="/"
            className="rounded-xl px-5 py-2 text-slate-600 hover:bg-slate-100"
          >
            กลับหน้าหลัก
          </a>
        </div>
      </div>
    </main>
  );
}
