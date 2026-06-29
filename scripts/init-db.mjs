// สร้างตารางจาก db/schema.sql
// รัน: npm run db:init
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const schema = readFileSync(join(__dirname, "..", "db", "schema.sql"), "utf8");

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
try {
  await pool.query(schema);
  console.log("✓ สร้างตารางเรียบร้อย (users, items, movements)");
} catch (err) {
  console.error("✗ สร้างตารางไม่สำเร็จ:", err.message);
  process.exit(1);
} finally {
  await pool.end();
}
