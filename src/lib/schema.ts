// แหล่งความจริงเดียวของโครงสร้างฐานข้อมูล
// ใช้โดย ensureSchema() ใน db.ts เพื่อสร้างตารางอัตโนมัติตอนรันครั้งแรก (ไม่ต้องรันสคริปต์ในเครื่อง)
export const SCHEMA_SQL = `
create table if not exists users (
  id         serial primary key,
  name       text        not null,
  pin_hash   text        not null,
  role       text        not null default 'STAFF',  -- STAFF | ADMIN
  active     boolean     not null default true,
  created_at timestamptz not null default now()
);

create table if not exists items (
  id         serial primary key,
  code       text        not null,
  name       text        not null,
  quantity   integer     not null default 0,
  unit       text        not null default 'ชิ้น',
  low_stock  integer     not null default 0,
  note       text,
  active     boolean     not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- code ต้องไม่ซ้ำ "เฉพาะรายการที่ยังใช้งานอยู่" (รายการที่ archive แล้วเก็บ code เดิมไว้ได้)
create unique index if not exists items_code_active_uk on items (code) where active;

create table if not exists movements (
  id         serial primary key,
  item_id    integer     not null references items(id) on delete restrict,
  user_id    integer     not null references users(id) on delete restrict,
  delta      integer     not null,   -- เบิก = ค่าลบ, เติม = ค่าบวก
  type       text        not null,   -- WITHDRAW | RESTOCK | ADJUST
  note       text,
  created_at timestamptz not null default now()
);

create index if not exists movements_created_idx on movements (created_at desc);
create index if not exists movements_item_idx on movements (item_id);
create index if not exists movements_user_idx on movements (user_id);
`;
