# Wallet Deposit Pricing (FIFO Rate Locking) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ใช้ราคา TON ตามวันที่ฝาก wallet (FIFO อัตโนมัติ) แทนการดึง live rate หรือใช้ allocation ล่าสุดเสมอ

**Architecture:** เพิ่ม `computeFifoRate()` ใน `lib/wallet.ts` ที่รับ allocations + totalSpentTon แล้วคืน rate ของ batch ปัจจุบันตามหลัก FIFO จากนั้นอัปเดต `entries/new/page.tsx` ให้ใช้ฟังก์ชันนี้แทน `latestAllocation` และส่ง `depositedAt` + `remainingTon` ลงไปใน component chain เพื่อแสดง UI ที่ชัดเจนขึ้น

**Tech Stack:** TypeScript, Prisma (Decimal → Number), Vitest, Next.js App Router Server Components

---

## File Map

| Action | File |
|--------|------|
| Modify | `src/lib/wallet.ts` — เพิ่ม `computeFifoRate()` |
| Modify | `src/app/campaigns/[id]/entries/new/page.tsx` — query + FIFO logic |
| Modify | `src/app/campaigns/[id]/entries/new/tabs-client.tsx` — ขยาย type |
| Modify | `src/components/entry-form.tsx` — ขยาย type + UI text |
| Modify | `src/components/csv-import.tsx` — ขยาย type + UI text |
| Modify | `tests/wallet.test.ts` — เพิ่ม describe('computeFifoRate') |

---

## Task 1: `computeFifoRate` — TDD

**Files:**
- Modify: `src/lib/wallet.ts`
- Test: `tests/wallet.test.ts`

- [ ] **Step 1: เพิ่ม import และ describe block ใน `tests/wallet.test.ts`**

เปิด `tests/wallet.test.ts` แล้วเพิ่มที่บรรทัดบนสุด (import line 2 ปัจจุบันคือ `import { computeWalletBalance, findCurrentRate } from '@/lib/wallet'`):

```typescript
import { computeWalletBalance, findCurrentRate, computeFifoRate } from '@/lib/wallet'
```

จากนั้นเพิ่ม describe block นี้ **ต่อท้ายไฟล์** หลัง `describe('findCurrentRate', ...)`:

```typescript
describe('computeFifoRate', () => {
  const alloc = (
    amountTon: number,
    allocatedAt: string,
    tonUsd: number,
    usdThb: number,
    depositedAt?: string
  ) => ({
    amountTon,
    allocatedAt: new Date(allocatedAt),
    deposit: {
      tonPriceUsd: tonUsd,
      usdThbRate: usdThb,
      depositedAt: new Date(depositedAt ?? allocatedAt),
    },
  })

  it('returns null for empty allocations', () => {
    expect(computeFifoRate([], 0)).toBeNull()
  })

  it('returns batch rate and full remaining when spend=0', () => {
    const result = computeFifoRate([alloc(10, '2026-01-01', 1.5, 100)], 0)
    expect(result?.tonPriceUsd).toBe(1.5)
    expect(result?.usdThbRate).toBe(100)
    expect(result?.remainingTon).toBe(10)
  })

  it('returns batch1 rate when spend is within batch1', () => {
    const result = computeFifoRate([
      alloc(10, '2026-01-01', 1.5, 100),
      alloc(5,  '2026-02-01', 2.5, 110),
    ], 5)
    expect(result?.tonPriceUsd).toBe(1.5)
    expect(result?.remainingTon).toBe(5)
  })

  it('returns batch2 rate when spend exactly equals batch1 amountTon', () => {
    const result = computeFifoRate([
      alloc(10, '2026-01-01', 1.5, 100),
      alloc(5,  '2026-02-01', 2.5, 110),
    ], 10)
    expect(result?.tonPriceUsd).toBe(2.5)
    expect(result?.remainingTon).toBe(5)
  })

  it('returns batch1 rate and remaining=0 when spend equals batch1 and no batch2', () => {
    const result = computeFifoRate([alloc(10, '2026-01-01', 1.5, 100)], 10)
    expect(result?.tonPriceUsd).toBe(1.5)
    expect(result?.remainingTon).toBe(0)
  })

  it('returns batch2 rate when spend is within batch2', () => {
    const result = computeFifoRate([
      alloc(10, '2026-01-01', 1.5, 100),
      alloc(5,  '2026-02-01', 2.5, 110),
    ], 12)
    expect(result?.tonPriceUsd).toBe(2.5)
    expect(result?.remainingTon).toBe(3)
  })

  it('returns last batch rate and remaining=0 when overspend', () => {
    const result = computeFifoRate([
      alloc(10, '2026-01-01', 1.5, 100),
      alloc(5,  '2026-02-01', 2.5, 110),
    ], 20)
    expect(result?.tonPriceUsd).toBe(2.5)
    expect(result?.remainingTon).toBe(0)
  })

  it('sorts allocations by allocatedAt ASC regardless of input order', () => {
    const result = computeFifoRate([
      alloc(5,  '2026-02-01', 2.5, 110), // newer — ส่งมาก่อน
      alloc(10, '2026-01-01', 1.5, 100), // older — ส่งมาทีหลัง
    ], 5)
    expect(result?.tonPriceUsd).toBe(1.5) // ต้องใช้ batch เก่าสุดก่อน
    expect(result?.remainingTon).toBe(5)
  })
})
```

- [ ] **Step 2: รัน tests เพื่อยืนยันว่า fail**

```bash
npm test
```

Expected: FAIL — "computeFifoRate is not a function" หรือ import error

- [ ] **Step 3: เพิ่ม `computeFifoRate` ใน `src/lib/wallet.ts`**

เพิ่มฟังก์ชันนี้ต่อท้ายไฟล์ (หลัง `findCurrentRate`):

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
  depositedAt: Date
  remainingTon: number
} | null {
  if (allocations.length === 0) return null

  const sorted = [...allocations].sort((a, b) => a.allocatedAt.getTime() - b.allocatedAt.getTime())
  const lastAlloc = sorted[sorted.length - 1]
  let running = 0

  for (const alloc of sorted) {
    if (totalSpentTon < running + alloc.amountTon) {
      return {
        tonPriceUsd: alloc.deposit.tonPriceUsd,
        usdThbRate:  alloc.deposit.usdThbRate,
        depositedAt: alloc.deposit.depositedAt,
        remainingTon: alloc.amountTon - (totalSpentTon - running),
      }
    }
    running += alloc.amountTon
  }

  return {
    tonPriceUsd: lastAlloc.deposit.tonPriceUsd,
    usdThbRate:  lastAlloc.deposit.usdThbRate,
    depositedAt: lastAlloc.deposit.depositedAt,
    remainingTon: 0,
  }
}
```

- [ ] **Step 4: รัน tests เพื่อยืนยันว่าผ่าน**

```bash
npm test
```

Expected: ทุก test ผ่าน (เดิมมี 36 tests + 8 tests ใหม่ = 44 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/wallet.ts tests/wallet.test.ts
git commit -m "feat: add computeFifoRate for FIFO deposit rate locking"
```

---

## Task 2: อัปเดต `entries/new/page.tsx` ใช้ FIFO logic

**Files:**
- Modify: `src/app/campaigns/[id]/entries/new/page.tsx`

ไม่มี unit test สำหรับ task นี้ — เป็น Server Component ที่ใช้ฟังก์ชันที่ test ไปแล้วใน Task 1 ตรวจสอบด้วย TypeScript + smoke test ใน Task 4

- [ ] **Step 1: แทนที่ทั้งไฟล์ `src/app/campaigns/[id]/entries/new/page.tsx`**

```typescript
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { computeFifoRate } from '@/lib/wallet'
import { TabsClient } from './tabs-client'

export const dynamic = 'force-dynamic'

export default async function NewEntryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: {
      allocations: { include: { deposit: true }, orderBy: { allocatedAt: 'asc' } },
      entries: { select: { spendTon: true } },
    },
  })
  if (!campaign) notFound()

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
    depositedAt:  fifoResult.depositedAt.toISOString(),
    remainingTon: fifoResult.remainingTon,
  } : undefined

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">บันทึก Performance</h1>
        <p className="text-sm text-muted-foreground mt-1">{campaign.name} · {campaign.targetType} · {campaign.targetName}</p>
      </div>
      <TabsClient
        campaignId={id}
        targetType={campaign.targetType}
        defaultDailyBudget={campaign.dailyBudgetTon ? campaign.dailyBudgetTon.toString() : undefined}
        allocationRate={allocationRate}
      />
    </div>
  )
}
```

- [ ] **Step 2: ตรวจ TypeScript**

```bash
npx tsc --noEmit
```

Expected: ไม่มี error — `allocationRate` เป็น variable ไม่ใช่ object literal ตรง TypeScript structural subtyping อนุญาตให้ส่ง type ที่มี field มากกว่าได้

- [ ] **Step 3: Commit**

```bash
git add src/app/campaigns/[id]/entries/new/page.tsx
git commit -m "feat: use FIFO deposit rate in new entry page"
```

---

## Task 3: ขยาย `allocationRate` type + อัปเดต UI text ใน 3 ไฟล์

**Files:**
- Modify: `src/app/campaigns/[id]/entries/new/tabs-client.tsx`
- Modify: `src/components/entry-form.tsx`
- Modify: `src/components/csv-import.tsx`

- [ ] **Step 1: อัปเดต `tabs-client.tsx` บรรทัด 11**

เปลี่ยน:
```typescript
allocationRate?: { tonPriceUsd: number; usdThbRate: number }
```
เป็น:
```typescript
allocationRate?: { tonPriceUsd: number; usdThbRate: number; depositedAt: string; remainingTon: number }
```

- [ ] **Step 2: อัปเดต `entry-form.tsx` — type (บรรทัด 15) + UI text (บรรทัด 178-180)**

เปลี่ยน type บรรทัด 15:
```typescript
allocationRate?: { tonPriceUsd: number; usdThbRate: number }
```
เป็น:
```typescript
allocationRate?: { tonPriceUsd: number; usdThbRate: number; depositedAt: string; remainingTon: number }
```

เปลี่ยน UI text บรรทัด 178-180 (ข้อความ "อัตราจาก Wallet Deposit (locked)"):
```tsx
{allocationRate && !entry && (
  <p className="text-xs text-blue-400">อัตราจาก Wallet Deposit (locked)</p>
)}
```
เป็น:
```tsx
{allocationRate && !entry && (
  <p className="text-xs text-blue-400">
    อัตราจาก Deposit {new Date(allocationRate.depositedAt).toLocaleDateString('th-TH')}
    {' · '}คงเหลือ {allocationRate.remainingTon.toFixed(2)} TON
  </p>
)}
```

- [ ] **Step 3: อัปเดต `csv-import.tsx` — type (บรรทัด 69) + UI text (บรรทัด 222-224)**

เปลี่ยน type บรรทัด 69:
```typescript
allocationRate?: { tonPriceUsd: number; usdThbRate: number }
```
เป็น:
```typescript
allocationRate?: { tonPriceUsd: number; usdThbRate: number; depositedAt: string; remainingTon: number }
```

เปลี่ยน UI text บรรทัด 222-224 (ข้อความ "ใช้อัตราจาก Wallet Deposit:"):
```tsx
{allocationRate && (
  <p className="text-xs text-blue-400">ใช้อัตราจาก Wallet Deposit: 1 TON = ${allocationRate.tonPriceUsd.toFixed(4)} / ฿{allocationRate.usdThbRate.toFixed(4)} (locked)</p>
)}
```
เป็น:
```tsx
{allocationRate && (
  <p className="text-xs text-blue-400">
    ใช้อัตราจาก Deposit {new Date(allocationRate.depositedAt).toLocaleDateString('th-TH')}:
    {' '}1 TON = ${allocationRate.tonPriceUsd.toFixed(4)}
    {' · '}คงเหลือ {allocationRate.remainingTon.toFixed(2)} TON (locked)
  </p>
)}
```

- [ ] **Step 4: ตรวจ TypeScript และ tests**

```bash
npx tsc --noEmit && npm test
```

Expected: ไม่มี TypeScript error, ทุก test ผ่าน (44 tests)

- [ ] **Step 5: Commit**

```bash
git add src/app/campaigns/[id]/entries/new/tabs-client.tsx \
        src/components/entry-form.tsx \
        src/components/csv-import.tsx
git commit -m "feat: show deposit date and remaining TON in rate lock UI"
```

---

## Task 4: Smoke Test

**ไม่มีไฟล์ที่แก้ — เป็น manual verification**

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: เปิด browser ไปที่ campaign ที่มี allocation อยู่แล้ว**

ไปที่ `http://localhost:3000` → เลือก campaign ที่มียอด allocation → กด "+ บันทึกวันนี้"

Expected:
- ฟิลด์ TON/USD และ USD/THB เป็น read-only
- ใต้ฟิลด์ TON/USD มีข้อความ: "อัตราจาก Deposit [วันที่ภาษาไทย] · คงเหลือ X.XX TON"
- ไม่มีปุ่ม "↻ ดึงอัตโนมัติ"

- [ ] **Step 3: ทดสอบ campaign ที่ไม่มี allocation**

ไปที่ campaign ที่ไม่มี allocation → กด "+ บันทึกวันนี้"

Expected:
- ฟิลด์ rate แก้ได้ปกติ
- มีปุ่ม "↻ ดึงอัตโนมัติ"
- ไม่มีข้อความ deposit

- [ ] **Step 4: ทดสอบ tab Import CSV บน campaign ที่มี allocation**

Expected: เห็นข้อความ "ใช้อัตราจาก Deposit [วันที่]: 1 TON = $X.XXXX · คงเหลือ X.XX TON (locked)"

- [ ] **Step 5: อัปเดต PROGRESS.md**

เพิ่มในหัวข้อ "เสร็จแล้ว":
```
- [x] **FIFO Wallet Deposit Pricing** — computeFifoRate ใน lib/wallet.ts, entries/new ใช้ FIFO แทน latestAllocation, UI แสดง deposit date + remaining TON
```

อัปเดต "สถานะปัจจุบัน" และวันที่ด้านบน

```bash
git add docs/PROGRESS.md
git commit -m "docs: update PROGRESS.md — FIFO wallet deposit pricing เสร็จ"
```
