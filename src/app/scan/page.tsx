import { requireSession } from "@/lib/auth";
import Nav from "@/components/Nav";
import ScanClient from "./ScanClient";

export const dynamic = "force-dynamic";

export default async function ScanPage() {
  const session = await requireSession();
  return (
    <>
      <Nav session={session} />
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-6">
        <h1 className="mb-4 text-xl font-bold">สแกนเพื่อเบิกของ</h1>
        <ScanClient />
      </main>
    </>
  );
}
