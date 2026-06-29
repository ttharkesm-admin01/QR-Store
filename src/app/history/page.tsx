import { requireSession } from "@/lib/auth";
import { listItems, listMovements, listPublicUsers } from "@/lib/data";
import Nav from "@/components/Nav";
import HistoryClient from "./HistoryClient";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const session = await requireSession();
  const [rows, items, users] = await Promise.all([
    listMovements({ limit: 200 }),
    listItems(),
    listPublicUsers(),
  ]);
  return (
    <>
      <Nav session={session} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
        <h1 className="mb-4 text-2xl font-bold">ประวัติการเบิก/เติม</h1>
        <HistoryClient initialRows={rows} items={items} users={users} />
      </main>
    </>
  );
}
