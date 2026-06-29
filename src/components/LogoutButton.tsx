"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  return (
    <button
      onClick={async () => {
        setLoading(true);
        await fetch("/api/auth/logout", { method: "POST" });
        router.replace("/login");
        router.refresh();
      }}
      disabled={loading}
      className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
    >
      ออกจากระบบ
    </button>
  );
}
