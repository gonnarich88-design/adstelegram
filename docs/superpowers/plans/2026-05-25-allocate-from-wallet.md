# Allocate Budget from Wallet Page — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow user to allocate TON budget directly from the Wallet page to unallocated campaigns via an inline form on each deposit card, and show the allocated amount on campaign cards on Dashboard.

**Architecture:** Add `AllocateForm` client component that POSTs to the existing `/api/campaigns/[id]/allocation` endpoint with a new optional `depositId` body param. WalletPage server fetches unallocated campaigns and passes them down. DashboardPage includes `allocation` in its campaign query so CampaignCard can display it.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, Prisma 6, Tailwind CSS 4, shadcn/ui, lucide-react

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/app/wallet/allocate-form.tsx` | Create | Inline form: campaign dropdown + amount input + submit |
| `src/app/wallet/wallet-client.tsx` | Modify | Toggle inline AllocateForm per deposit card |
| `src/app/wallet/page.tsx` | Modify | Fetch unallocated campaigns, pass to WalletClient |
| `src/app/api/campaigns/[id]/allocation/route.ts` | Modify | Accept optional `depositId` in POST body |
| `src/app/page.tsx` | Modify | Include `allocation: true` in campaigns query |
| `src/components/campaign-card.tsx` | Modify | Show "จัดสรร X TON" when allocation exists |

---

### Task 1: API — accept `depositId` in POST allocation

**Files:**
- Modify: `src/app/api/campaigns/[id]/allocation/route.ts`

- [ ] **Step 1: Replace the POST handler**

Open `src/app/api/campaigns/[id]/allocation/route.ts` and replace the entire `POST` function with:

```ts
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: campaignId } = await params
    const body = await req.json()
    const amountTon = Number(body.amountTon)
    const depositId: string | undefined = body.depositId

    if (isNaN(amountTon) || amountTon <= 0) {
      return NextResponse.json({ error: 'amountTon must be > 0' }, { status: 400 })
    }

    const existing = await prisma.campaignAllocation.findUnique({
      where: { campaignId },
      include: { deposit: { include: { allocations: true } } },
    })

    if (existing) {
      // UPDATE: validate against same deposit remaining + current amount
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
        data: { amountTon },
      })
      return NextResponse.json({ ok: true })
    }

    // CREATE: use specific deposit if provided
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
        data: { depositId, campaignId, amountTon },
      })
      return NextResponse.json({ ok: true }, { status: 201 })
    }

    // CREATE: FIFO fallback (used by AllocationCard on campaign detail page)
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
      data: { depositId: targetDeposit.id, campaignId, amountTon },
    })

    return NextResponse.json({ ok: true }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Run existing tests to verify no regression**

```bash
npm test
```

Expected: 33 tests pass, 0 failures

- [ ] **Step 3: Commit**

```bash
git add src/app/api/campaigns/\[id\]/allocation/route.ts
git commit -m "feat: allocation POST accepts optional depositId param"
```

---

### Task 2: Create `AllocateForm` component

**Files:**
- Create: `src/app/wallet/allocate-form.tsx`

- [ ] **Step 1: Create the file**

```tsx
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
  depositId,
  maxTon,
  campaigns,
  onCancel,
}: {
  depositId: string
  maxTon: number
  campaigns: Campaign[]
  onCancel: () => void
}) {
  const router = useRouter()
  const [campaignId, setCampaignId] = useState(campaigns[0]?.id ?? '')
  const [amountTon, setAmountTon] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const amount = parseFloat(amountTon)
    if (isNaN(amount) || amount <= 0 || amount > maxTon) {
      setError(`จำนวนต้องอยู่ระหว่าง 0.0001–${maxTon.toFixed(4)}`)
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/allocation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountTon: amount, depositId }),
      })
      if (res.ok) {
        router.refresh()
        onCancel()
      } else {
        const data = await res.json()
        setError(
          data.error === 'INSUFFICIENT_BALANCE'
            ? 'ยอดคงเหลือใน deposit ไม่พอ'
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
    <form onSubmit={handleSubmit} className="mt-3 space-y-3 rounded-md border p-3 bg-muted/10">
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

      <div className="space-y-1.5">
        <Label>จำนวน TON (สูงสุด {maxTon.toFixed(4)})</Label>
        <Input
          type="number"
          step="0.0001"
          min="0.0001"
          max={maxTon}
          value={amountTon}
          onChange={e => setAmountTon(e.target.value)}
          placeholder={maxTon.toFixed(4)}
          required
        />
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

- [ ] **Step 2: Run tests to confirm no breakage**

```bash
npm test
```

Expected: 33 tests pass

- [ ] **Step 3: Commit**

```bash
git add src/app/wallet/allocate-form.tsx
git commit -m "feat: AllocateForm component — campaign dropdown + amount + POST allocation"
```

---

### Task 3: Wire `AllocateForm` into `WalletClient`

**Files:**
- Modify: `src/app/wallet/wallet-client.tsx`

- [ ] **Step 1: Replace the entire file**

```tsx
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

interface Deposit {
  id: string
  amountTon: number
  tonPriceUsd: number
  usdThbRate: number
  depositedAt: string
  note: string | null
  remaining: number
  allocations: Array<{ id: string; campaignId: string; campaignName: string; amountTon: number }>
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
  const [allocatingDepositId, setAllocatingDepositId] = useState<string | null>(null)
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
        <Button onClick={() => setShowDepositForm(true)} disabled={showDepositForm}>
          + ฝากเงิน
        </Button>
      </div>

      {showDepositForm && <DepositForm onCancel={() => setShowDepositForm(false)} />}

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">ประวัติ Deposit</h2>

        {deposits.length === 0 && (
          <p className="text-sm text-muted-foreground">ยังไม่มี deposit</p>
        )}

        {deposits.map(d => (
          <div key={d.id} className="rounded-lg border p-4 space-y-2">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-medium">
                  {new Date(d.depositedAt).toLocaleDateString('th-TH')} · {d.amountTon.toFixed(4)} TON
                </p>
                <p className="text-sm text-muted-foreground">
                  1 TON = ${d.tonPriceUsd.toFixed(4)} / ฿{d.usdThbRate.toFixed(4)}
                </p>
                {d.note && <p className="text-sm text-muted-foreground">{d.note}</p>}
              </div>
              <div className="flex gap-2">
                {d.remaining > 0 && availableCampaigns.length > 0 && allocatingDepositId !== d.id && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setAllocatingDepositId(d.id)}
                  >
                    + จัดสรร
                  </Button>
                )}
                {d.allocations.length === 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive"
                    disabled={deletingId === d.id}
                    onClick={() => handleDeleteDeposit(d.id)}
                  >
                    ลบ
                  </Button>
                )}
              </div>
            </div>

            {d.allocations.length > 0 ? (
              <div className="text-sm text-muted-foreground pl-2 border-l-2 border-muted">
                <p>จัดสรรให้: <span className="text-foreground font-medium">{d.allocations[0].campaignName}</span> · {d.allocations[0].amountTon.toFixed(4)} TON</p>
                <p>คงเหลือ: <span className={d.remaining > 0 ? 'text-green-400' : 'text-muted-foreground'}>{d.remaining.toFixed(4)} TON</span></p>
              </div>
            ) : (
              <p className="text-sm text-green-400 pl-2">ยังไม่ได้จัดสรร · คงเหลือ {d.remaining.toFixed(4)} TON</p>
            )}

            {allocatingDepositId === d.id && (
              <AllocateForm
                depositId={d.id}
                maxTon={d.remaining}
                campaigns={availableCampaigns}
                onCancel={() => setAllocatingDepositId(null)}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Run tests**

```bash
npm test
```

Expected: 33 tests pass

- [ ] **Step 3: Commit**

```bash
git add src/app/wallet/wallet-client.tsx
git commit -m "feat: WalletClient — allocate button + inline AllocateForm per deposit"
```

---

### Task 4: WalletPage server — fetch unallocated campaigns

**Files:**
- Modify: `src/app/wallet/page.tsx`

- [ ] **Step 1: Replace the entire file**

```tsx
import { prisma } from '@/lib/prisma'
import { computeWalletBalance, findCurrentRate } from '@/lib/wallet'
import { WalletClient } from './wallet-client'

export const dynamic = 'force-dynamic'

export default async function WalletPage() {
  const [deposits, unallocatedCampaigns] = await Promise.all([
    prisma.walletDeposit.findMany({
      include: {
        allocations: {
          include: { campaign: { select: { id: true, name: true } } },
        },
      },
      orderBy: { depositedAt: 'desc' },
    }),
    prisma.campaign.findMany({
      where: { allocation: null },
      select: { id: true, name: true, status: true },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  const allAllocations = deposits.flatMap(d =>
    d.allocations.map(a => ({ depositId: a.depositId, amountTon: Number(a.amountTon) }))
  )

  const depositsNormalized = deposits.map(d => ({
    id: d.id,
    amountTon: Number(d.amountTon),
    depositedAt: d.depositedAt,
    tonPriceUsd: Number(d.tonPriceUsd),
    usdThbRate: Number(d.usdThbRate),
  }))

  const balance = computeWalletBalance(depositsNormalized, allAllocations)
  const currentRate = findCurrentRate(depositsNormalized, allAllocations)

  const depositsForClient = deposits.map(d => {
    const allocated = d.allocations.reduce((s, a) => s + Number(a.amountTon), 0)
    return {
      id: d.id,
      amountTon: Number(d.amountTon),
      tonPriceUsd: Number(d.tonPriceUsd),
      usdThbRate: Number(d.usdThbRate),
      depositedAt: d.depositedAt.toISOString(),
      note: d.note,
      remaining: Number(d.amountTon) - allocated,
      allocations: d.allocations.map(a => ({
        id: a.id,
        campaignId: a.campaignId,
        campaignName: a.campaign.name,
        amountTon: Number(a.amountTon),
      })),
    }
  })

  return (
    <WalletClient
      balance={balance}
      currentRate={currentRate}
      deposits={depositsForClient}
      availableCampaigns={unallocatedCampaigns}
    />
  )
}
```

- [ ] **Step 2: Run tests**

```bash
npm test
```

Expected: 33 tests pass

- [ ] **Step 3: Commit**

```bash
git add src/app/wallet/page.tsx
git commit -m "feat: WalletPage fetches unallocated campaigns for AllocateForm"
```

---

### Task 5: Dashboard — include allocation in campaign query + show on card

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/components/campaign-card.tsx`

- [ ] **Step 1: Add `allocation: true` to DashboardPage campaign query**

In `src/app/page.tsx`, find this block:

```ts
prisma.campaign.findMany({
  include: { entries: { orderBy: { date: 'asc' } } },
  orderBy: { createdAt: 'desc' },
}),
```

Replace with:

```ts
prisma.campaign.findMany({
  include: {
    entries: { orderBy: { date: 'asc' } },
    allocation: true,
  },
  orderBy: { createdAt: 'desc' },
}),
```

- [ ] **Step 2: Show allocation on CampaignCard**

In `src/components/campaign-card.tsx`, find this exact block (the closing of the metrics section):

```tsx
          {!metrics && (
            <p className="text-xs text-muted-foreground">ยังไม่มีข้อมูล</p>
          )}
```

Replace with:

```tsx
          {!metrics && (
            <p className="text-xs text-muted-foreground">ยังไม่มีข้อมูล</p>
          )}
          {campaign.allocation && (
            <p className="text-xs text-blue-400">
              จัดสรร {Number(campaign.allocation.amountTon).toFixed(2)} TON จาก Wallet
            </p>
          )}
```

- [ ] **Step 3: Run tests**

```bash
npm test
```

Expected: 33 tests pass

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx src/components/campaign-card.tsx
git commit -m "feat: dashboard shows allocation amount on campaign card"
```

---

### Task 6: Manual verification

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: ทดสอบ allocate จากหน้า Wallet**

1. เปิด `http://localhost:3000/wallet`
2. ตรวจว่า deposit card ที่มียอดเหลือ > 0 มีปุ่ม "+ จัดสรร" (ถ้า dropdown มี campaign ที่ยังไม่มี allocation)
3. กด "+ จัดสรร" → ตรวจว่า inline form เปิดอยู่ใน card นั้น
4. เลือก campaign + ใส่จำนวน TON → กด "จัดสรร"
5. ตรวจว่า form ปิด และ deposit card อัปเดตแสดง "จัดสรรให้: [campaign name]"
6. ตรวจว่า campaign ที่เพิ่งจัดสรรไปหายออกจาก dropdown (ถ้ากด "+ จัดสรร" บน deposit อื่น)

- [ ] **Step 3: ตรวจ Dashboard**

1. เปิด `http://localhost:3000`
2. Campaign card ที่มี allocation ต้องแสดง "จัดสรร X.XX TON จาก Wallet" (ข้อความสีฟ้า)

- [ ] **Step 4: ตรวจ error case**

1. ใส่จำนวน TON มากกว่า remaining → ตรวจว่าแสดง error "ยอดคงเหลือใน deposit ไม่พอ" (frontend validates ก่อน submit)

- [ ] **Step 5: อัปเดต PROGRESS.md และ commit ปิด feature**

```bash
git add docs/PROGRESS.md
git commit -m "docs: update PROGRESS.md — allocate from wallet page complete"
```
