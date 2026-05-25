# Wallet Deposit Pricing (FIFO Rate Locking)

**Date:** 2026-05-26
**Status:** Approved

## Problem

ระบบปัจจุบันใช้ `latestAllocation` (allocation ล่าสุด) เป็นตัวล็อค rate สำหรับ entry form
ทำให้เมื่อ campaign มี allocation หลายรอบที่ราคา TON ต่างกัน rate ที่ใช้ไม่ตรงกับต้นทุนจริง

ตัวอย่างปัญหา: ฝาก TON ตอน 1.5 USD/TON → campaign รัน → ฝากรอบใหม่ตอน 2.5 USD/TON
หากระบบใช้ rate ล่าสุด (2.5) ตลอด cost จะดูแพงกว่าที่จ่ายจริง

## Goal

ใช้ราคา TON ตาม **วันที่ฝาก wallet** (deposit rate) ไม่ใช่ราคาตลาดวันที่บันทึก entry
โดยใช้หลัก **FIFO อัตโนมัติ** — campaign ใช้จ่าย TON จาก allocation รอบเก่าสุดก่อน

## Decisions

| หัวข้อ | การตัดสินใจ |
|--------|------------|
| Multi-batch rate | FIFO อัตโนมัติ (ไม่ manual select) |
| CSV import | ใช้ FIFO rate ณ ตอนเริ่ม import (rate เดียวกันทุกแถว) |
| Campaign ไม่มี allocation | ดึง live rate เหมือนเดิม |
| Entry เก่า | ไม่ recalculate — คง rate เดิม |
| UI | Lock field + แสดง "อัตราจาก Deposit [date] · คงเหลือ X TON" |

## Architecture

### Section 1 — Core Logic: `src/lib/wallet.ts`

เพิ่มฟังก์ชัน `computeFifoRate()`:

```typescript
export function computeFifoRate(
  allocations: Array<{
    amountTon: number
    allocatedAt: Date
    deposit: { tonPriceUsd: number; usdThbRate: number; depositedAt: Date }
  }>,
  totalSpentTon: number
): {
  tonPriceUsd: number
  usdThbRate: number
  depositedAt: Date   // serialize เป็น string ก่อนส่งข้าม Server→Client
  remainingTon: number
} | null  // null เฉพาะ allocations ว่าง (campaign ไม่มี allocation)
```

**Algorithm:**
```
sort allocations by allocatedAt ASC
running = 0
for each alloc:
  if totalSpentTon < running + alloc.amountTon:
    return { rate: alloc.deposit.rate, remaining: alloc.amountTon - (totalSpentTon - running) }
  running += alloc.amountTon
// overspend → return last alloc rate, remaining = 0
return lastAlloc ? { rate: lastAlloc.deposit.rate, remaining: 0 } : null
```

**Overspend behavior:** ถ้า totalSpentTon เกิน allocation ทั้งหมด → return batch สุดท้าย + `remainingTon: 0`
(ไม่ return null เพราะ form ยังต้องการ rate)

**Boundary case:** `totalSpentTon == batch.amountTon` พอดี → ข้ามไปใช้ batch ถัดไป (strict `<`)

### Section 2 — Entry Page: `src/app/campaigns/[id]/entries/new/page.tsx`

**Prisma query เปลี่ยน:**
```typescript
// เดิม: allocations take:1 orderBy desc, ไม่มี entries
// ใหม่:
prisma.campaign.findUnique({
  where: { id },
  include: {
    allocations: { include: { deposit: true }, orderBy: { allocatedAt: 'asc' } },
    entries: { select: { spendTon: true } },
  },
})
```

**Logic เปลี่ยน:**
```typescript
import { computeFifoRate } from '@/lib/wallet'

const totalSpentTon = campaign.entries.reduce((s, e) => s + Number(e.spendTon), 0)

const fifoResult = computeFifoRate(
  campaign.allocations.map(a => ({
    amountTon: Number(a.amountTon),
    allocatedAt: a.allocatedAt,
    deposit: {
      tonPriceUsd: Number(a.deposit.tonPriceUsd),
      usdThbRate:  Number(a.deposit.usdThbRate),
      depositedAt: a.deposit.depositedAt,
    },
  })),
  totalSpentTon
)

const allocationRate = fifoResult ? {
  tonPriceUsd:  fifoResult.tonPriceUsd,
  usdThbRate:   fifoResult.usdThbRate,
  depositedAt:  fifoResult.depositedAt.toISOString(),  // serialize สำหรับ Client
  remainingTon: fifoResult.remainingTon,
} : undefined
```

**Type ที่ต้องอัปเดตใน 3 ไฟล์** (TabsClient, EntryForm, CsvImport):
```typescript
// เดิม
allocationRate?: { tonPriceUsd: number; usdThbRate: number }
// ใหม่
allocationRate?: { tonPriceUsd: number; usdThbRate: number; depositedAt: string; remainingTon: number }
```

### Section 3 — UI Update

**`entry-form.tsx`** แทนที่ข้อความ "อัตราจาก Wallet Deposit (locked)":
```tsx
{allocationRate && !entry && (
  <p className="text-xs text-blue-400">
    อัตราจาก Deposit {new Date(allocationRate.depositedAt).toLocaleDateString('th-TH')}
    · คงเหลือ {allocationRate.remainingTon.toFixed(2)} TON
  </p>
)}
```

**`csv-import.tsx`** แทนที่ข้อความ "ใช้อัตราจาก Wallet Deposit":
```tsx
{allocationRate && (
  <p className="text-xs text-blue-400">
    ใช้อัตราจาก Deposit {new Date(allocationRate.depositedAt).toLocaleDateString('th-TH')}:
    1 TON = ${allocationRate.tonPriceUsd.toFixed(4)} · คงเหลือ {allocationRate.remainingTon.toFixed(2)} TON (locked)
  </p>
)}
```

## Files Changed

| ไฟล์ | สิ่งที่เปลี่ยน |
|------|--------------|
| `src/lib/wallet.ts` | เพิ่ม `computeFifoRate()` |
| `src/app/campaigns/[id]/entries/new/page.tsx` | query + import + FIFO logic |
| `src/app/campaigns/[id]/entries/new/tabs-client.tsx` | ขยาย allocationRate type |
| `src/components/entry-form.tsx` | ขยาย type + UI text |
| `src/components/csv-import.tsx` | ขยาย type + UI text |
| `tests/wallet.test.ts` | เพิ่ม `describe('computeFifoRate', ...)` |

## Files NOT Changed

- `prisma/schema.prisma` — ไม่มี migration
- `entries/[entryId]/edit/page.tsx` — edit ใช้ rate จาก entry เดิม ถูกต้อง
- API routes ทั้งหมด
- `lib/metrics.ts`, `lib/rates.ts`, `lib/export.ts`

## Testing

**Unit tests** ใน `tests/wallet.test.ts`:

```
describe('computeFifoRate'):
  1. [] allocations → null
  2. spend=0, 1 batch → rate batch1, remaining = amountTon
  3. spend อยู่กลาง batch แรก → rate batch1, remaining ถูกต้อง
  4. spend == batch1.amountTon พอดี, มี batch2 → rate batch2
  5. spend == batch1.amountTon พอดี, ไม่มี batch2 → rate batch1, remaining=0
  6. spend ข้าม batch1 อยู่ใน batch2 → rate batch2, remaining ถูกต้อง
  7. overspend > total → last batch rate, remaining=0
  8. allocations ถูกส่ง DESC order → sort ภายใน, ผล FIFO ถูกต้อง
```

**Smoke test:** campaign มี allocation → หน้า "บันทึกวันนี้" → rate locked + "อัตราจาก Deposit [date] · คงเหลือ X TON"

## Notes

- REFUND deposit ไม่สร้าง `CampaignAllocation` → ไม่กระทบ FIFO
- Entry เก่าที่บันทึกด้วย live rate คง rate เดิม ไม่มี recalculate
- CSV import Approach 1: ใช้ FIFO rate ณ ต้น import ทุกแถว (ไม่ per-row)
  สามารถ upgrade เป็น per-row FIFO ได้ในอนาคตถ้าต้องการ precision สูงขึ้น
