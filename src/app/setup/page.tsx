import { redirect } from "next/navigation";
import { ensureSchema } from "@/lib/db";
import { countUsers } from "@/lib/data";
import SetupForm from "./SetupForm";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  await ensureSchema();
  // ตั้งค่าได้เฉพาะตอนยังไม่มีผู้ใช้ในระบบ
  if ((await countUsers()) > 0) redirect("/login");
  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-teal-700">ตั้งค่าครั้งแรก</h1>
          <p className="mt-1 text-sm text-slate-500">
            สร้างบัญชีผู้ดูแลระบบคนแรกเพื่อเริ่มใช้งาน
          </p>
        </div>
        <SetupForm />
      </div>
    </main>
  );
}
