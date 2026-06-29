import { query, queryOne, tx } from "./db";
import { hashPin, type Role } from "./auth";

export type Item = {
  id: number;
  code: string;
  name: string;
  quantity: number;
  unit: string;
  low_stock: number;
  note: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type MovementView = {
  id: number;
  item_id: number;
  user_id: number;
  delta: number;
  type: "WITHDRAW" | "RESTOCK" | "ADJUST";
  note: string | null;
  created_at: string;
  item_name: string;
  item_code: string;
  user_name: string;
};

export type PublicUser = { id: number; name: string; role: Role };

// ข้อผิดพลาดที่อยากส่ง status code กลับไปให้ client
export class AppError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function isUniqueViolation(err: unknown): boolean {
  return (err as { code?: string })?.code === "23505";
}

// ---------- users ----------
export async function countUsers(): Promise<number> {
  const row = await queryOne<{ n: number }>(`select count(*)::int as n from users`);
  return row?.n ?? 0;
}

export function listPublicUsers(): Promise<PublicUser[]> {
  return query<PublicUser>(
    `select id, name, role from users where active = true order by name`,
  );
}

export async function createUser(input: {
  name: string;
  pin: string;
  role: Role;
}): Promise<PublicUser> {
  const name = input.name.trim();
  const pin = input.pin.trim();
  if (!name) throw new AppError("กรุณากรอกชื่อ", 400);
  if (!/^\d{4,8}$/.test(pin)) throw new AppError("PIN ต้องเป็นตัวเลข 4–8 หลัก", 400);
  const row = await queryOne<PublicUser>(
    `insert into users (name, pin_hash, role)
     values ($1, $2, $3) returning id, name, role`,
    [name, hashPin(pin), input.role === "ADMIN" ? "ADMIN" : "STAFF"],
  );
  return row!;
}

// ปิดการใช้งานผู้ใช้ (ไม่ลบจริง เพื่อรักษาประวัติการเบิก)
export async function deactivateUser(id: number): Promise<void> {
  await query(`update users set active = false where id = $1`, [id]);
}

export async function countActiveAdmins(): Promise<number> {
  const row = await queryOne<{ n: number }>(
    `select count(*)::int as n from users where active = true and role = 'ADMIN'`,
  );
  return row?.n ?? 0;
}

export async function getUserRole(id: number): Promise<Role | null> {
  const row = await queryOne<{ role: Role }>(
    `select role from users where id = $1 and active = true`,
    [id],
  );
  return row?.role ?? null;
}

// ---------- items ----------
export function listItems(): Promise<Item[]> {
  return query<Item>(`select * from items where active = true order by name`);
}

export function getItemById(id: number): Promise<Item | null> {
  return queryOne<Item>(`select * from items where id = $1 and active = true`, [id]);
}

export function getItemByCode(code: string): Promise<Item | null> {
  return queryOne<Item>(
    `select * from items where code = $1 and active = true`,
    [code],
  );
}

export async function createItem(input: {
  code: string;
  name: string;
  quantity: number;
  unit: string;
  low_stock: number;
  note?: string | null;
}): Promise<Item> {
  try {
    const row = await queryOne<Item>(
      `insert into items (code, name, quantity, unit, low_stock, note)
       values ($1,$2,$3,$4,$5,$6) returning *`,
      [
        input.code,
        input.name,
        input.quantity,
        input.unit,
        input.low_stock,
        input.note ?? null,
      ],
    );
    return row!;
  } catch (err) {
    if (isUniqueViolation(err)) throw new AppError("รหัส (code) นี้มีอยู่แล้ว", 409);
    throw err;
  }
}

export async function updateItem(
  id: number,
  input: {
    code: string;
    name: string;
    unit: string;
    low_stock: number;
    note?: string | null;
  },
): Promise<Item> {
  try {
    const row = await queryOne<Item>(
      `update items set code=$1, name=$2, unit=$3, low_stock=$4, note=$5, updated_at=now()
       where id=$6 and active=true returning *`,
      [input.code, input.name, input.unit, input.low_stock, input.note ?? null, id],
    );
    if (!row) throw new AppError("ไม่พบรายการนี้", 404);
    return row;
  } catch (err) {
    if (isUniqueViolation(err)) throw new AppError("รหัส (code) นี้มีอยู่แล้ว", 409);
    throw err;
  }
}

// archive รายการ (เก็บประวัติการเบิกไว้)
export async function deleteItem(id: number): Promise<void> {
  await query(
    `update items set active = false, updated_at = now() where id = $1`,
    [id],
  );
}

// ---------- การตัดสต็อก (เบิกของ) แบบ atomic ----------
export async function withdraw(
  userId: number,
  itemId: number,
  qty: number,
  note?: string | null,
): Promise<Item> {
  if (!Number.isInteger(qty) || qty <= 0) {
    throw new AppError("จำนวนต้องเป็นจำนวนเต็มมากกว่า 0", 400);
  }
  return tx(async (client) => {
    // ตัดสต็อกเฉพาะเมื่อมีของพอ + ยัง active — กันสต็อกติดลบในคำสั่งเดียว
    const upd = await client.query<Item>(
      `update items set quantity = quantity - $1, updated_at = now()
       where id = $2 and active = true and quantity >= $1
       returning *`,
      [qty, itemId],
    );
    if (upd.rowCount === 0) {
      const exists = await client.query<{ quantity: number }>(
        `select quantity from items where id = $1 and active = true`,
        [itemId],
      );
      if (exists.rowCount === 0) throw new AppError("ไม่พบรายการนี้", 404);
      throw new AppError(`สต็อกไม่พอ (คงเหลือ ${exists.rows[0].quantity})`, 409);
    }
    await client.query(
      `insert into movements (item_id, user_id, delta, type, note)
       values ($1,$2,$3,'WITHDRAW',$4)`,
      [itemId, userId, -qty, note ?? null],
    );
    return upd.rows[0];
  });
}

// ---------- ปรับ/เติมสต็อก (admin) ----------
export async function adjustStock(
  userId: number,
  itemId: number,
  delta: number,
  note?: string | null,
): Promise<Item> {
  if (!Number.isInteger(delta) || delta === 0) {
    throw new AppError("จำนวนที่ปรับต้องไม่เป็น 0", 400);
  }
  return tx(async (client) => {
    const upd = await client.query<Item>(
      `update items set quantity = quantity + $1, updated_at = now()
       where id = $2 and active = true and quantity + $1 >= 0
       returning *`,
      [delta, itemId],
    );
    if (upd.rowCount === 0) {
      const exists = await client.query<{ quantity: number }>(
        `select quantity from items where id = $1 and active = true`,
        [itemId],
      );
      if (exists.rowCount === 0) throw new AppError("ไม่พบรายการนี้", 404);
      throw new AppError("ปรับแล้วสต็อกจะติดลบ", 409);
    }
    await client.query(
      `insert into movements (item_id, user_id, delta, type, note)
       values ($1,$2,$3,$4,$5)`,
      [itemId, userId, delta, delta > 0 ? "RESTOCK" : "ADJUST", note ?? null],
    );
    return upd.rows[0];
  });
}

// ---------- ประวัติการเคลื่อนไหว ----------
export function listMovements(filters: {
  itemId?: number;
  userId?: number;
  from?: string;
  to?: string;
  limit?: number;
}): Promise<MovementView[]> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filters.itemId) {
    params.push(filters.itemId);
    where.push(`m.item_id = $${params.length}`);
  }
  if (filters.userId) {
    params.push(filters.userId);
    where.push(`m.user_id = $${params.length}`);
  }
  if (filters.from) {
    params.push(filters.from);
    where.push(`m.created_at >= $${params.length}`);
  }
  if (filters.to) {
    params.push(filters.to);
    where.push(`m.created_at <= $${params.length}`);
  }
  const whereSql = where.length ? `where ${where.join(" and ")}` : "";
  params.push(filters.limit ?? 200);
  return query<MovementView>(
    `select m.*, i.name as item_name, i.code as item_code, u.name as user_name
     from movements m
     join items i on i.id = m.item_id
     join users u on u.id = m.user_id
     ${whereSql}
     order by m.created_at desc
     limit $${params.length}`,
    params,
  );
}
