import { requireAdmin } from "@/lib/auth";
import { listPublicUsers } from "@/lib/data";
import Nav from "@/components/Nav";
import UsersManager from "./UsersManager";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const session = await requireAdmin();
  const users = await listPublicUsers();
  return (
    <>
      <Nav session={session} />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
        <h1 className="mb-4 text-2xl font-bold">จัดการผู้ใช้</h1>
        <UsersManager users={users} currentUserId={session.userId} />
      </main>
    </>
  );
}
