"use client";

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="rounded-lg bg-teal-600 px-4 py-2 font-medium text-white hover:bg-teal-700"
    >
      🖨️ พิมพ์ฉลาก
    </button>
  );
}
