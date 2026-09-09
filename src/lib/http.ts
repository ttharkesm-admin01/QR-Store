import { NextResponse } from "next/server";
import { AppError } from "./data";

// คืน error ให้ client อย่างปลอดภัย — ใช้ในทุก catch ของ API route
// ❗ ห้ามส่ง err.message ของ error ที่ไม่ใช่ AppError ออกไปตรง ๆ:
// error จาก pg มีข้อความภายใน (เช่น `value "3000000000" is out of range for type integer`)
// ที่รั่วโครงสร้าง DB และผู้ใช้อ่านไม่รู้เรื่อง — log ฝั่ง server แล้วคืนข้อความกลางแทน
export function errorJson(tag: string, err: unknown, fallback: string) {
  if (err instanceof AppError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  console.error(`[${tag}] error ไม่คาดคิด:`, (err as Error)?.message ?? err);
  return NextResponse.json({ error: fallback }, { status: 500 });
}

// id ที่มาจาก URL param — `Number("abc")` = NaN ถ้าปล่อยไปถึง pg
// จะได้ `invalid input syntax for type integer: "NaN"` เป็น 500 แทนที่จะเป็น 400
export function parseId(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError("รหัสรายการไม่ถูกต้อง", 400);
  }
  return id;
}
