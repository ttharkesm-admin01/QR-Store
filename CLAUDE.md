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
- ❗ **ไม่ได้ใช้**: Prisma, ORM, JWT/jsonwebtoken, bcrypt, NextAuth, JWT_SECRET, NEXTAUTH_* — อย่าเข้าใจผิด
  (คน/AI มักเดาว่าใช้ของพวกนี้ — ยืนยันด้วย `grep` ก่อนเสมอ)

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
2. **QR เข้ารหัสเป็น URL เสมอ** (origin จาก request headers ไม่ใช่รหัสล้วน) — เพื่อให้กล้องมือถือเปิดแอปได้
   - **หลัก**: QR รวมอันเดียว `/qr` เข้ารหัส `${origin}/scan` → สแกนแล้ว **เลือกรายการจากลิสต์เอง**
     (พนักงานไม่อยากติด QR ทุกชิ้น) — `/scan` (ไม่มี ?code) แสดง item picker + ค้นหา
   - **เสริม**: QR รายชิ้น `/items/[id]/qr` เข้ารหัส `${origin}/scan?code=<code>` → auto-lookup รายการนั้น
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
10. **ทุก API route ครอบ `try/catch` คืน `{ error }` JSON** (ไม่ปล่อย 500 ดิบ) — `/api/auth/login`
    มี log บอกสาเหตุ 401 ฝั่ง server: `[login] 401: PIN ไม่ถูกต้อง` vs `ไม่พบผู้ใช้` vs `สำเร็จ`
    (log userId/ชื่อได้ **แต่ห้าม log PIN/รหัสผ่าน**)
11. **SSL WARNING ของ pg = ไม่กระทบการทำงาน** — `db.ts` ตัด `sslmode` ออกจาก connection string
    แล้วคุม SSL ผ่าน option (`ssl:{rejectUnauthorized:false}` เมื่อไม่ใช่ localhost) เพื่อลบ warning
    (การตัดด้วย `new URL()` ปลอดภัย: pg percent-decode รหัสผ่านกลับเท่าเดิม)

## 🐛 Debug อาการยอดฮิต (map อาการ → สาเหตุ)
- **"This page couldn't load" (error ดิบเบราว์เซอร์)** = serverless ล่ม → เช็ค pg pool `on('error')` (ข้อ 1)
- **"โหลดหน้าไม่สำเร็จ" (error boundary เรา)** = หน้า throw ตอน render → เช็ค `getSession`/`secret` (ข้อ 4)
  หรือ client throw (เช่น `scanner.stop()` ข้อ 3) — ดู Browser Console (F12) ให้เห็น error จริง
- **login 401** = **PIN ที่กรอกไม่ตรง (ปกติ ไม่ใช่บั๊ก)** — ยืนยันจาก Vercel log `[login]`
- หลัง deploy แล้วยังพัง = **แคช JS เก่า** → hard refresh (Ctrl+Shift+R) / InPrivate

## Deploy (cloud-only, ไม่ต้องรันในเครื่อง)
- Neon: สร้าง DB → เอา connection string (แนะนำ **pooled**, host มี `-pooler`)
- Vercel: import repo (branch `main`) → ตั้ง env **`DATABASE_URL` ตัวเดียวพอ** (`SESSION_SECRET` optional) → Deploy
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
