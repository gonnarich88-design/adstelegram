# Dashboard Redesign — Aggregate Overview + Campaigns Page

**Date:** 2026-05-27
**Status:** Approved

---

## Goal

แยก Dashboard ออกจาก Campaign list ให้ชัดเจน:
- `/` (Dashboard) = ข้อมูลรวมทุกแคมเปญ — KPI aggregate + trend chart
- `/campaigns` (ใหม่) = รายการแคมเปญทั้งหมด

---

## Architecture

### Files Changed (5 files)

| File | Change |
|------|--------|
| `src/app/page.tsx` | Rewrite — ตัด campaign grid ออก, เพิ่ม KPI cards + chart data prep |
| `src/app/campaigns/page.tsx` | **New** — ย้าย campaign grid มาจาก page.tsx |
| `src/components/nav.tsx` | เปลี่ยน `+ Campaign → /campaigns/new` เป็น `Campaigns → /campaigns`, แก้ active state |
| `src/components/dashboard-chart.tsx` | **New** — Client Component, recharts AreaChart + LineChart dual Y-axis |
| `package.json` | เพิ่ม `recharts` |

---

## Dashboard Page (`/`)

### Layout (top to bottom)

1. **Header row** — "Dashboard" heading (ไม่มีปุ่ม + Campaign แล้ว)

2. **Wallet Card** (unchanged) — แสดงเฉพาะเมื่อ `walletBalance > 0`
   - TON balance | 1 TON = $X / ฿X rate
   - Burn rate (7d avg) | วันคงเหลือ (สี: แดง ≤7, เหลือง ≤14, เขียว >14)

3. **KPI Row — 5 cards**

   | Card | Value | Sub |
   |------|-------|-----|
   | Total Spend | `X.XX TON` | `≈ ฿X,XXX` |
   | Total Joins | `X,XXX` | รวม CHANNEL + BOT |
   | Campaigns | `X Active` | `X ทั้งหมด` |
   | Avg CTR | `X.XX%` | `X,XXX views` |
   | Avg CPS | `฿X.XX` | cost per join/startbot |

   แสดงเสมอ — ถ้าไม่มี entries: Spend = "0.00 TON", Joins = "0", CTR = "0.00%", CPS = "—", Campaigns count ยังแสดงปกติ

4. **Trend Chart** — แสดงเมื่อมี entries
   - Toggle: `[7d]` `[30d]` `[ทั้งหมด]` — Client Component state
   - X-axis: วันที่
   - Y-axis ซ้าย: Daily Spend (TON) — Area chart, สีน้ำเงิน
   - Y-axis ขวา: Daily Joins — Line chart, สีเขียว
   - Empty state: "ยังไม่มีข้อมูล performance" ถ้า chartData ว่าง

5. **Empty state (ไม่มี campaigns เลย)** — "ยังไม่มีข้อมูล ไปที่ Campaigns เพื่อเริ่มต้น" + link ไป `/campaigns`

### Data Computation (Server Component)

```
allEntries = campaigns.flatMap(entries) พร้อม date field

chartData = group allEntries by date → { date, spendTon: sum, joins: sum }
  - เรียง asc by date
  - filter ตาม range ที่เลือก (ทำใน Client Component จาก chartData ทั้งหมด)

KPI = calcAggregateMetrics(allEntries) — ใช้ function เดิม
```

Server Component ส่ง `chartData` ทั้งหมดไป Client Component — Client ทำ filter range เอง (ไม่ต้อง re-fetch)

### Auto-stop Logic

คงไว้ใน `/` page เท่านั้น (ไม่ duplicate ไป `/campaigns`)

---

## Campaigns Page (`/campaigns`) — New

### Layout

```
[ Campaigns ]                        [ + Campaign ]

[ CHANNEL · N ]
  grid 1/2/3 cols

[ BOT · N ]
  grid 1/2/3 cols

[ empty state: "ยังไม่มี campaign" + "+ สร้าง campaign แรก" ]
```

### Data

- เหมือน `page.tsx` เดิม ยกเว้น: ไม่มี wallet, ไม่มี summary, ไม่มี auto-stop
- `export const dynamic = 'force-dynamic'`

---

## Dashboard Chart Component (`dashboard-chart.tsx`)

```
'use client'

Props:
  chartData: { date: string; spendTon: number; joins: number }[]

State:
  range: '7d' | '30d' | 'all'  (default: '30d')

Behavior:
  - filter chartData ตาม range ก่อน render
  - '7d' → 7 วันล่าสุด
  - '30d' → 30 วันล่าสุด
  - 'all' → ทั้งหมด

Chart:
  - ComposedChart (recharts) — รองรับ Area + Line ใน component เดียว
  - AreaChart = spendTon (Y-axis ซ้าย)
  - LineChart = joins (Y-axis ขวา)
  - Responsive container width 100%
  - Tooltip แสดงทั้ง spend + joins
```

---

## Nav Changes

```typescript
// เดิม
{ href: '/campaigns/new', label: '+ Campaign' }

// ใหม่
{ href: '/campaigns', label: 'Campaigns' }

// active state — เดิม
pathname === l.href

// active state — ใหม่ (สำหรับ Campaigns link เท่านั้น)
l.href === '/campaigns'
  ? pathname.startsWith('/campaigns')
  : pathname === l.href
```

---

## Dependencies

- `recharts` — เพิ่มใน dependencies, รองรับ React 19 (`^19.0.0` ใน peer deps)
- ไม่มี dependency อื่นใหม่

---

## Out of Scope

- ไม่เปลี่ยน CampaignCard component
- ไม่เปลี่ยน API routes ใดๆ
- ไม่เปลี่ยน Prisma schema
- Weekly aggregation view (เป็น future feature)

---

## Constraints

- recharts ต้องเป็น Client Component เท่านั้น
- Server Component ส่งข้อมูลผ่าน props — ห้าม fetch ใน Client
- `export const dynamic = 'force-dynamic'` ทุก page ที่ query DB
- `chartData[].date` ต้องเป็น `string` (ISO format) ก่อนส่งไป Client — Next.js 19 ไม่อนุญาต `Date` object ข้าม Server/Client boundary
