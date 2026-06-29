import { query, queryOne, tx } from "./db";

export type Item = {
  id: number;
  code: string;
  name: string;
  quantity: number;
  unit: string;
  low_stock: number;
  note: string | null;
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

export type PublicUser = { id: number; name: string; role: "STAFF" | "ADMIN" };

// ข้อผิดพลาดที่อยากส่ง status code กลับไปให้ client
export class AppError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

// ---------- users ----------
export function listPublicUsers(): Promise<PublicUser[]> {
  return query<PublicUser>(
    `select id, name, role from users where active = true order by name`,
  );
}

// ---------- items ----------
export function listItems(): Promise<Item[]> {
  return query<Item>(`select * from items order by name`);
}

export function getItemById(id: number): Promise<Item | null> {
  return queryOne<Item>(`select * from items where id = $1`, [id]);
}

export function getItemByCode(code: string): Promise<Item | null> {
  return queryOne<Item>(`select * from items where code = $1`, [code]);
}

export async function createItem(input: {
  code: string;
  name: string;
  quantity: number;
  unit: string;
  low_stock: number;
  note?: string | null;
}): Promise<Item> {
  const existing = await getItemByCode(input.code);
  if (existing) throw new AppError("รหัส (code) นี้มีอยู่แล้ว", 409);
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
  const clash = await queryOne<{ id: number }>(
    `select id from items where code = $1 and id <> $2`,
    [input.code, id],
  );
  if (clash) throw new AppError("รหัส (code) นี้มีอยู่แล้ว", 409);
  const row = await queryOne<Item>(
    `update items set code=$1, name=$2, unit=$3, low_stock=$4, note=$5, updated_at=now()
     where id=$6 returning *`,
    [input.code, input.name, input.unit, input.low_stock, input.note ?? null, id],
  );
  if (!row) throw new AppError("ไม่พบรายการนี้", 404);
  return row;
}

export async function deleteItem(id: number): Promise<void> {
  const res = await query(`delete from items where id = $1`, [id]);
  // pg ไม่คืน rows จาก delete; ไม่ต้องเช็คก็ได้
  void res;
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
    // ตัดสต็อกเฉพาะเมื่อมีของพอ — กันสต็อกติดลบในคำสั่งเดียว
    const upd = await client.query<Item>(
      `update items set quantity = quantity - $1, updated_at = now()
       where id = $2 and quantity >= $1
       returning *`,
      [qty, itemId],
    );
    if (upd.rowCount === 0) {
      const exists = await client.query<{ quantity: number }>(
        `select quantity from items where id = $1`,
        [itemId],
      );
      if (exists.rowCount === 0) throw new AppError("ไม่พบรายการนี้", 404);
      throw new AppError(
        `สต็อกไม่พอ (คงเหลือ ${exists.rows[0].quantity})`,
        409,
      );
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
       where id = $2 and quantity + $1 >= 0
       returning *`,
      [delta, itemId],
    );
    if (upd.rowCount === 0) {
      const exists = await client.query<{ quantity: number }>(
        `select quantity from items where id = $1`,
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
