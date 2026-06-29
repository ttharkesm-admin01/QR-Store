// ใส่ข้อมูลตัวอย่าง: ผู้ใช้ admin + พนักงาน + รายการของ
// รัน: npm run db:seed   (รัน db:init ก่อน)
import { randomBytes, scryptSync } from "node:crypto";
import pg from "pg";

function hashPin(pin) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(pin, salt, 32).toString("hex");
  return `${salt}:${hash}`;
}

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("✗ ไม่ได้ตั้งค่า DATABASE_URL");
  process.exit(1);
}
const ssl =
  /sslmode=require/.test(connectionString) ||
  !/localhost|127\.0\.0\.1/.test(connectionString)
    ? { rejectUnauthorized: false }
    : undefined;
const pool = new Pool({ connectionString, ssl });

const users = [
  { name: "ผู้ดูแลระบบ", pin: "1234", role: "ADMIN" },
  { name: "สมชาย", pin: "1111", role: "STAFF" },
  { name: "สมหญิง", pin: "2222", role: "STAFF" },
];

const items = [
  { code: "PEN-001", name: "ปากกาน้ำเงิน", quantity: 50, unit: "ด้าม", low_stock: 10 },
  { code: "A4-001", name: "กระดาษ A4 (รีม)", quantity: 20, unit: "รีม", low_stock: 5 },
  { code: "GLOVE-001", name: "ถุงมือยาง (กล่อง)", quantity: 8, unit: "กล่อง", low_stock: 10 },
  { code: "MASK-001", name: "หน้ากากอนามัย (กล่อง)", quantity: 15, unit: "กล่อง", low_stock: 5 },
];

try {
  for (const u of users) {
    await pool.query(
      `insert into users (name, pin_hash, role)
       select $1, $2, $3
       where not exists (select 1 from users where name = $1)`,
      [u.name, hashPin(u.pin), u.role],
    );
  }
  for (const it of items) {
    await pool.query(
      `insert into items (code, name, quantity, unit, low_stock)
       values ($1, $2, $3, $4, $5)
       on conflict (code) do nothing`,
      [it.code, it.name, it.quantity, it.unit, it.low_stock],
    );
  }
  console.log("✓ ใส่ข้อมูลตัวอย่างแล้ว");
  console.log("  ผู้ดูแลระบบ (ADMIN) PIN: 1234");
  console.log("  สมชาย / สมหญิง (STAFF) PIN: 1111 / 2222");
} catch (err) {
  console.error("✗ seed ไม่สำเร็จ:", err.message);
  process.exit(1);
} finally {
  await pool.end();
}
