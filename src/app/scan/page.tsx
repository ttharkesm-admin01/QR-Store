import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import Nav from "@/components/Nav";
import ScanClient from "./ScanClient";

export const dynamic = "force-dynamic";

export default async function ScanPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const code = (await searchParams).code?.trim() ?? "";
  const session = await getSession();
  if (!session) {
    // ยังไม่ล็อกอิน — ไป login แล้วกลับมาที่ลิงก์เดิม (รองรับการสแกนด้วยกล้องมือถือ)
    const next = code ? `/scan?code=${encodeURIComponent(code)}` : "/scan";
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }
  return (
    <>
      <Nav session={session} />
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-6">
        <h1 className="mb-4 text-xl font-bold">สแกนเพื่อเบิกของ</h1>
        <ScanClient initialCode={code} />
      </main>
    </>
  );
}
