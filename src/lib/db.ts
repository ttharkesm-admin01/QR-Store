import { Pool, type PoolClient, type QueryResultRow } from "pg";

// ใช้ Pool เดียวต่อ process (เลี่ยงสร้างหลายตัวตอน hot-reload ของ Next dev)
const globalForDb = globalThis as unknown as { pool?: Pool };

function createPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("ไม่ได้ตั้งค่า DATABASE_URL (ดูตัวอย่างใน .env.example)");
  }
  // Neon และผู้ให้บริการคลาวด์ส่วนใหญ่ต้องใช้ SSL; localhost ไม่ต้อง
  const ssl =
    /sslmode=require/.test(connectionString) ||
    (!/localhost|127\.0\.0\.1/.test(connectionString) &&
      process.env.PGSSL !== "false")
      ? { rejectUnauthorized: false }
      : undefined;
  return new Pool({ connectionString, ssl });
}

export const pool: Pool = globalForDb.pool ?? createPool();
if (process.env.NODE_ENV !== "production") globalForDb.pool = pool;

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<T[]> {
  const res = await pool.query<T>(text, params as never[]);
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
  const client = await pool.connect();
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
