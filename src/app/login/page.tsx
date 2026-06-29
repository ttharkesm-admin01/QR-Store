import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { ensureSchema } from "@/lib/db";
import { listPublicUsers } from "@/lib/data";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getSession()) redirect("/");
  await ensureSchema();
  const users = await listPublicUsers();
  // ฐานข้อมูลใหม่ที่ยังไม่มีผู้ใช้ → ไปหน้าตั้งค่าครั้งแรก
  if (users.length === 0) redirect("/setup");
  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-teal-700">QR-Store</h1>
          <p className="mt-1 text-sm text-slate-500">
            เลือกชื่อของคุณเพื่อเริ่มเบิกของ
          </p>
        </div>
        <LoginForm users={users} />
      </div>
    </main>
  );
}
