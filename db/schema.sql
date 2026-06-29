-- โครงสร้างฐานข้อมูล QR-Store (PostgreSQL)
-- รันด้วย: npm run db:init

create table if not exists users (
  id         serial primary key,
  name       text        not null,
  pin_hash   text        not null,
  role       text        not null default 'STAFF', -- STAFF | ADMIN
  active     boolean     not null default true,
  created_at timestamptz not null default now()
);

create table if not exists items (
  id         serial primary key,
  code       text        not null unique,          -- payload ที่ฝังใน QR
  name       text        not null,
  quantity   integer     not null default 0,
  unit       text        not null default 'ชิ้น',
  low_stock  integer     not null default 0,        -- เกณฑ์เตือน "ใกล้หมด"
  note       text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists movements (
  id         serial primary key,
  item_id    integer     not null references items(id) on delete cascade,
  user_id    integer     not null references users(id),
  delta      integer     not null,                  -- เบิก = ค่าลบ, เติม = ค่าบวก
  type       text        not null,                  -- WITHDRAW | RESTOCK | ADJUST
  note       text,
  created_at timestamptz not null default now()
);

create index if not exists movements_created_idx on movements (created_at desc);
create index if not exists movements_item_idx on movements (item_id);
create index if not exists movements_user_idx on movements (user_id);
