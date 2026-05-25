# Progress Log
> อัปเดตล่าสุด: 2026-05-25 (session 5) | session โดย: Claude

## สถานะปัจจุบัน
**Multi-allocation + remaining budget ครบ — 33 tests ผ่าน, TypeScript clean**
commits สุดท้าย: `38e2c0f` (remaining budget) → `aab2cd1` (all campaigns in dropdown) → `d2a6f2c` (multi-allocation schema) → `fef19fa` (fix allocate amount) → `0e6c76e` (fix weekend rates)

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
- [x] fix: BSP คำนวณจาก campaign.dailyBudgetTon เป็นหลัก (ไม่ใช่ entry.dailyBudgetTon)
- [x] fix: CSV import validate NaN rate ก่อน submit — ป้องกัน "Import ล้มเหลว" เมื่อ historical rates ขาดหาย (csv-import.tsx) — แก้กรณี import CSV ตอน budget เก่า แล้วเปลี่ยน budget ใหม่ BSP เพี้ยน (performance-table.tsx + campaign detail page)
- [x] **Wallet System Task 1: Prisma Schema Migration** — ลบ `AppSettings`, เพิ่ม `WalletDeposit` + `CampaignAllocation`, `Campaign` ได้ optional `allocation` relation — migration `20260525000000_wallet_system` applied, 24 tests ผ่าน (commit `6bb9eac`)
- [x] **Wallet System Tasks 4–7: API Routes** — `GET /api/wallet/balance`, `GET+POST /api/wallet/deposits`, `DELETE /api/wallet/deposits/[id]`, `GET+POST+DELETE /api/campaigns/[id]/allocation` — FIFO deposit assignment, 33 tests ผ่าน (commits `04b6a9b`–`95c89e8`)
- [x] **Wallet System Tasks 8–9: UI** — Wallet page (`/wallet`), DepositForm, AllocationCard บน Campaign detail (commits `4ce503d`, `a8fa955`)
- [x] **Wallet System Tasks 10–11: Rate Locking** — EntryForm + CsvImport รับ `allocationRate` prop ล็อค rate จาก deposit (commits `af40343`, `96301be`)
- [x] **Wallet System Tasks 12–14: Integration + Cleanup** — entries/new page ส่ง allocationRate, Dashboard ใช้ computed balance, Settings ลบ wallet card, Nav เพิ่ม Wallet link, ลบ `/api/settings` (commits `0b1ef83`, `4ce5a5a`, `26be88f`)
- [x] **Allocate from Wallet Page** — จัดสรรงบจากหน้า Wallet ได้เลยโดยไม่ต้องไปหน้า Campaign: API POST allocation รับ `depositId` โดยตรง, `AllocateForm` component inline ใน deposit card, WalletClient toggle state, WalletPage fetch unallocated campaigns, Dashboard+CampaignCard แสดงยอดที่จัดสรร (commits `685b286`–`701ecc4`)
- [x] **Wallet Flat-List + allocatedAt** — เพิ่ม `allocatedAt` field ใน CampaignAllocation (schema migration), API expose/accept field, export/import preserve, WalletClient redesign เป็น flat transaction list เรียง desc by date (deposit ↑ เขียว, allocation → แดง), AllocateForm ใหม่มี date picker + ใช้ wallet balance แทน per-deposit max (commits `e57fcc1`–`730ac92`) — browser verified ✅
- [x] **Edit + Delete Allocation** — แก้ไขและลบ allocation ได้จาก wallet page: ปุ่ม "แก้ไข"/"ลบ" ในทุก allocation row, inline edit form พร้อม date picker + amount field (pre-filled, max = balance + allocation เดิม), ไม่มีการเปลี่ยนแปลง API (commit `38e94fa`) — browser verified ✅
- [x] **Campaign Remaining Budget** — แสดง "ใช้ไปแล้ว / คงเหลือ" ใน AllocationCard (campaign detail) และ allocation row (wallet page): คำนวณ SUM(spendTon) ทุก entry, แดงถ้าติดลบ — wallet page ใช้ Prisma groupBy + Map (commit `38e2c0f`)
- [x] **AllocateForm แสดงทุก campaign** — เปลี่ยน query จาก `allocation: null` เป็นทุก campaign พร้อม currentAllocationTon, form แสดง "มีแล้ว X TON" + "ยอดรวมใหม่" (commit `aab2cd1`)
- [x] **Multi-allocation per campaign** — schema migration ลบ `@unique` จาก CampaignAllocation.campaignId, Campaign.allocation → Campaign.allocations[], POST สร้าง record ใหม่เสมอ, edit/delete ใช้ allocation ID ผ่าน `/api/wallet/allocations/[id]`, AllocationCard แสดงยอดรวม + "จัดการใน Wallet →" (commit `d2a6f2c`)
- [x] **fix: AllocateForm ส่ง additional ไม่ใช่ total** — หลัง API เปลี่ยนเป็น CREATE เสมอ ฟอร์มต้องส่งแค่ยอดเพิ่มเติม ไม่ใช่ existingAllocation + additional (commit `fef19fa`)
- [x] **fix: historical rates ขาดเมื่อ range เริ่มวันหยุด** — Frankfurter ไม่มีอัตรา weekend ทำให้ lastThb = 0 สองวันแรก แก้โดย fetch 7 วันก่อน from เพื่อ seed ค่าก่อนเข้า loop (commit `0e6c76e`)

## กำลังทำ / ค้างอยู่
(ไม่มี — Wallet System ครบทุก task)

## ขั้นตอนถัดไป
- ระบบพร้อม deploy
- Feature ถัดไปตามความต้องการ

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
- 2026-05-24: BSP ใช้ campaign.dailyBudgetTon เป็น primary — เหตุผล: single-user, campaign budget คือ "target" ที่ถูกต้องเสมอ, เปลี่ยน budget = เปลี่ยน target ทั้ง campaign

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
- CampaignAllocation เคยเป็น @unique campaignId — เปลี่ยนเป็น @index แล้ว (multi-allocation) ระวัง code เก่าที่ใช้ `campaign.allocation` (singular) ต้องเปลี่ยนเป็น `campaign.allocations[]`
- Frankfurter API ไม่มีอัตราวันหยุดสุดสัปดาห์/นักขัตฤกษ์ — ต้อง seed lastThb จากวันก่อน from เสมอ ไม่งั้น weekend range start ขาด rate 2 วัน
