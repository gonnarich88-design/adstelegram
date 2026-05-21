# Progress Log
> อัปเดตล่าสุด: 2026-05-21 19:53 | session โดย: Claude

## สถานะปัจจุบัน
Core features ครบพร้อมใช้งาน: สร้าง/แก้ Campaign, บันทึก PerformanceEntry รายวัน, import CSV, export CSV, auth ด้วย JWT
งาน infra (Docker, deployment) เสร็จแล้ว และ deploy บน EasyPanel ได้
ไม่มีงานค้างในขณะนี้ — พร้อมรับ feature ใหม่

## เสร็จแล้ว
- [x] Init project: Next.js 16 + Prisma + PostgreSQL + Auth (JWT, single password)
- [x] Docker + EasyPanel deployment configuration
- [x] Fix Prisma v6 + Docker runner issues (copy node_modules, migrate path)
- [x] เพิ่ม `placementName` field + merge targetType/targetName เป็น input เดียว
- [x] แสดง "Startbot" label สำหรับ BOT campaigns แทน Joins
- [x] CSV import สำหรับ bulk performance entries
- [x] ย้าย `dailyBudgetTon` ไปอยู่ระดับ Campaign + auto pre-fill ลง entry form
- [x] ขยาย AGENTS.md ด้วย project context + กฎ session/progress

## กำลังทำ / ค้างอยู่
- (ไม่มี)

## ขั้นตอนถัดไป
1. (กำหนดเมื่อมี requirement ใหม่)

## Decision log
- 2026-05-11: ใช้ single-password auth + JWT cookie แทน NextAuth — ระบบใช้คนเดียว ไม่ต้องการ multi-user
- 2026-05-11: ใช้ Prisma Decimal(18,8) สำหรับ TON amount — หลีกเลี่ยง floating point error
- 2026-05-20: merge targetType + targetName เป็น input เดียว — ลด UX friction
- 2026-05-21: dailyBudgetTon อยู่ระดับ Campaign แล้ว pre-fill ลง entry — ข้อมูล Campaign เป็นต้นทาง

## ปัญหา / ข้อควรระวังที่เจอ
- Prisma v6 ใน Docker: ต้อง copy `node_modules` ทั้งหมดไปยัง runner stage และใช้ `PRISMA_CLIENT_ENGINE_TYPE=library` ตอน build
- Decimal จาก Prisma: ต้อง `Number(value)` ก่อนคำนวณทุกครั้ง ไม่งั้น arithmetic ผิด
- Next.js 16 มี breaking changes — อ่าน `node_modules/next/dist/docs/` ก่อนเขียนโค้ดเสมอ
