# Progress Log
> อัปเดตล่าสุด: 2026-05-24 | session โดย: Claude

## สถานะปัจจุบัน
Fragment Wallet Balance + Per-Campaign Budget Display เสร็จสมบูรณ์ — 24 tests ผ่าน, TypeScript clean
commits: `f394e27` → `1245c17`

## เสร็จแล้ว
- [x] Init project: Next.js 16 + Prisma + PostgreSQL + Auth (JWT, single password)
- [x] Docker + EasyPanel deployment configuration
- [x] Fix Prisma v6 + Docker runner issues (copy node_modules, migrate path)
- [x] เพิ่ม `placementName` field + merge targetType/targetName เป็น input เดียว
- [x] แสดง "Startbot" label สำหรับ BOT campaigns แทน Joins (card + table)
- [x] CSV import สำหรับ bulk performance entries
- [x] ย้าย `dailyBudgetTon` ไปอยู่ระดับ Campaign + auto pre-fill ลง entry form
- [x] ขยาย AGENTS.md ด้วย project context + กฎ session/progress + AI behavior rules
- [x] CSV import: รองรับหลายไฟล์พร้อมกัน (multiple file select)
- [x] CSV parser: auto-detect tab/comma delimiter (Telegram Ads export เป็น TSV)
- [x] CSV import: support billing file (Amount TON, comma-decimal) + auto-merge กับ performance file by date
- [x] CSV import: skip "Total" row, fix UTC timezone bug ใน date parsing
- [x] Historical rates: ดึง TON/USD (CryptoCompare) + USD/THB (Frankfurter) รายวันอัตโนมัติ 2 API calls ต่อ import
- [x] ซ่อน Impressions column ทุกที่ (Telegram Ads ไม่มีข้อมูลนี้)
- [x] CTR/CPM ใช้ Views เป็นฐานแทน Impressions
- [x] เพิ่ม CR, CPC, CPS columns ในตาราง
- [x] Redesign performance table: เรียง Views→Clicks→Joins→Spend→฿→stats, CPC/CPS/CPM เป็น ฿
- [x] Metric cards (summary): CPC/CPS/CPM เป็น ฿
- [x] `dailyBudgetTon` เป็น primary required field ใน Campaign (schema migration)
- [x] `budgetTon` เปลี่ยนเป็น optional
- [x] Campaign card: progress bar ใช้ avg BSP จาก entries จริง
- [x] Performance table: จัดกลุ่มรายเดือน + summary row ท้ายแต่ละเดือน
- [x] BSP fix: entries ที่ import โดยไม่มี dailyBudgetTon ใช้ campaign.dailyBudgetTon เป็น fallback
- [x] BSP color scale: แดง (0%) → เหลือง (50%) → เขียว (100%) ทั้งในตารางรายวัน, summary รายเดือน, และ metric card
- [x] **fix: BSP 0.0% บน campaign card** — `campaign-card.tsx` ขาด fallback `|| campaignDailyBudget` (commit `99aa461`)
- [x] fix: JWT_SECRET ใน .env local สั้น 31 ตัว (ต้องการ ≥32) ทำให้ login ไม่ได้ใน local dev
- [x] fix: DATABASE_URL ใน .env local ชี้ไป postgres user ที่ไม่มี — เปลี่ยนเป็น `wolfy@localhost`
- [x] **Monthly Accordion Performance Table** — `performance-table.tsx` เป็น Client Component + useState accordion (commit `0bae611`)
- [x] fix: serialize Prisma Decimal/Date ก่อนส่งไป Client Component ใน campaign detail page (commit `95d5430`)
- [x] feat: แสดง Views/Clicks/Joins รวมรายเดือนใน collapsed header ด้วย (commit `930d879`)
- [x] Edit + Delete PerformanceEntry — edit page `/entries/[id]/edit`, PATCH + DELETE API, action buttons ใน PerformanceTable
- [x] Fragment Wallet Balance — AppSettings model, `/api/settings` GET+PUT, Settings page input, Dashboard wallet card (balance/burn rate/วันคงเหลือ), Campaign card total budget progress bar, export/import backward compat

## กำลังทำ / ค้างอยู่
(ไม่มี)

## ขั้นตอนถัดไป
1. (feature ถัดไปตามที่ต้องการ — weekly view ไว้ทำ phase ถัดไป)

## Decision log
- 2026-05-11: ใช้ single-password auth + JWT cookie แทน NextAuth — ระบบใช้คนเดียว ไม่ต้องการ multi-user
- 2026-05-11: ใช้ Prisma Decimal(18,8) สำหรับ TON amount — หลีกเลี่ยง floating point error
- 2026-05-20: merge targetType + targetName เป็น input เดียว — ลด UX friction
- 2026-05-21: dailyBudgetTon อยู่ระดับ Campaign แล้ว pre-fill ลง entry — ข้อมูล Campaign เป็นต้นทาง
- 2026-05-22: CTR/CPM ใช้ Views ไม่ใช่ Impressions — Telegram Ads ไม่ expose Impressions
- 2026-05-22: Historical rates ใช้ CryptoCompare + Frankfurter (ฟรี ไม่ต้อง API key ใหม่) — 2 calls ต่อ import
- 2026-05-22: BSP fallback ใช้ campaign.dailyBudgetTon แทนการ migrate data เก่า — non-destructive fix
- 2026-05-22: swap budgetTon/dailyBudgetTon nullability — dailyBudgetTon required, budgetTon optional
- 2026-05-22: BSP color ใช้ HSL interpolation (hue 0°→120°) — ไม่ใช้ Tailwind class เพราะ dynamic value ไม่ work ใน production build
- 2026-05-23: monthly accordion ใช้ Client Component + useState<Set<string>> — ไม่เก็บ state ใน URL เพราะไม่จำเป็น
- 2026-05-23: weekly view เลื่อนไปทำ phase ถัดไป — monthly accordion ก่อน ลด complexity
- 2026-05-24: ต้อง serialize Decimal/Date จาก Prisma ก่อนส่งไป Client Component — Next.js 19 ไม่อนุญาต non-plain objects ข้าม Server/Client boundary
- 2026-05-24: AppSettings ใช้ id=1 fixed row (singleton pattern) — ไม่มี multi-row settings
- 2026-05-24: walletBalanceTon = 0 → ซ่อน wallet card บน Dashboard, แสดงเมื่อ > 0 เท่านั้น
- 2026-05-24: burn rate 7d = avg daily spend จาก entries ที่มีวันที่อยู่ใน 7 วันล่าสุด ÷ 7

## ปัญหา / ข้อควรระวังที่เจอ
- Prisma v6 ใน Docker: ต้อง copy `node_modules` ทั้งหมดไปยัง runner stage และใช้ `PRISMA_CLIENT_ENGINE_TYPE=library` ตอน build
- Decimal จาก Prisma: ต้อง `Number(value)` ก่อนคำนวณทุกครั้ง ไม่งั้น arithmetic ผิด
- Next.js 16 มี breaking changes — อ่าน `node_modules/next/dist/docs/` ก่อนเขียนโค้ดเสมอ
- Telegram Ads CSV เป็น TSV (tab-separated) ไม่ใช่ comma — ต้อง auto-detect delimiter
- Billing file ใช้ comma เป็น decimal separator (`1,339` = 1.339 TON) — European format
- "Total in May 2026" row ใน billing file ถูก JS parse เป็น date — ต้อง skip ด้วย regex
- UTC timezone bug: `new Date('1 May 2026').toISOString()` ให้วันผิดใน UTC+7 — ใช้ `getFullYear/getMonth/getDate` แทน
- schema change ที่ทำ nullable field ต้องตรวจ TypeScript ทุกไฟล์ที่ใช้ field นั้น (budgetTon.toString() → budgetTon?.toString())
- CoinGecko market_chart/range ใช้ไม่ได้บน free tier สำหรับ date range ที่ต้องการ — ใช้ CryptoCompare histoday แทน
- local .env: JWT_SECRET ต้องมี ≥32 ตัวอักษร และ DATABASE_URL ต้องใช้ user ที่มีจริงใน local PostgreSQL
