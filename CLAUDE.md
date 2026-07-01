# CLAUDE.md — QR-Store

ระบบสแกน QR เพื่อเบิกของ + ตัดสต็อกอัตโนมัติ สำหรับห้องเก็บของขนาดเล็ก (ของ <50 รายการ)
UI ภาษาไทย เปิดผ่านมือถือได้ (PWA) deploy บน Vercel + Neon (Postgres)

## หลักการพัฒนา (จาก andrej-karpathy-skills)
- **Simplicity First**: เขียนเท่าที่จำเป็น ไม่ใส่ฟีเจอร์เผื่ออนาคต
- **Surgical Changes**: แก้เฉพาะที่โยงกับ requirement ตรง ๆ
- **Verify**: ทุกการแก้ต้อง build ผ่าน + ทดสอบ flow จริงผ่าน HTTP ก่อน push

## Stack
- Next.js 16 (App Router, TypeScript) + Tailwind CSS v4
- PostgreSQL ผ่าน `pg` (SQL ตรง ไม่มี ORM) — ตารางสร้างอัตโนมัติด้วย `ensureSchema()`
- `html5-qrcode` (อ่าน QR) · `qrcode` (สร้าง QR)
- Auth: PIN hash ด้วย scrypt + session เป็น cookie เซ็น HMAC (ใช้ `node:crypto` ล้วน)

## โครงสร้าง
```
src/lib/schema.ts   DDL (แหล่งความจริงเดียว) — ใช้โดย ensureSchema()
src/lib/db.ts       pg Pool + query/queryOne/tx + ensureSchema()
src/lib/auth.ts     hashPin/verifyPin, session cookie, requireSession/requireAdmin
src/lib/data.ts     ตรรกะ item/user/movement (withdraw แบบ atomic, soft-delete)
src/app/            setup, login, /(dashboard), scan, items, users, history + api/*
src/components/      Nav, QrScanner, LogoutButton
```
ตาราง: `users` (name, pin_hash, role STAFF|ADMIN, active) · `items` (code, name, quantity, unit, low_stock, active) · `movements` (item_id, user_id, delta, type WITHDRAW|RESTOCK|ADJUST)

## ⚠️ Gotchas สำคัญ (เคยเจอจริง อย่าทำพัง)
1. **pg Pool ต้องมี `pool.on('error')`** — Neon ตัด idle connection ทิ้ง; ถ้าไม่มี handler
   Node จะถือเป็น uncaught exception → **serverless ล่ม → "This page couldn't load"** (ล่มเป็นบางครั้ง)
   ตั้ง `max` ต่ำ (~3), `idleTimeoutMillis`, และ cache pool บน globalThis ทั้ง dev/prod
2. **QR ต้องเข้ารหัสเป็น URL** `${origin}/scan?code=<code>` (origin จาก request headers)
   ไม่ใช่รหัสล้วน — เพื่อให้กล้องปกติของมือถือสแกนแล้วเปิดเข้าแอปได้
3. **html5-qrcode live camera ทำ Safari iPhone ล่ม** — วิธีหลักคือ deep-link (ข้อ 2) +
   โหมด "ถ่ายรูป QR" (`<input capture>` + `scanFile`) ไม่ใช้ video stream; live camera เป็น opt-in
   ⚠️ `scanner.stop()`/`clear()` **throw แบบ synchronous** ถ้ากล้องไม่ได้กำลังทำงาน
   ("Cannot stop, scanner is not running or paused.") — `.catch()` ดักไม่ทัน ต้องครอบ `try/catch`
   (ดู `safeStop()` ใน QrScanner.tsx) ไม่งั้น throw หลุดไปทำทั้งหน้าเว็บพัง
4. **SESSION_SECRET ไม่บังคับ** — ถ้าไม่ตั้ง `secret()` จะ derive จาก `DATABASE_URL` (เสถียร/เดายาก)
   ห้ามให้ `secret()` throw หรือ `getSession()` throw — จะทำหน้าเว็บพัง ("โหลดหน้าไม่สำเร็จ");
   `getSession()` ต้อง try/catch คืน null เสมอเมื่ออ่านไม่สำเร็จ
5. **Soft-delete items** (`active` + partial unique index `on items(code) where active`) —
   ห้ามลบจริง/CASCADE ไม่งั้นประวัติการเบิก (movements) หาย; FK เป็น `on delete restrict`
6. **searchParams อาจเป็น `string[]`** (พารามิเตอร์ซ้ำ) — ต้อง normalize ก่อน `.trim()`/`.startsWith()` (ไม่งั้น 500)
7. **`next` redirect กัน open-redirect**: อนุญาตเฉพาะ `^/(?![/\\])` (กัน `//evil`, `/\evil`)
8. **ห้ามใช้ `next/font/google`** — ดึงฟอนต์ตอน build ทำ build ล่มในเน็ตจำกัด; ใช้ system font
9. **withdraw/adjust ต้อง atomic** — `update ... where quantity >= $qty returning *` ในทรานแซกชันเดียว กันสต็อกติดลบ

## Deploy (cloud-only, ไม่ต้องรันในเครื่อง)
- Neon: สร้าง DB → เอา connection string (pooled, `?sslmode=require`)
- Vercel: import repo (branch `main`) → ตั้ง env `DATABASE_URL` + `SESSION_SECRET` → Deploy
- เปิดลิงก์ → หน้า `/setup` สร้าง admin คนแรก (atomic, ใช้ได้ครั้งเดียว) → เมนู "ผู้ใช้" เพิ่ม staff
- ตารางสร้างอัตโนมัติตอนรันครั้งแรก (ไม่มี migration script)

## รัน/ทดสอบในเครื่อง (dev)
```bash
cp .env.example .env      # DATABASE_URL (Postgres local/Neon) + SESSION_SECRET
npm install
npm run build             # ต้องผ่านก่อน push (type-check + lint)
npm run dev               # แล้วไป /setup
```
ทดสอบ flow จริง: รัน `npm run start` แล้วยิง HTTP (fetch + cookie jar) — login/lookup/withdraw/history
สแกนกล้องทดสอบยาก → ใช้ deep-link `/scan?code=X` หรือช่องกรอกรหัสเองแทน

## Git / PR
- พัฒนาบน branch `claude/qr-code-inventory-system-8m8bn9`, base คือ `main`
- ยังไม่มี CI/GitHub Actions ในรีโป — ตรวจด้วย `npm run build` + smoke test เอง
- Vercel auto-deploy เมื่อ push/merge เข้า `main`
