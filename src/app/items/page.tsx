import { requireAdmin } from "@/lib/auth";
import { listItems } from "@/lib/data";
import Nav from "@/components/Nav";
import ItemsManager from "./ItemsManager";

export const dynamic = "force-dynamic";

export default async function ItemsPage() {
  const session = await requireAdmin();
  const items = await listItems();
  return (
    <>
      <Nav session={session} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
        <h1 className="mb-4 text-2xl font-bold">จัดการของในคลัง</h1>
        <ItemsManager items={items} />
      </main>
    </>
  );
}
