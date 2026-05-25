# Campaign CPM Bid — Design Spec
> วันที่: 2026-05-26

## Overview

เพิ่ม field `bidCpmTon` บน Campaign เพื่อบันทึก CPM bid ที่ตั้งใน Telegram Ads Platform (หน่วย TON ต่อ 1,000 impressions) และแสดง estimated impressions รายวันจาก bid × daily budget

## Data Model

### Schema Change

```prisma
model Campaign {
  // ... existing fields ...
  bidCpmTon      Decimal?  @db.Decimal(18, 8)   // TON per 1,000 impressions
}
```

- **nullable** ใน DB — campaigns เก่าไม่มีค่า migration ผ่านได้
- required ใน UI form ทุกครั้งที่สร้างหรือแก้ไข campaign (ทั้ง new และ edit)
- campaigns เก่าที่ยังไม่เคย edit จะเป็น NULL ต่อไปได้ — ซ่อน CPM box บน card/detail

### Estimated Impressions Formula

```
estimatedImpressionsPerDay = (dailyBudgetTon / bidCpmTon) × 1000
```

แสดงก็ต่อเมื่อ `bidCpmTon` ไม่ใช่ NULL และ > 0 เท่านั้น (ป้องกัน division by zero)

## UI Changes

### 1. Campaign Form (`campaign-form.tsx`)

ลำดับ field:
1. Target type
2. Placement name
3. Daily Budget *(required)*
4. **CPM Bid** *(required, ใหม่)* — label: "CPM Bid (TON)", input type number, step 0.0001, placeholder เช่น `0.50`
5. Total Budget *(optional)*
6. Note *(optional)*

validation: required + > 0 (เหมือน dailyBudgetTon)

### 2. Campaign Card (`campaign-card.tsx`)

เพิ่มกล่องที่ 2 ข้างๆ Daily Budget:

```
┌─────────────────┬─────────────────┐
│ Daily Budget    │ CPM Bid         │
│ 5.00 TON/วัน   │ 0.50 TON        │
│ Avg BSP 78%     │ ~10,000 imp/วัน │
└─────────────────┴─────────────────┘
```

- ถ้า `bidCpmTon` เป็น NULL → แสดงแค่กล่อง Daily Budget (ไม่มีกล่อง CPM Bid)
- estimated impressions แสดงเป็น `~X,XXX imp/วัน` (Math.round ก่อน แล้ว toLocaleString('th-TH'))

### 3. Campaign Detail Page (`campaigns/[id]/page.tsx`)

เพิ่มบรรทัดในส่วน header info ใต้ daily budget:

```
Daily Budget: 5.00 TON/วัน · งบรวม: 100.00 TON
CPM Bid: 0.50 TON · ~10,000 imp/วัน          ← ใหม่
```

- ซ่อนบรรทัดนี้ถ้า `bidCpmTon` เป็น NULL หรือ 0

## API Changes

### GET /api/campaigns และ GET /api/campaigns/[id]

include `bidCpmTon` ใน response (Prisma ส่งมาเป็น Decimal → `Number()` ก่อนใช้)

### POST /api/campaigns และ PUT /api/campaigns/[id]

รับ `bidCpmTon: number | null` จาก body
- POST: validate bidCpmTon > 0 (form จะส่งมาเสมอ)
- PUT: validate > 0 เฉพาะเมื่อ bidCpmTon ไม่ใช่ null (อนุญาต null เพื่อ backward compat)

## Export / Import (`lib/export.ts`)

- Export: include `bidCpmTon` ใน campaign object
- Import: backward compat `bidCpmTon: c.bidCpmTon ?? null` (JSON เก่าไม่มี field นี้)

## Out of Scope

- ไม่เปรียบเทียบ bid CPM กับ actual CPM (หน่วยต่างกัน: impressions vs views)
- ไม่เพิ่ม CPM bid ลงใน PerformanceEntry
- ไม่มี history ของ bid ที่เปลี่ยนไปตามเวลา
