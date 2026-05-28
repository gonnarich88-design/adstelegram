# Daily Conversions Feature — Design Spec
> วันที่: 2026-05-28

## Overview

เพิ่มการติดตาม downstream conversion metrics รายวัน ได้แก่ จำนวนสมาชิกใหม่และจำนวน/ยอดฝากเงินจริง โดยรวมทุก campaign ไว้ในระดับ business-wide aggregate พร้อมคำนวณ CPR/CPD จากข้อมูล ad spend ของแต่ละวัน

## Data Model

### ตารางใหม่: `DailyConversion`

```prisma
model DailyConversion {
  id                String   @id @default(cuid())
  date              DateTime @db.Date
  registrations     Int
  depositCount      Int
  depositAmountThb  Decimal  @db.Decimal(18, 2)
  note              String?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@unique([date])
}
```

- `date @unique` — 1 record ต่อ 1 วัน เท่านั้น
- ไม่มี relation กับ Campaign — เป็นข้อมูลระดับ business รวมทุก campaign
- `depositAmountThb` เก็บ THB เท่านั้น, precision 18,2 (ทศนิยม 2 ตำแหน่ง)

### Computed Fields (ไม่เก็บใน DB)

คำนวณ ณ query time โดย join กับ `PerformanceEntry` ของวันเดียวกัน:

```
dailyAdSpendThb = SUM(entry.spendTon × entry.tonPriceUsd × entry.usdThbRate)
                  สำหรับทุก entry ที่ date ตรงกัน

CPR (Cost per Registration) = dailyAdSpendThb / registrations
CPD (Cost per Depositor)    = dailyAdSpendThb / depositCount
```

- ถ้าวันนั้นไม่มี PerformanceEntry → CPR/CPD แสดงเป็น `—`
- ถ้า registrations = 0 หรือ depositCount = 0 → แสดง `—` (หลีกเลี่ยง ÷0)

---

## หน้า `/conversions`

### Layout

```
[Nav: Dashboard | Campaigns | Wallet | Conversions]

┌─ บันทึกรายวัน ────────────────────────────────────┐
│  [วันที่*] [สมัคร (คน)*] [ฝาก (คน)*] [ฝาก (฿)*]  │
│  [หมายเหตุ (optional)]          [+ บันทึก]        │
└──────────────────────────────────────────────────┘

┌─ ตาราง ────────────────────────────────────────────┐
│ วันที่ | สมัคร | ฝาก(คน) | ฝาก(฿) | CPR | CPD | ⋮ │
│ ...    │  42   │   18    │ ฿54K   │฿180 │฿420 │✎✕│
└──────────────────────────────────────────────────┘
```

### Form (Client Component)

- `date`: date picker, default = วันนี้
- `registrations`: number input, required, min = 0
- `depositCount`: number input, required, min = 0
- `depositAmountThb`: number input, required, min = 0
- `note`: text input, optional
- Submit → POST `/api/conversions`
- ถ้าวันนั้นมีข้อมูลแล้ว → API คืน 409 + แสดง error "มีข้อมูลวันนี้แล้ว กรุณาแก้ไขแทน"
- หลัง submit สำเร็จ → reset form (date = วันนี้, ค่าอื่น = ว่าง) + refresh ตาราง

### ตาราง

- เรียงจากใหม่ → เก่า
- คอลัมน์: วันที่, สมัคร, ฝาก(คน), ฝาก(฿), CPR(฿), CPD(฿), actions
- actions: ปุ่มแก้ไข + ลบ ในแต่ละ row (inline edit เหมือน PerformanceEntry)
- inline edit: แสดง input fields แทน text ใน row เดียวกัน (เหมือน WalletDeposit), save/cancel

### API Routes

```
GET    /api/conversions          → list ทั้งหมด (+ join ad spend per date)
POST   /api/conversions          → สร้าง record ใหม่ (409 ถ้า date ซ้ำ)
PATCH  /api/conversions/[id]     → แก้ไข
DELETE /api/conversions/[id]     → ลบ
```

### Page component

- Server Component: ดึง DailyConversion ทั้งหมด + aggregate spendThb ต่อวันจาก PerformanceEntry
- ส่ง serialized data ไป Client Component สำหรับ form/table interaction
- `export const dynamic = 'force-dynamic'`

---

## Dashboard — Conversion Strip

### ตำแหน่ง

วางระหว่าง Hero Summary Bar กับ WoW Strip:

```
[Hero Bar: Spend | Views | Clicks | Joins | Campaigns]
[Conversion Strip]   ← ใหม่
[WoW Strip]
[Campaign Leaderboard]
```

### เนื้อหา Strip (30 วันล่าสุด = date >= วันนี้ - 30 วัน)

```
● Conversions (30 วัน)
┌──────────┬─────────────────┬───────────┬───────────┐
│สมัครสมาชิก│    ฝากเงิน      │    CPR    │    CPD    │
│  1,240   │ 487 คน · ฿1.2M │   ฿180    │   ฿458    │
│   คน     │                 │  /สมัคร   │   /ฝาก   │
└──────────┴─────────────────┴───────────┴───────────┘
```

- ซ่อน strip อัตโนมัติถ้าไม่มี DailyConversion records เลย (เหมือน Wallet card)
- CPR/CPD ใช้ total ad spendThb 30 วัน / total registrations หรือ depositCount ของ 30 วันเดียวกัน
- ถ้า registrations = 0 หรือ depositCount = 0 ใน 30 วัน → แสดง `—`

---

## Navigation

เพิ่ม link "Conversions" ใน `nav.tsx` หลัง "Wallet":

```
Dashboard | Campaigns | Wallet | Conversions
```

---

## Export / Import

เพิ่ม `DailyConversion` records ใน JSON backup:
- `export.ts`: include `dailyConversions: DailyConversion[]`
- `importData`: upsert by date (backward compat: ถ้า field ขาด default = 0)

---

## Scope ที่ไม่รวม (YAGNI)

- ไม่รองรับ CSV import (manual entry เท่านั้น)
- ไม่แยก conversion ต่อ campaign
- ไม่มี WoW comparison สำหรับ conversions บน Dashboard
- ไม่มี chart/trend สำหรับ conversions

---

## Migration

```sql
-- migration name: add_daily_conversions
CREATE TABLE "DailyConversion" (
  "id" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "registrations" INTEGER NOT NULL,
  "depositCount" INTEGER NOT NULL,
  "depositAmountThb" DECIMAL(18,2) NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DailyConversion_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DailyConversion_date_key" ON "DailyConversion"("date");
```

ไม่กระทบตาราง/ข้อมูลเดิม — migration ปลอดภัย (additive only)
