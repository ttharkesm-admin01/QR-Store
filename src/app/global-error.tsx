"use client";

// error boundary ระดับ root (กรณี layout เองพัง) — ต้องมี html/body ของตัวเอง
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="th">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: 0,
          background: "#f8fafc",
          color: "#0f172a",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 40 }}>⚠️</div>
          <h1 style={{ fontSize: 18, margin: "12px 0 4px" }}>
            โหลดหน้าไม่สำเร็จ
          </h1>
          <p style={{ fontSize: 14, color: "#64748b" }}>ลองใหม่อีกครั้ง</p>
          <button
            onClick={() => reset()}
            style={{
              marginTop: 16,
              padding: "8px 20px",
              borderRadius: 12,
              border: "none",
              background: "#0d9488",
              color: "#fff",
              fontWeight: 500,
            }}
          >
            ลองใหม่
          </button>
        </div>
      </body>
    </html>
  );
}
