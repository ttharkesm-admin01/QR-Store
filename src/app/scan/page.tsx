import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { listItems } from "@/lib/data";
import Nav from "@/components/Nav";
import ScanClient from "./ScanClient";

export const dynamic = "force-dynamic";

export default async function ScanPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string | string[] }>;
}) {
  const raw = (await searchParams).code;
  const code = (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? "";
  const session = await getSession();
  if (!session) {
    // ยังไม่ล็อกอิน — ไป login แล้วกลับมาที่ลิงก์เดิม
    const next = code ? `/scan?code=${encodeURIComponent(code)}` : "/scan";
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }
  const items = await listItems();
  return (
    <>
      <Nav session={session} />
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-6">
        <h1 className="mb-4 text-xl font-bold">เบิกของ</h1>
        <ScanClient initialCode={code} items={items} />
      </main>
    </>
  );
}
