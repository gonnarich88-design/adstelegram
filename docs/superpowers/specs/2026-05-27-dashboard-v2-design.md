# Dashboard V2 — Design Spec

> **Status:** Approved  
> **Date:** 2026-05-27  
> **Scope:** `src/app/page.tsx` only — no schema, no API, no new components

---

## Goal

Redesign dashboard layout เพื่อวิเคราะห์ ads ได้ดีขึ้น ด้วย Layout C: Summary Bar hero + 2-column body

---

## Layout (บนลงล่าง)

```
┌──────────────────────────────────────────────────────┐
│  Hero: Summary Bar — 5 slots ในแถวเดียว              │
│  Joins | CPS ฿ | Spend TON | CTR% | Wallet TON       │
└──────────────────────────────────────────────────────┘

┌──────────────┬───────────────────────────────────────┐
│  WoW Strip   │  Campaign Leaderboard 3×2             │
│  (col ซ้าย)  │  (col ขวา 2/3)                       │
└──────────────┴───────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│  Trend Chart (ไม่เปลี่ยน)                            │
└──────────────────────────────────────────────────────┘
```

---

## Section 1: Hero Summary Bar

Full-width card, แบ่ง 5 slots คั่นด้วย divider แนวตั้ง

| Slot | ตัวเลขหลัก | sub-text line 1 | sub-text line 2 |
|------|-----------|----------------|----------------|
| **Joins** | `totalJoins` (all-time) | `▲ +X วันนี้` (เขียว) หรือ `—` | ซ่อนถ้าไม่มีข้อมูลวันนี้ |
| **CPS ฿** | `cpsThb.toFixed(0)` | `cost per {joinsLabel}` | `฿X → ฿X` เมื่อวาน→วันนี้ (สีตาม trend) หรือ `—` |
| **Spend** | `totalSpendTon.toFixed(2) TON` | `≈ ฿X,XXX` | `วันนี้ X.XX TON` หรือ `—` |
| **CTR%** | `ctr.toFixed(2)%` | `X,XXX views` | — |
| **Wallet** | `walletBalance.toFixed(2) TON` | `~X วัน · X.XX TON/วัน` | ซ่อน slot นี้ถ้า walletBalance = 0 → แสดง 4 slots |

**หมายเหตุ:** ลบ Wallet Card เดิม (full-width) และ KPI Cards grid เดิม (5 ใบ) ออก

---

## Section 2: 2-Column Body

`grid grid-cols-3 gap-4` — WoW ครอง 1 คอลัมน์, Leaderboard ครอง 2 คอลัมน์

### WoW Strip (col-span-1)

เปรียบ rolling 7 วันล่าสุด vs 7 วันก่อนหน้า (วันที่ 8–14)

- **4 metrics:** Joins, CPS, Spend, CTR
- **การแสดงผล:** metric name + ค่าสัปดาห์นี้ + arrow + % change + ค่าสัปดาห์ที่แล้ว
- **สี:** เขียว = ดีขึ้น (Joins↑, CTR↑, CPS↓, Spend ขึ้นถือว่า neutral/แดง), แดง = แย่ลง
- **ซ่อน:** section นี้ถ้าไม่มีข้อมูลสัปดาห์ที่แล้วเลย

```
window A = entries ที่ date อยู่ใน [today-6, today]   (7 วันล่าสุด)
window B = entries ที่ date อยู่ใน [today-13, today-7] (7 วันก่อน)
```

### Campaign Leaderboard (col-span-2)

`grid grid-cols-3 gap-3` — 6 boxes

| Box | Icon | Metric | Sort | หน่วย |
|-----|------|--------|------|-------|
| 1 | 👥 | Joins | desc | จำนวน |
| 2 | 🏆 | CPS ฿ | asc (ต่ำ=ดี) | ฿ |
| 3 | 💸 | Spend | desc | ฿ |
| 4 | 👆 | CTR% | desc | % |
| 5 | 🖱 | Clicks | desc | จำนวน |
| 6 | 👁 | Views | desc | จำนวน |

- **Data window:** 7 วันล่าสุด, กรอง ACTIVE + PAUSED เท่านั้น
- **Top 3 per box:** อันดับ 1 (🥇), 2 (🥈), 3 (🥉) + ค่า metric
- **ซ่อน:** section นี้ถ้าไม่มี campaign ที่มีข้อมูล 7 วัน

---

## สิ่งที่ลบออก

- Budget Alerts section
- Top Performers 3 cards (แทนด้วย Leaderboard)
- Wallet Card full-width (ย้ายเข้า Hero bar)
- KPI Cards grid 5 ใบ (ย้ายเข้า Hero bar)

---

## Constraints

- แก้เพียง `src/app/page.tsx` ไฟล์เดียว
- ไม่มี schema migration
- ไม่มี API route ใหม่
- ไม่มี Client Component ใหม่ — Server Component ทั้งหมด
- Tailwind utility classes เท่านั้น
