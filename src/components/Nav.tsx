import Link from "next/link";
import type { Session } from "@/lib/auth";
import LogoutButton from "./LogoutButton";

export default function Nav({ session }: { session: Session }) {
  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-lg font-bold text-teal-700">
          QR-Store
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <Link
            href="/scan"
            className="rounded-lg px-3 py-1.5 text-slate-700 hover:bg-slate-100"
          >
            สแกนเบิก
          </Link>
          <Link
            href="/history"
            className="rounded-lg px-3 py-1.5 text-slate-700 hover:bg-slate-100"
          >
            ประวัติ
          </Link>
          {session.role === "ADMIN" && (
            <>
              <Link
                href="/items"
                className="rounded-lg px-3 py-1.5 text-slate-700 hover:bg-slate-100"
              >
                จัดการของ
              </Link>
              <Link
                href="/users"
                className="rounded-lg px-3 py-1.5 text-slate-700 hover:bg-slate-100"
              >
                ผู้ใช้
              </Link>
            </>
          )}
          <span className="ml-1 hidden text-slate-400 sm:inline">|</span>
          <span className="hidden px-2 text-slate-500 sm:inline">
            {session.name}
          </span>
          <LogoutButton />
        </nav>
      </div>
    </header>
  );
}
