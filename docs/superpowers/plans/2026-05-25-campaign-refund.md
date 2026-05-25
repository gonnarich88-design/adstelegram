# Campaign Refund Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** บันทึกการยกเลิกแคมเปญและรับ TON คืนจาก Telegram — เงินกลับเข้า Wallet, campaign status เปลี่ยนเป็น CANCELLED

**Architecture:** เพิ่ม `type: DEPOSIT|REFUND` และ `refundCampaignId` ใน `WalletDeposit` (schema change minimal) — balance formula ไม่เปลี่ยน, refund ปรากฏเป็นแถวสีเขียวพร้อม label ต่างใน wallet list, กรอก refund ผ่าน inline form ใน Campaign Detail

**Tech Stack:** Next.js 16 App Router, Prisma 6, PostgreSQL, React 19, TypeScript, Vitest, Tailwind CSS, lucide-react

---

## File Map

| ไฟล์ | action |
|------|--------|
| `prisma/schema.prisma` | แก้ไข — เพิ่ม enum `DepositType`, `CANCELLED` status, fields ใหม่ใน `WalletDeposit`, relation ใน `Campaign` |
| `prisma/migrations/…` | auto-generated |
| `tests/wallet.test.ts` | แก้ไข — เพิ่ม test cases สำหรับ REFUND deposit ใน balance |
| `src/app/api/campaigns/[id]/refund/route.ts` | สร้างใหม่ — POST endpoint |
| `src/app/campaigns/[id]/refund-button.tsx` | สร้างใหม่ — Client Component (ปุ่ม + inline form) |
| `src/app/campaigns/[id]/page.tsx` | แก้ไข — เพิ่ม CANCELLED badge, RefundButton, ซ่อนปุ่มเมื่อ CANCELLED |
| `src/app/wallet/page.tsx` | แก้ไข — include `refundCampaign` relation, ส่ง `type`+`refundCampaignName` ไป client |
| `src/app/wallet/wallet-client.tsx` | แก้ไข — แสดง REFUND rows ต่างจาก DEPOSIT |
| `src/components/campaign-card.tsx` | แก้ไข — เพิ่ม CANCELLED badge |
| `src/lib/export.ts` | แก้ไข — export ฟิลด์ใหม่, import backward compat |

---

## Task 1: Schema Migration

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: อัปเดต schema**

แทนที่เนื้อหาในไฟล์ `prisma/schema.prisma` ทั้งหมดด้วย:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Campaign {
  id             String               @id @default(uuid())
  name           String
  targetType     TargetType
  targetName     String
  startDate      DateTime
  endDate        DateTime?
  budgetTon      Decimal?             @db.Decimal(18, 8)
  dailyBudgetTon Decimal              @db.Decimal(18, 8)
  status         CampaignStatus       @default(ACTIVE)
  placementName  String?
  note           String?
  entries        PerformanceEntry[]
  allocations    CampaignAllocation[]
  refunds        WalletDeposit[]      @relation("CampaignRefunds")
  createdAt      DateTime             @default(now())
  updatedAt      DateTime             @updatedAt
}

model PerformanceEntry {
  id             String   @id @default(uuid())
  campaignId     String
  campaign       Campaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  date           DateTime
  spendTon       Decimal  @db.Decimal(18, 8)
  dailyBudgetTon Decimal  @db.Decimal(18, 8)
  tonPriceUsd    Decimal  @db.Decimal(18, 8)
  usdThbRate     Decimal  @db.Decimal(18, 8)
  impressions    Int
  views          Int
  clicks         Int
  joins          Int
  note           String?
  createdAt      DateTime @default(now())

  @@index([campaignId])
  @@unique([campaignId, date])
}

model WalletDeposit {
  id                String               @id @default(cuid())
  amountTon         Decimal              @db.Decimal(18, 8)
  tonPriceUsd       Decimal              @db.Decimal(18, 8)
  usdThbRate        Decimal              @db.Decimal(18, 8)
  depositedAt       DateTime
  note              String?
  type              DepositType          @default(DEPOSIT)
  refundCampaignId  String?
  refundCampaign    Campaign?            @relation("CampaignRefunds", fields: [refundCampaignId], references: [id])
  createdAt         DateTime             @default(now())
  allocations       CampaignAllocation[]
}

model CampaignAllocation {
  id          String        @id @default(cuid())
  depositId   String
  campaignId  String
  amountTon   Decimal       @db.Decimal(18, 8)
  allocatedAt DateTime      @default(now())
  createdAt   DateTime      @default(now())
  deposit     WalletDeposit @relation(fields: [depositId], references: [id])
  campaign    Campaign      @relation(fields: [campaignId], references: [id], onDelete: Cascade)

  @@index([campaignId])
}

enum TargetType {
  CHANNEL
  BOT
}

enum CampaignStatus {
  ACTIVE
  PAUSED
  DONE
  CANCELLED
}

enum DepositType {
  DEPOSIT
  REFUND
}
```

- [ ] **Step 2: Run migration**

```bash
npx prisma migrate dev --name add_refund_deposit_type
```

Expected: migration applied, no errors

- [ ] **Step 3: Regenerate Prisma client**

```bash
npx prisma generate
```

- [ ] **Step 4: ยืนยัน tests เดิมยังผ่าน**

```bash
npm test
```

Expected: 33 tests pass (เหมือนเดิม)

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add DepositType enum, CANCELLED status, refundCampaignId to schema"
```

---

## Task 2: Unit Tests — Wallet Balance with REFUND Deposits

**Files:**
- Modify: `tests/wallet.test.ts`

- [ ] **Step 1: เพิ่ม test cases ใน `tests/wallet.test.ts`**

เพิ่มที่ท้าย describe block `'computeWalletBalance'`:

```ts
  it('includes REFUND deposits in total (same as DEPOSIT)', () => {
    // REFUND deposit เพิ่ม balance เหมือน DEPOSIT ปกติ — สูตรไม่เปลี่ยน
    expect(
      computeWalletBalance(
        [{ amountTon: 1000 }, { amountTon: 4.041 }],
        [{ amountTon: 5 }]
      )
    ).toBeCloseTo(999.041)
  })

  it('net balance after refund equals original deposit minus actual spend', () => {
    // deposit 1000, allocate 5, refund 4.041, spend tracked = 0.959
    // balance = 1000 + 4.041 - 5 = 999.041
    expect(
      computeWalletBalance(
        [{ amountTon: 1000 }, { amountTon: 4.041 }],
        [{ amountTon: 5 }]
      )
    ).toBeCloseTo(999.041, 3)
  })
```

- [ ] **Step 2: Run tests**

```bash
npm test
```

Expected: ทุก test ผ่าน รวมถึง 2 test ใหม่

- [ ] **Step 3: Commit**

```bash
git add tests/wallet.test.ts
git commit -m "test: add wallet balance tests for REFUND deposit behavior"
```

---

## Task 3: Refund API Endpoint

**Files:**
- Create: `src/app/api/campaigns/[id]/refund/route.ts`

- [ ] **Step 1: สร้าง directory**

```bash
mkdir -p src/app/api/campaigns/\[id\]/refund
```

- [ ] **Step 2: สร้างไฟล์ `src/app/api/campaigns/[id]/refund/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()

    const amountTon = Number(body.amountTon)
    const tonPriceUsd = Number(body.tonPriceUsd)
    const usdThbRate = Number(body.usdThbRate)

    if (isNaN(amountTon) || amountTon <= 0)
      return NextResponse.json({ error: 'amountTon must be > 0' }, { status: 400 })
    if (isNaN(tonPriceUsd) || tonPriceUsd <= 0)
      return NextResponse.json({ error: 'tonPriceUsd must be > 0' }, { status: 400 })
    if (isNaN(usdThbRate) || usdThbRate <= 0)
      return NextResponse.json({ error: 'usdThbRate must be > 0' }, { status: 400 })
    if (!body.refundedAt)
      return NextResponse.json({ error: 'refundedAt is required' }, { status: 400 })

    const campaign = await prisma.campaign.findUnique({ where: { id } })
    if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })

    const [deposit, updatedCampaign] = await prisma.$transaction([
      prisma.walletDeposit.create({
        data: {
          type: 'REFUND',
          refundCampaignId: id,
          amountTon,
          tonPriceUsd,
          usdThbRate,
          depositedAt: new Date(body.refundedAt),
          note: body.note ?? null,
        },
      }),
      prisma.campaign.update({
        where: { id },
        data: {
          status:
            campaign.status === 'ACTIVE' || campaign.status === 'PAUSED'
              ? 'CANCELLED'
              : campaign.status,
        },
      }),
    ])

    return NextResponse.json({ deposit: { id: deposit.id }, campaign: { id: updatedCampaign.id, status: updatedCampaign.status } }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/campaigns/\[id\]/refund/
git commit -m "feat: POST /api/campaigns/[id]/refund endpoint"
```

---

## Task 4: RefundButton Client Component

**Files:**
- Create: `src/app/campaigns/[id]/refund-button.tsx`

สร้าง Client Component ที่มีปุ่มและ inline form สำหรับบันทึก refund

- [ ] **Step 1: สร้างไฟล์ `src/app/campaigns/[id]/refund-button.tsx`**

```tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface RefundButtonProps {
  campaignId: string
  status: string
  estimatedRefundTon: number
}

export function RefundButton({ campaignId, status, estimatedRefundTon }: RefundButtonProps) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const today = new Date().toISOString().split('T')[0]

  const [form, setForm] = useState({
    amountTon: estimatedRefundTon > 0 ? estimatedRefundTon.toFixed(8).replace(/\.?0+$/, '') : '',
    refundedAt: today,
    tonPriceUsd: '',
    usdThbRate: '',
    note: '',
  })
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(false)
  const [error, setError] = useState('')

  function set(key: string, value: string) {
    setForm(f => ({ ...f, [key]: value }))
  }

  async function fetchRate(date: string) {
    if (!date) return
    setFetching(true)
    try {
      const res = await fetch(`/api/rates/historical?from=${date}&to=${date}`)
      if (res.ok) {
        const data = await res.json()
        const rate = data[date]
        if (rate) {
          setForm(f => ({
            ...f,
            tonPriceUsd: rate.tonUsd.toFixed(4),
            usdThbRate: rate.usdThb.toFixed(4),
          }))
        }
      }
    } catch {
      // user fills manually
    } finally {
      setFetching(false)
    }
  }

  useEffect(() => {
    if (showForm) fetchRate(today)
  }, [showForm])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amountTon: parseFloat(form.amountTon),
          tonPriceUsd: parseFloat(form.tonPriceUsd),
          usdThbRate: parseFloat(form.usdThbRate),
          refundedAt: form.refundedAt,
          note: form.note || null,
        }),
      })
      if (res.ok) {
        setShowForm(false)
        router.refresh()
      } else {
        const data = await res.json()
        setError(data.error ?? 'บันทึกไม่สำเร็จ')
      }
    } catch {
      setError('บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง')
    } finally {
      setLoading(false)
    }
  }

  if (status !== 'ACTIVE' && status !== 'PAUSED') return null

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setShowForm(v => !v)}
      >
        ยกเลิกแคมเปญ
      </Button>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="mt-4 space-y-4 rounded-lg border p-4 bg-muted/10"
        >
          <p className="font-medium text-sm">บันทึก Refund จาก Telegram</p>
          {estimatedRefundTon > 0 && (
            <p className="text-xs text-muted-foreground">
              คาดการณ์ยอดคืน: {estimatedRefundTon.toFixed(4)} TON (allocated − spent)
            </p>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>ยอด TON ที่ได้คืน</Label>
              <Input
                type="number"
                step="0.00000001"
                min="0.00000001"
                value={form.amountTon}
                onChange={e => set('amountTon', e.target.value)}
                placeholder="4.0410"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>วันที่คืนเงิน</Label>
              <Input
                type="date"
                value={form.refundedAt}
                onChange={e => {
                  setForm(f => ({ ...f, refundedAt: e.target.value, tonPriceUsd: '', usdThbRate: '' }))
                  fetchRate(e.target.value)
                }}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>ราคา TON/USD {fetching && <span className="text-xs text-blue-400">(กำลังดึง...)</span>}</Label>
              <Input
                type="number"
                step="0.0001"
                value={form.tonPriceUsd}
                onChange={e => set('tonPriceUsd', e.target.value)}
                placeholder="3.21"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>อัตรา USD/THB</Label>
              <Input
                type="number"
                step="0.0001"
                value={form.usdThbRate}
                onChange={e => set('usdThbRate', e.target.value)}
                placeholder="35.50"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>หมายเหตุ (optional)</Label>
            <Input
              value={form.note}
              onChange={e => set('note', e.target.value)}
              placeholder="เช่น ยกเลิกก่อนกำหนด"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex gap-3">
            <Button type="submit" disabled={loading}>
              {loading ? 'กำลังบันทึก...' : 'ยืนยันยกเลิกแคมเปญ'}
            </Button>
            <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
              ยกเลิก
            </Button>
          </div>
        </form>
      )}
    </>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/campaigns/\[id\]/refund-button.tsx
git commit -m "feat: RefundButton client component with inline form"
```

---

## Task 5: Update Campaign Detail Page

**Files:**
- Modify: `src/app/campaigns/[id]/page.tsx`

- [ ] **Step 1: แก้ไข `src/app/campaigns/[id]/page.tsx`**

แทนที่บรรทัดแรกของไฟล์ — เพิ่ม import `RefundButton`:

```ts
import { RefundButton } from './refund-button'
```

แทนที่ `STATUS_COLORS` (บรรทัด 14):

```ts
const STATUS_COLORS = { ACTIVE: 'default', PAUSED: 'secondary', DONE: 'outline', CANCELLED: 'destructive' } as const
```

เพิ่มการคำนวณ `estimatedRefundTon` หลังบรรทัด `const totalSpendTon = ...` (บรรทัด 51):

```ts
  const totalAllocatedTon = campaign.allocations.reduce((s, a) => s + Number(a.amountTon), 0)
  const estimatedRefundTon = Math.max(0, totalAllocatedTon - totalSpendTon)
```

แทนที่ section `<div className="flex gap-2">` (บรรทัด 116–119):

```tsx
        <div className="flex gap-2 flex-wrap">
          <RefundButton
            campaignId={id}
            status={campaign.status}
            estimatedRefundTon={estimatedRefundTon}
          />
          <Link href={`/campaigns/${id}/edit`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>แก้ไข</Link>
          {campaign.status !== 'CANCELLED' && (
            <Link href={`/campaigns/${id}/entries/new`} className={buttonVariants({ size: 'sm' })}>+ บันทึกวันนี้</Link>
          )}
        </div>
```

- [ ] **Step 2: ตรวจ TypeScript**

```bash
npx tsc --noEmit
```

Expected: ไม่มี error

- [ ] **Step 3: Commit**

```bash
git add src/app/campaigns/\[id\]/page.tsx
git commit -m "feat: campaign detail — CANCELLED badge, RefundButton, hide entry for CANCELLED"
```

---

## Task 6: Update CampaignCard for CANCELLED Badge

**Files:**
- Modify: `src/components/campaign-card.tsx`

- [ ] **Step 1: แก้ไข `STATUS_COLORS` ใน `src/components/campaign-card.tsx` (บรรทัด 6–10)**

```ts
const STATUS_COLORS = {
  ACTIVE: 'default',
  PAUSED: 'secondary',
  DONE: 'outline',
  CANCELLED: 'destructive',
} as const
```

- [ ] **Step 2: Commit**

```bash
git add src/components/campaign-card.tsx
git commit -m "feat: campaign-card CANCELLED badge (destructive variant)"
```

---

## Task 7: Update Wallet Page Query

**Files:**
- Modify: `src/app/wallet/page.tsx`

- [ ] **Step 1: แก้ไข query ใน `src/app/wallet/page.tsx`**

แทนที่ `prisma.walletDeposit.findMany(...)` (บรรทัด 9–15):

```ts
    prisma.walletDeposit.findMany({
      include: {
        allocations: {
          include: { campaign: { select: { id: true, name: true } } },
        },
        refundCampaign: { select: { name: true } },
      },
      orderBy: { depositedAt: 'desc' },
    }),
```

แทนที่ `depositsForClient` map (บรรทัด 46–65) เพิ่ม `type` และ `refundCampaignName`:

```ts
  const depositsForClient = deposits.map(d => {
    const allocated = d.allocations.reduce((s, a) => s + Number(a.amountTon), 0)
    return {
      id: d.id,
      amountTon: Number(d.amountTon),
      tonPriceUsd: Number(d.tonPriceUsd),
      usdThbRate: Number(d.usdThbRate),
      depositedAt: d.depositedAt.toISOString(),
      note: d.note,
      type: d.type,
      refundCampaignName: d.refundCampaign?.name ?? null,
      remaining: Number(d.amountTon) - allocated,
      allocations: d.allocations.map(a => ({
        id: a.id,
        campaignId: a.campaignId,
        campaignName: a.campaign.name,
        amountTon: Number(a.amountTon),
        allocatedAt: a.allocatedAt.toISOString(),
        totalSpendTon: spendMap.get(a.campaignId) ?? 0,
      })),
    }
  })
```

- [ ] **Step 2: Commit**

```bash
git add src/app/wallet/page.tsx
git commit -m "feat: wallet page — include type and refundCampaignName in deposits"
```

---

## Task 8: Update WalletClient — Show REFUND Rows

**Files:**
- Modify: `src/app/wallet/wallet-client.tsx`

- [ ] **Step 1: อัปเดต interfaces และ TxRow type**

แทนที่ `interface Deposit` (บรรทัด 26–34):

```ts
interface Deposit {
  id: string
  amountTon: number
  tonPriceUsd: number
  usdThbRate: number
  depositedAt: string
  note: string | null
  type: 'DEPOSIT' | 'REFUND'
  refundCampaignName: string | null
  remaining: number
  allocations: Allocation[]
}
```

แทนที่ `type TxRow` (บรรทัด 36–39):

```ts
type TxRow =
  | { kind: 'deposit'; id: string; amountTon: number; date: string; note: string | null; type: 'DEPOSIT' | 'REFUND'; refundCampaignName: string | null; remaining: number; hasAllocations: boolean }
  | { kind: 'allocation'; id: string; campaignId: string; campaignName: string; amountTon: number; date: string; totalSpendTon: number }
```

- [ ] **Step 2: อัปเดต transactions array และ render**

แทนที่บรรทัดใน `transactions` map ที่ build deposit row (บรรทัด 133–142):

```ts
  const transactions: TxRow[] = deposits
    .flatMap(d => [
      {
        kind: 'deposit' as const,
        id: d.id,
        amountTon: d.amountTon,
        date: d.depositedAt,
        note: d.note,
        type: d.type,
        refundCampaignName: d.refundCampaignName,
        remaining: d.remaining,
        hasAllocations: d.allocations.length > 0,
      },
      ...d.allocations.map(a => ({
        kind: 'allocation' as const,
        id: a.id,
        campaignId: a.campaignId,
        campaignName: a.campaignName,
        amountTon: a.amountTon,
        date: a.allocatedAt,
        totalSpendTon: a.totalSpendTon,
      })),
    ])
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
```

แทนที่ render section `tx.kind === 'deposit'` ทั้งหมด (บรรทัด 206–236):

```tsx
          tx.kind === 'deposit' ? (
            <div
              key={`dep-${tx.id}`}
              className="flex items-center gap-3 py-2.5 border-b border-border/40 last:border-0"
            >
              <div className="w-8 h-8 rounded-full bg-green-950 text-green-400 flex items-center justify-center text-sm font-bold flex-shrink-0">
                {tx.type === 'REFUND' ? '↩' : '↑'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">
                  {tx.type === 'REFUND'
                    ? `คืนจากแคมเปญ${tx.refundCampaignName ? `: ${tx.refundCampaignName}` : ''}`
                    : `ฝากเงิน${tx.note ? ` · ${tx.note}` : ''}`}
                </p>
                {tx.type === 'DEPOSIT' && (
                  <p className="text-xs text-muted-foreground">
                    คงเหลือ {tx.remaining.toFixed(4)} TON
                  </p>
                )}
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-sm font-semibold text-green-400">+{tx.amountTon.toFixed(4)}</p>
                <p className="text-xs text-muted-foreground">{formatDate(tx.date)}</p>
              </div>
              {!tx.hasAllocations && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive h-7 px-2 text-xs flex-shrink-0"
                  disabled={deletingId === tx.id}
                  onClick={() => handleDeleteDeposit(tx.id)}
                >
                  ลบ
                </Button>
              )}
            </div>
```

- [ ] **Step 3: ตรวจ TypeScript**

```bash
npx tsc --noEmit
```

Expected: ไม่มี error

- [ ] **Step 4: Commit**

```bash
git add src/app/wallet/wallet-client.tsx
git commit -m "feat: wallet list — show REFUND rows with ↩ icon and campaign name"
```

---

## Task 9: Export / Import Backward Compatibility

**Files:**
- Modify: `src/lib/export.ts`

- [ ] **Step 1: อัปเดต `exportData` ใน `src/lib/export.ts`**

แทนที่ `walletDeposits: walletDeposits.map(...)` (บรรทัด 26–33):

```ts
    walletDeposits: walletDeposits.map(d => ({
      id: d.id,
      amountTon: d.amountTon.toString(),
      tonPriceUsd: d.tonPriceUsd.toString(),
      usdThbRate: d.usdThbRate.toString(),
      depositedAt: d.depositedAt.toISOString(),
      note: d.note,
      type: d.type,
      refundCampaignId: d.refundCampaignId ?? null,
      createdAt: d.createdAt.toISOString(),
    })),
```

- [ ] **Step 2: อัปเดต `importData` — WalletDeposit section (บรรทัด 115–126)**

แทนที่ด้วย:

```ts
    for (const d of data.walletDeposits ?? []) {
      await tx.walletDeposit.create({
        data: {
          id: d.id,
          amountTon: d.amountTon,
          tonPriceUsd: d.tonPriceUsd,
          usdThbRate: d.usdThbRate,
          depositedAt: new Date(d.depositedAt),
          note: d.note ?? null,
          type: d.type ?? 'DEPOSIT',
          refundCampaignId: d.refundCampaignId ?? null,
        },
      })
    }
```

หมายเหตุ: REFUND deposits อ้างอิง `refundCampaignId` — campaign ต้องถูก import ก่อน ซึ่งเป็นไปตาม order ปัจจุบันแล้ว (campaign → deposit → allocation)

- [ ] **Step 3: ตรวจ TypeScript**

```bash
npx tsc --noEmit
```

Expected: ไม่มี error

- [ ] **Step 4: Run tests ทั้งหมด**

```bash
npm test
```

Expected: ทุก test ผ่าน

- [ ] **Step 5: Commit**

```bash
git add src/lib/export.ts
git commit -m "feat: export/import — include type+refundCampaignId, backward compat for old JSON"
```

---

## Task 10: Smoke Test ใน Browser

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: ทดสอบ happy path**

1. เข้า `/wallet` — เพิ่ม deposit ใหม่ (ถ้าไม่มี balance)
2. เข้า Campaign Detail ที่ status=ACTIVE — ควรเห็นปุ่ม "ยกเลิกแคมเปญ"
3. กดปุ่ม — ควรเห็น inline form พร้อม estimated refund และ rate auto-fill
4. กรอก refund amount และ submit
5. ยืนยัน: campaign badge เปลี่ยนเป็น CANCELLED (สีแดง)
6. ยืนยัน: ปุ่ม "ยกเลิกแคมเปญ" และ "+ บันทึกวันนี้" หายไป
7. เข้า `/wallet` — ควรเห็น refund row สีเขียว icon ↩ พร้อมชื่อแคมเปญ
8. เข้า Dashboard — campaign card แสดง CANCELLED badge สีแดง

- [ ] **Step 3: ทดสอบ DONE campaign**

1. หา campaign ที่ status=DONE
2. ยืนยันว่าไม่มีปุ่ม "ยกเลิกแคมเปญ" (RefundButton return null)

- [ ] **Step 4: Final test run**

```bash
npm test
```

Expected: ทุก test ผ่าน

- [ ] **Step 5: Commit หากมีการแก้ไขเล็กน้อยจากการทดสอบ**

```bash
git add -p
git commit -m "fix: <ระบุสิ่งที่แก้ไข>"
```

---

## สรุป Commits ที่คาดหวัง

```
feat: add DepositType enum, CANCELLED status, refundCampaignId to schema
test: add wallet balance tests for REFUND deposit behavior
feat: POST /api/campaigns/[id]/refund endpoint
feat: RefundButton client component with inline form
feat: campaign detail — CANCELLED badge, RefundButton, hide entry for CANCELLED
feat: campaign-card CANCELLED badge (destructive variant)
feat: wallet page — include type and refundCampaignName in deposits
feat: wallet list — show REFUND rows with ↩ icon and campaign name
feat: export/import — include type+refundCampaignId, backward compat for old JSON
```
