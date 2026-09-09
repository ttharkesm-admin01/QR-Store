import { Pool, type PoolClient, type QueryResultRow } from "pg";
import { SCHEMA_SQL } from "./schema";

// ใช้ Pool เดียวต่อ process (เลี่ยงสร้างหลายตัวตอน hot-reload ของ Next dev)
const globalForDb = globalThis as unknown as { pool?: Pool };

function createPool() {
  const raw = process.env.DATABASE_URL;
  if (!raw) {
    throw new Error("ไม่ได้ตั้งค่า DATABASE_URL (ดูตัวอย่างใน .env.example)");
  }
  // Neon และผู้ให้บริการคลาวด์ส่วนใหญ่ต้องใช้ SSL; localhost ไม่ต้อง
  const isLocal = /localhost|127\.0\.0\.1/.test(raw);
  const ssl =
    !isLocal && process.env.PGSSL !== "false"
      ? { rejectUnauthorized: false }
      : undefined;
  // คุม SSL ผ่าน option ด้านบนเอง แล้วตัด sslmode ออกจาก string
  // เพื่อไม่ให้ pg ขึ้น deprecation warning (SSL WARNING) — ไม่กระทบการทำงานจริง
  let connectionString = raw;
  try {
    const u = new URL(raw);
    u.searchParams.delete("sslmode");
    connectionString = u.toString();
  } catch {
    /* string แปลก ๆ — ใช้ค่าเดิม */
  }
  const p = new Pool({
    connectionString,
    ssl,
    // Neon free tier: อย่าเปิด connection เยอะ + ปิด idle เร็วก่อน Neon ตัดทิ้ง
    max: Number(process.env.PG_POOL_MAX ?? 3),
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
    keepAlive: true,
  });
  // สำคัญมากบน serverless/Neon: ถ้า idle client พังแล้วไม่มี handler
  // Node จะถือเป็น uncaught exception แล้ว process ล่ม → "This page couldn't load"
  p.on("error", (err) => {
    console.error("[pg] idle client error (จัดการแล้ว ไม่ให้ล่ม):", err.message);
  });
  return p;
}

// ❗ ต้องสร้าง Pool แบบ lazy (ตอนใช้ครั้งแรก) ห้ามสร้างตอน import
// ถ้าสร้างตอน import โมดูลจะ throw ตั้งแต่ evaluate เมื่อไม่มี DATABASE_URL →
//   1) `next build` พังตอน "Collecting page data" แม้แต่ route ที่ไม่แตะ DB
//      (เช่น /api/auth/logout ที่ import auth.ts → db.ts ตามสาย)
//   2) ตอน runtime route handler จะโหลดไม่ทัน → try/catch ใน route ดักไม่ได้
//      → 500 ดิบ / "This page couldn't load" แทนที่จะเป็น { error } JSON
// cache ไว้บน globalThis ทั้ง dev/prod เพื่อ reuse ข้าม warm invocation ของ serverless
function getPool(): Pool {
  if (!globalForDb.pool) globalForDb.pool = createPool();
  return globalForDb.pool;
}

// สร้างตารางอัตโนมัติครั้งแรก (idempotent) — ทำให้ deploy ขึ้นคลาวด์ได้โดยไม่ต้องรันสคริปต์ในเครื่อง
let schemaPromise: Promise<void> | null = null;
export function ensureSchema(): Promise<void> {
  if (!schemaPromise) {
    schemaPromise = getPool()
      .query(SCHEMA_SQL)
      .then(() => undefined)
      .catch((err) => {
        schemaPromise = null; // ให้ลองใหม่ได้ถ้าครั้งนี้ล้มเหลว
        throw err;
      });
  }
  return schemaPromise;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<T[]> {
  const res = await getPool().query<T>(text, params as never[]);
  return res.rows;
}

export async function queryOne<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

// รัน callback ภายใน transaction เดียว (ใช้กับการตัดสต็อก)
export async function tx<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
