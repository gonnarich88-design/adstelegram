# Wallet Flat-List + allocatedAt Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เพิ่ม `allocatedAt` field ใน CampaignAllocation และ redesign หน้า `/wallet` เป็น flat transaction list สไตล์ dark mode

**Architecture:** Schema migration เพิ่ม `allocatedAt` column → API routes expose/accept field → export/import preserve field → WalletPage serialize → WalletClient redesign เป็น flat list ที่ merge deposits+allocations เรียง desc by date พร้อม AllocateForm ที่มี date picker

**Tech Stack:** Next.js 16 App Router, Prisma 6, PostgreSQL, React 19, TypeScript strict, Tailwind CSS 4, shadcn/ui

**Spec:** `docs/superpowers/specs/2026-05-25-wallet-flat-list-allocatedAt-design.md`

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `prisma/schema.prisma` | Modify | เพิ่ม `allocatedAt` field |
| `prisma/migrations/20260525000001_*/` | Create (auto) | Migration SQL |
| `src/app/api/campaigns/[id]/allocation/route.ts` | Modify | POST รับ `allocatedAt`; GET expose ค่า |
| `src/app/api/wallet/deposits/route.ts` | Modify | GET include `allocatedAt` ใน allocations |
| `src/lib/export.ts` | Modify | backup/restore ต้อง preserve `allocatedAt` |
| `src/app/wallet/page.tsx` | Modify | serialize `allocatedAt` ส่งไป WalletClient |
| `src/app/wallet/allocate-form.tsx` | Modify | ตัด depositId/maxTon, เพิ่ม balance + date field |
| `src/app/wallet/wallet-client.tsx` | Modify | redesign ทั้งหมด: flat transaction list |

---

## Task 1: Schema Migration

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: เพิ่ม `allocatedAt` ใน CampaignAllocation**

เปิด `prisma/schema.prisma` หา model `CampaignAllocation` แล้วเพิ่ม field หลัง `amountTon`:

```prisma
model CampaignAllocation {
  id          String        @id @default(cuid())
  depositId   String
  campaignId  String        @unique
  amountTon   Decimal       @db.Decimal(18, 8)
  allocatedAt DateTime      @default(now())
  createdAt   DateTime      @default(now())
  deposit     WalletDeposit @relation(fields: [depositId], references: [id])
  campaign    Campaign      @relation(fields: [campaignId], references: [id], onDelete: Cascade)
}
```

- [ ] **Step 2: Run migration**

```bash
npx prisma migrate dev --name add_allocation_date
```

Expected output: `✔ Generated Prisma Client` พร้อม migration file ใหม่ใน `prisma/migrations/`

ถ้า prompt ถามชื่อ migration ให้พิมพ์: `add_allocation_date`

- [ ] **Step 3: ตรวจสอบ migration file สร้างขึ้นถูกต้อง**

```bash
cat prisma/migrations/$(ls prisma/migrations | tail -1)/migration.sql
```

Expected: มี `ALTER TABLE "CampaignAllocation" ADD COLUMN "allocatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;`

- [ ] **Step 4: Run tests**

```bash
npm test
```

Expected: ทุก test ผ่าน (33 tests)

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add allocatedAt to CampaignAllocation schema"
```

---

## Task 2: API — allocation route รับ + expose allocatedAt

**Files:**
- Modify: `src/app/api/campaigns/[id]/allocation/route.ts`

- [ ] **Step 1: แทนไฟล์ทั้งหมด**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const allocation = await prisma.campaignAllocation.findUnique({
      where: { campaignId: id },
      include: { deposit: true },
    })

    if (!allocation) return NextResponse.json(null)

    return NextResponse.json({
      id: allocation.id,
      amountTon: Number(allocation.amountTon),
      depositId: allocation.depositId,
      allocatedAt: allocation.allocatedAt.toISOString(),
      tonPriceUsd: Number(allocation.deposit.tonPriceUsd),
      usdThbRate: Number(allocation.deposit.usdThbRate),
      depositedAt: allocation.deposit.depositedAt.toISOString(),
    })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: campaignId } = await params
    const body = await req.json()
    const amountTon = Number(body.amountTon)
    const depositId: string | undefined = body.depositId
    const allocatedAt: Date | undefined = body.allocatedAt ? new Date(body.allocatedAt) : undefined

    if (isNaN(amountTon) || amountTon <= 0) {
      return NextResponse.json({ error: 'amountTon must be > 0' }, { status: 400 })
    }

    const existing = await prisma.campaignAllocation.findUnique({
      where: { campaignId },
      include: { deposit: { include: { allocations: true } } },
    })

    if (existing) {
      const depositTotal = Number(existing.deposit.amountTon)
      const depositAllocated = existing.deposit.allocations.reduce(
        (s, a) => s + Number(a.amountTon),
        0
      )
      const depositRemaining = depositTotal - depositAllocated
      const currentAmount = Number(existing.amountTon)
      const maxAllowed = depositRemaining + currentAmount

      if (amountTon > maxAllowed) {
        return NextResponse.json({ error: 'INSUFFICIENT_BALANCE' }, { status: 400 })
      }

      await prisma.campaignAllocation.update({
        where: { campaignId },
        data: { amountTon, ...(allocatedAt ? { allocatedAt } : {}) },
      })
      return NextResponse.json({ ok: true })
    }

    if (depositId) {
      const deposit = await prisma.walletDeposit.findUnique({
        where: { id: depositId },
        include: { allocations: true },
      })
      if (!deposit) {
        return NextResponse.json({ error: 'Deposit not found' }, { status: 404 })
      }
      const allocated = deposit.allocations.reduce((s, a) => s + Number(a.amountTon), 0)
      const remaining = Number(deposit.amountTon) - allocated
      if (remaining < amountTon) {
        return NextResponse.json({ error: 'INSUFFICIENT_BALANCE' }, { status: 400 })
      }
      await prisma.campaignAllocation.create({
        data: { depositId, campaignId, amountTon, ...(allocatedAt ? { allocatedAt } : {}) },
      })
      return NextResponse.json({ ok: true }, { status: 201 })
    }

    // FIFO fallback
    const deposits = await prisma.walletDeposit.findMany({
      include: { allocations: true },
      orderBy: { depositedAt: 'asc' },
    })

    const targetDeposit = deposits.find(d => {
      const allocated = d.allocations.reduce((s, a) => s + Number(a.amountTon), 0)
      return Number(d.amountTon) - allocated >= amountTon
    })

    if (!targetDeposit) {
      return NextResponse.json({ error: 'INSUFFICIENT_BALANCE' }, { status: 400 })
    }

    await prisma.campaignAllocation.create({
      data: {
        depositId: targetDeposit.id,
        campaignId,
        amountTon,
        ...(allocatedAt ? { allocatedAt } : {}),
      },
    })

    return NextResponse.json({ ok: true }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: campaignId } = await params
    const existing = await prisma.campaignAllocation.findUnique({
      where: { campaignId },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    await prisma.campaignAllocation.delete({ where: { campaignId } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Run tests**

```bash
npm test
```

Expected: ทุก test ผ่าน

- [ ] **Step 3: Commit**

```bash
git add src/app/api/campaigns/
git commit -m "feat: allocation API accepts and exposes allocatedAt"
```

---

## Task 3: API — deposits GET expose allocatedAt

**Files:**
- Modify: `src/app/api/wallet/deposits/route.ts`

- [ ] **Step 1: เพิ่ม `allocatedAt` ใน allocation response**

ใน `GET` handler หา `allocations: d.allocations.map(...)` แล้วเพิ่ม field:

```typescript
allocations: d.allocations.map(a => ({
  id: a.id,
  campaignId: a.campaignId,
  campaignName: a.campaign.name,
  amountTon: Number(a.amountTon),
  allocatedAt: a.allocatedAt.toISOString(),
})),
```

(แทนที่ block เดิมที่ไม่มี `allocatedAt`)

- [ ] **Step 2: Commit**

```bash
git add src/app/api/wallet/deposits/route.ts
git commit -m "feat: deposits API exposes allocatedAt on allocations"
```

---

## Task 4: lib/export.ts — preserve allocatedAt ใน backup/restore

**Files:**
- Modify: `src/lib/export.ts`

- [ ] **Step 1: เพิ่ม `allocatedAt` ใน exportData**

ใน `exportData()` หา `campaignAllocations: campaignAllocations.map(a => ({` แล้วเพิ่ม field:

```typescript
campaignAllocations: campaignAllocations.map(a => ({
  id: a.id,
  depositId: a.depositId,
  campaignId: a.campaignId,
  amountTon: a.amountTon.toString(),
  allocatedAt: a.allocatedAt.toISOString(),
  createdAt: a.createdAt.toISOString(),
})),
```

- [ ] **Step 2: เพิ่ม `allocatedAt` ใน importData**

ใน `importData()` หา `for (const a of data.campaignAllocations ?? [])` แล้วเปลี่ยน create data:

```typescript
for (const a of data.campaignAllocations ?? []) {
  await tx.campaignAllocation.create({
    data: {
      id: a.id,
      depositId: a.depositId,
      campaignId: a.campaignId,
      amountTon: a.amountTon,
      ...(a.allocatedAt ? { allocatedAt: new Date(a.allocatedAt) } : {}),
    },
  })
}
```

(spread `allocatedAt` แบบ conditional — backup เก่าที่ไม่มี field นี้จะ fallback ไป `@default(now())` ได้เลย)

- [ ] **Step 3: Run tests**

```bash
npm test
```

Expected: ทุก test ผ่าน (export test ไม่กระทบเพราะ mock คืน `[]`)

- [ ] **Step 4: Commit**

```bash
git add src/lib/export.ts
git commit -m "feat: export/import preserves allocatedAt on CampaignAllocation"
```

---

## Task 5: wallet/page.tsx — serialize allocatedAt

**Files:**
- Modify: `src/app/wallet/page.tsx`

- [ ] **Step 1: เพิ่ม `allocatedAt` ใน depositsForClient**

หา block `allocations: d.allocations.map(a => ({` แล้วเพิ่ม field:

```typescript
allocations: d.allocations.map(a => ({
  id: a.id,
  campaignId: a.campaignId,
  campaignName: a.campaign.name,
  amountTon: Number(a.amountTon),
  allocatedAt: a.allocatedAt.toISOString(),
})),
```

- [ ] **Step 2: ตรวจ TypeScript**

```bash
npx tsc --noEmit
```

Expected: ไม่มี error

- [ ] **Step 3: Commit**

```bash
git add src/app/wallet/page.tsx
git commit -m "feat: wallet page serializes allocatedAt for client"
```

---

## Task 6: AllocateForm — เปลี่ยน props + เพิ่ม date field

**Files:**
- Modify: `src/app/wallet/allocate-form.tsx`

- [ ] **Step 1: แทนไฟล์ทั้งหมด**

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface Campaign {
  id: string
  name: string
  status: string
}

export function AllocateForm({
  balance,
  campaigns,
  onCancel,
}: {
  balance: number
  campaigns: Campaign[]
  onCancel: () => void
}) {
  const router = useRouter()
  const today = new Date().toISOString().split('T')[0]
  const [campaignId, setCampaignId] = useState(campaigns[0]?.id ?? '')
  const [amountTon, setAmountTon] = useState('')
  const [allocatedAt, setAllocatedAt] = useState(today)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const amount = parseFloat(amountTon)
    if (isNaN(amount) || amount < 0.00000001 || amount > balance) {
      setError(`จำนวนต้องอยู่ระหว่าง 0.00000001–${balance.toFixed(4)}`)
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/allocation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountTon: amount, allocatedAt }),
      })
      if (res.ok) {
        router.refresh()
        onCancel()
      } else {
        const data = await res.json()
        setError(
          data.error === 'INSUFFICIENT_BALANCE'
            ? 'ยอดคงเหลือใน wallet ไม่พอ'
            : (data.error ?? 'จัดสรรไม่สำเร็จ ลองใหม่อีกครั้ง')
        )
      }
    } catch {
      setError('จัดสรรไม่สำเร็จ ลองใหม่อีกครั้ง')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-1 mb-2 space-y-3 rounded-md border p-3 bg-muted/10">
      <p className="text-sm font-medium">จัดสรรงบให้ Campaign</p>

      <div className="space-y-1.5">
        <Label>Campaign</Label>
        <select
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          value={campaignId}
          onChange={e => setCampaignId(e.target.value)}
          required
        >
          {campaigns.map(c => (
            <option key={c.id} value={c.id}>
              {c.name}{c.status !== 'ACTIVE' ? ` (${c.status})` : ''}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>วันที่จัดสรร</Label>
          <Input
            type="date"
            value={allocatedAt}
            onChange={e => setAllocatedAt(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label>จำนวน TON (สูงสุด {balance.toFixed(4)})</Label>
          <Input
            type="number"
            step="0.00000001"
            min="0.00000001"
            max={balance}
            value={amountTon}
            onChange={e => setAmountTon(e.target.value)}
            placeholder={balance.toFixed(4)}
            required
          />
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={loading || !campaignId}>
          {loading ? 'กำลังจัดสรร...' : 'จัดสรร'}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onCancel}>
          ยกเลิก
        </Button>
      </div>
    </form>
  )
}
```

- [ ] **Step 2: ตรวจ TypeScript**

```bash
npx tsc --noEmit
```

Expected: ไม่มี error (WalletClient ยังใช้ props เก่าอยู่ จะ error จนกว่าจะแก้ Task 7)

- [ ] **Step 3: หมายเหตุ** TypeScript error ที่ `wallet-client.tsx` ในขั้นนี้เป็นเรื่องปกติ — จะแก้ใน Task 7

---

## Task 7: WalletClient — redesign flat transaction list

**Files:**
- Modify: `src/app/wallet/wallet-client.tsx`

- [ ] **Step 1: แทนไฟล์ทั้งหมด**

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { DepositForm } from './deposit-form'
import { AllocateForm } from './allocate-form'

interface Campaign {
  id: string
  name: string
  status: string
}

interface Allocation {
  id: string
  campaignId: string
  campaignName: string
  amountTon: number
  allocatedAt: string
}

interface Deposit {
  id: string
  amountTon: number
  tonPriceUsd: number
  usdThbRate: number
  depositedAt: string
  note: string | null
  remaining: number
  allocations: Allocation[]
}

type TxRow =
  | { kind: 'deposit'; id: string; amountTon: number; date: string; note: string | null; remaining: number; hasAllocations: boolean }
  | { kind: 'allocation'; id: string; campaignName: string; amountTon: number; date: string }

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })
}

export function WalletClient({
  balance,
  currentRate,
  deposits,
  availableCampaigns,
}: {
  balance: number
  currentRate: { tonPriceUsd: number; usdThbRate: number } | null
  deposits: Deposit[]
  availableCampaigns: Campaign[]
}) {
  const router = useRouter()
  const [showDepositForm, setShowDepositForm] = useState(false)
  const [showAllocateForm, setShowAllocateForm] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function handleDeleteDeposit(id: string) {
    setDeletingId(id)
    try {
      const res = await fetch(`/api/wallet/deposits/${id}`, { method: 'DELETE' })
      if (res.ok) {
        router.refresh()
      } else {
        const data = await res.json()
        alert(data.error ?? 'ลบไม่ได้ — deposit นี้มีการจัดสรรแล้ว')
      }
    } finally {
      setDeletingId(null)
    }
  }

  const transactions: TxRow[] = deposits
    .flatMap(d => [
      {
        kind: 'deposit' as const,
        id: d.id,
        amountTon: d.amountTon,
        date: d.depositedAt,
        note: d.note,
        remaining: d.remaining,
        hasAllocations: d.allocations.length > 0,
      },
      ...d.allocations.map(a => ({
        kind: 'allocation' as const,
        id: a.id,
        campaignName: a.campaignName,
        amountTon: a.amountTon,
        date: a.allocatedAt,
      })),
    ])
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  const canAllocate = balance > 0 && availableCampaigns.length > 0

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">TON Wallet</h1>
          <p className="text-3xl font-bold mt-1">{balance.toFixed(4)} TON</p>
          {currentRate ? (
            <p className="text-sm text-muted-foreground mt-1">
              1 TON = ${currentRate.tonPriceUsd.toFixed(4)} / ฿{currentRate.usdThbRate.toFixed(4)}
              <span className="ml-2 text-xs">(อัตราของ deposit เก่าที่สุดที่ยังมีเงินเหลือ)</span>
            </p>
          ) : (
            <p className="text-sm text-muted-foreground mt-1">ไม่มี deposit ที่มีเงินเหลือ</p>
          )}
        </div>
        <Button
          onClick={() => { setShowDepositForm(true); setShowAllocateForm(false) }}
          disabled={showDepositForm}
        >
          + ฝากเงิน
        </Button>
      </div>

      {showDepositForm && <DepositForm onCancel={() => setShowDepositForm(false)} />}

      <div className="space-y-1">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">ประวัติ</h2>
          {canAllocate && !showAllocateForm && (
            <Button size="sm" variant="outline" onClick={() => setShowAllocateForm(true)}>
              + จัดสรร
            </Button>
          )}
        </div>

        {showAllocateForm && (
          <AllocateForm
            balance={balance}
            campaigns={availableCampaigns}
            onCancel={() => setShowAllocateForm(false)}
          />
        )}

        {transactions.length === 0 && (
          <p className="text-sm text-muted-foreground py-8 text-center">ยังไม่มี transaction</p>
        )}

        {transactions.map(tx =>
          tx.kind === 'deposit' ? (
            <div
              key={`dep-${tx.id}`}
              className="flex items-center gap-3 py-2.5 border-b border-border/40 last:border-0"
            >
              <div className="w-8 h-8 rounded-full bg-green-950 text-green-400 flex items-center justify-center text-sm font-bold flex-shrink-0">
                ↑
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">
                  ฝากเงิน{tx.note ? ` · ${tx.note}` : ''}
                </p>
                <p className="text-xs text-muted-foreground">
                  คงเหลือ {tx.remaining.toFixed(4)} TON
                </p>
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
          ) : (
            <div
              key={`alloc-${tx.id}`}
              className="flex items-center gap-3 py-2.5 border-b border-border/40 last:border-0"
            >
              <div className="w-8 h-8 rounded-full bg-red-950 text-red-400 flex items-center justify-center text-sm flex-shrink-0">
                →
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{tx.campaignName}</p>
                <p className="text-xs text-muted-foreground">จัดสรรให้ Campaign</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-sm font-semibold text-red-400">−{tx.amountTon.toFixed(4)}</p>
                <p className="text-xs text-muted-foreground">{formatDate(tx.date)}</p>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: ตรวจ TypeScript**

```bash
npx tsc --noEmit
```

Expected: ไม่มี error

- [ ] **Step 3: Run tests**

```bash
npm test
```

Expected: ทุก test ผ่าน

- [ ] **Step 4: Commit**

```bash
git add src/app/wallet/
git commit -m "feat: wallet page redesign — flat transaction list with date field on allocation"
```

---

## Task 8: Verify ใน Browser

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: เปิด http://localhost:3000/wallet**

ตรวจสอบ:
- [ ] Balance header แสดงถูกต้อง
- [ ] Transaction rows แสดงทั้ง deposits (↑ เขียว) และ allocations (→ แดง) เรียงล่าสุดก่อน
- [ ] คลิก "+ จัดสรร" → form เปิด มี dropdown Campaign + date picker + จำนวน
- [ ] date picker default เป็นวันนี้
- [ ] กรอก form แล้ว submit → allocation ใหม่ปรากฏใน list พร้อมวันที่ที่กรอก
- [ ] Deposit ที่ยังไม่มี allocation แสดงปุ่ม "ลบ"

- [ ] **Step 3: Final commit ถ้ามี tweak**

```bash
git add -p
git commit -m "fix: wallet UI tweaks after browser verification"
```

---

## Self-Review Checklist (ผ่านแล้ว)

| Requirement | Task |
|---|---|
| เพิ่ม `allocatedAt` field ใน schema | Task 1 |
| API POST รับ `allocatedAt` | Task 2 |
| API GET expose `allocatedAt` | Task 2 |
| deposits GET expose `allocatedAt` | Task 3 |
| export/import preserve `allocatedAt` | Task 4 |
| wallet/page.tsx serialize | Task 5 |
| AllocateForm date picker + เปลี่ยน props | Task 6 |
| WalletClient flat list dark mode | Task 7 |
| ↑ deposit row (เขียว) + → allocation row (แดง) | Task 7 |
| sort desc by date | Task 7 |
| delete deposit ยังทำงานได้ | Task 7 |
| browser verification | Task 8 |
