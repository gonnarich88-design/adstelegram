# Campaign Manual Sort Order — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ให้ผู้ใช้เรียงลำดับแคมเปญขึ้น/ลงภายในแต่ละกลุ่ม (Channels, Bots, Search, ไม่ระบุ) ด้วยปุ่ม ▲ ▼ และบันทึกลำดับไว้ใน DB

**Architecture:** เพิ่ม field `sortOrder Int @default(0)` บน Campaign model → API endpoint `PATCH /api/campaigns/reorder` รับ array ของ `{id, sortOrder}` → Client Component `CampaignList` จัดการ state + optimistic update + เรียก API → `campaigns/page.tsx` serialize Prisma objects ก่อนส่งให้ Client Component

**Tech Stack:** Prisma migration, Next.js App Router route handler, React `useState`, `lucide-react` (ChevronUp/ChevronDown — มีอยู่แล้ว), Vitest

---

## File Map

| Action | File |
|--------|------|
| Modify | `prisma/schema.prisma` |
| Create | `prisma/migrations/<timestamp>_add_campaign_sort_order/` (auto-generated) |
| Create | `src/app/api/campaigns/reorder/route.ts` |
| Create | `tests/reorder-route.test.ts` |
| Create | `src/components/campaign-list.tsx` |
| Modify | `src/app/campaigns/page.tsx` |
| Modify | `src/lib/export.ts` |
| Modify | `tests/export.test.ts` |

---

## Task 1: Schema — เพิ่ม sortOrder บน Campaign

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: เพิ่ม field ใน schema**

ใน `prisma/schema.prisma` ใต้ `updatedAt DateTime @updatedAt` ของ model `Campaign` (บรรทัดประมาณ 33) เพิ่ม:

```prisma
  sortOrder      Int                  @default(0)
```

ผลลัพธ์ท้าย model Campaign:
```prisma
  createdAt      DateTime             @default(now())
  updatedAt      DateTime             @updatedAt
  sortOrder      Int                  @default(0)
}
```

- [ ] **Step 2: Run migration**

```bash
npx prisma migrate dev --name add_campaign_sort_order
```

Expected: สร้าง migration file ใหม่ใน `prisma/migrations/` และ apply ลง DB สำเร็จ

- [ ] **Step 3: Regenerate Prisma client**

```bash
npx prisma generate
```

Expected: Prisma Client ถูก regenerate สำเร็จ

- [ ] **Step 4: Run tests ให้ผ่าน**

```bash
npm test
```

Expected: ทุก test ผ่าน (56 tests)

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add sortOrder field to Campaign"
```

---

## Task 2: API — PATCH /api/campaigns/reorder

**Files:**
- Create: `src/app/api/campaigns/reorder/route.ts`
- Create: `tests/reorder-route.test.ts`

- [ ] **Step 1: เขียน test ที่ยังไม่ผ่าน**

สร้างไฟล์ `tests/reorder-route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockCampaignUpdate = vi.fn()
const mockTransaction = vi.fn()

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: mockTransaction,
    campaign: { update: mockCampaignUpdate },
  },
}))

function makeReq(body: unknown) {
  return new NextRequest('http://localhost/api/campaigns/reorder', {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('PATCH /api/campaigns/reorder', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 400 when body is not an array', async () => {
    const { PATCH } = await import('@/app/api/campaigns/reorder/route')
    const res = await PATCH(makeReq({ id: 'x', sortOrder: 0 }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when body is empty array', async () => {
    const { PATCH } = await import('@/app/api/campaigns/reorder/route')
    const res = await PATCH(makeReq([]))
    expect(res.status).toBe(400)
  })

  it('calls prisma.$transaction and returns 200', async () => {
    mockTransaction.mockResolvedValueOnce(undefined)
    const { PATCH } = await import('@/app/api/campaigns/reorder/route')
    const res = await PATCH(makeReq([
      { id: 'c1', sortOrder: 0 },
      { id: 'c2', sortOrder: 1 },
    ]))
    expect(res.status).toBe(200)
    expect(mockTransaction).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 2: Run test ให้เห็นว่า fail (ไฟล์ยังไม่มี)**

```bash
npm test tests/reorder-route.test.ts
```

Expected: FAIL — "Cannot find module"

- [ ] **Step 3: สร้าง route handler**

สร้างไฟล์ `src/app/api/campaigns/reorder/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    if (!Array.isArray(body) || body.length === 0) {
      return NextResponse.json({ error: 'Expected non-empty array' }, { status: 400 })
    }
    await prisma.$transaction(
      body.map(({ id, sortOrder }: { id: string; sortOrder: number }) =>
        prisma.campaign.update({ where: { id }, data: { sortOrder } })
      )
    )
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

- [ ] **Step 4: Run test ให้ผ่าน**

```bash
npm test tests/reorder-route.test.ts
```

Expected: 3 tests PASS

- [ ] **Step 5: Run tests ทั้งหมด**

```bash
npm test
```

Expected: ทุก test ผ่าน

- [ ] **Step 6: Commit**

```bash
git add src/app/api/campaigns/reorder/route.ts tests/reorder-route.test.ts
git commit -m "feat: add PATCH /api/campaigns/reorder endpoint"
```

---

## Task 3: Client Component — CampaignList

**Files:**
- Create: `src/components/campaign-list.tsx`

Component นี้รับ campaigns เป็น plain object (serialized แล้ว) จาก Server Component และจัดการ UI ทั้งหมดของหน้า campaigns list

- [ ] **Step 1: สร้างไฟล์ campaign-list.tsx**

สร้างไฟล์ `src/components/campaign-list.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { ChevronUp, ChevronDown } from 'lucide-react'
import { CampaignRow } from './campaign-row'

type SerializedCampaign = {
  id: string
  placementType: string | null
  status: string
  sortOrder: number
  createdAt: string
  [key: string]: unknown
}

function sortGroup(group: SerializedCampaign[]): SerializedCampaign[] {
  return [...group].sort((a, b) => {
    const bySort = (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
    if (bySort !== 0) return bySort
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })
}

function computeMove(
  group: SerializedCampaign[],
  idx: number,
  dir: 'up' | 'down'
): SerializedCampaign[] {
  const m = group.map((c, i) => ({ ...c, sortOrder: i }))
  const target = dir === 'up' ? idx - 1 : idx + 1
  const tmp = m[idx].sortOrder
  m[idx] = { ...m[idx], sortOrder: m[target].sortOrder }
  m[target] = { ...m[target], sortOrder: tmp }
  return m.sort((a, b) => a.sortOrder - b.sortOrder)
}

function persistOrder(items: SerializedCampaign[]) {
  fetch('/api/campaigns/reorder', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(items.map(c => ({ id: c.id, sortOrder: c.sortOrder }))),
  })
}

export function CampaignList({ campaigns: initial }: { campaigns: SerializedCampaign[] }) {
  const [campaigns, setCampaigns] = useState(initial)

  function handleMove(group: SerializedCampaign[], idx: number, dir: 'up' | 'down') {
    const newGroup = computeMove(group, idx, dir)
    const groupIds = new Set(group.map(c => c.id))
    setCampaigns(prev => [...prev.filter(c => !groupIds.has(c.id)), ...newGroup])
    persistOrder(newGroup)
  }

  const active = campaigns.filter(c => c.status !== 'CANCELLED')
  const groups: { label: string; items: SerializedCampaign[]; sortable: boolean }[] = [
    { label: 'Channels', items: sortGroup(active.filter(c => c.placementType === 'CHANNEL')), sortable: true },
    { label: 'Bots',     items: sortGroup(active.filter(c => c.placementType === 'BOT')),     sortable: true },
    { label: 'Search',   items: sortGroup(active.filter(c => c.placementType === 'SEARCH')),  sortable: true },
    { label: 'ไม่ระบุ',  items: sortGroup(active.filter(c => !c.placementType)),              sortable: true },
    { label: 'Cancelled', items: campaigns.filter(c => c.status === 'CANCELLED'),             sortable: false },
  ]

  return (
    <div className="space-y-8">
      {groups.map(({ label, items, sortable }) =>
        items.length === 0 ? null : (
          <div key={label}>
            <div className="flex items-center gap-2 mb-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                {label}
              </h2>
              <span className="text-xs text-muted-foreground">· {items.length}</span>
            </div>
            <div className="space-y-1.5">
              {items.map((c, i) => (
                <div key={c.id} className="flex items-center gap-1.5">
                  {sortable && (
                    <div className="flex flex-col gap-0.5 shrink-0">
                      <button
                        onClick={() => handleMove(items, i, 'up')}
                        disabled={i === 0}
                        className="p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-0 disabled:pointer-events-none transition-colors"
                        aria-label="ขึ้น"
                      >
                        <ChevronUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleMove(items, i, 'down')}
                        disabled={i === items.length - 1}
                        className="p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-0 disabled:pointer-events-none transition-colors"
                        aria-label="ลง"
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <CampaignRow campaign={c} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      )}
    </div>
  )
}
```

- [ ] **Step 2: Run tests ให้ผ่าน (ไม่มี test ใหม่สำหรับ UI component)**

```bash
npm test
```

Expected: ทุก test ผ่าน

- [ ] **Step 3: Commit**

```bash
git add src/components/campaign-list.tsx
git commit -m "feat: add CampaignList client component with sort buttons"
```

---

## Task 4: Update campaigns/page.tsx

**Files:**
- Modify: `src/app/campaigns/page.tsx`

Server Component ต้อง serialize Decimal/Date objects จาก Prisma ก่อนส่งให้ Client Component เพราะ Prisma Decimal เป็น class instance ส่งข้าม Server→Client boundary ไม่ได้โดยตรง

- [ ] **Step 1: แก้ไข page.tsx**

แทนที่เนื้อหาทั้งหมดของ `src/app/campaigns/page.tsx` ด้วย:

```tsx
import { prisma } from '@/lib/prisma'
import { CampaignList } from '@/components/campaign-list'
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'

export const dynamic = 'force-dynamic'

export default async function CampaignsPage() {
  const campaigns = await prisma.campaign.findMany({
    include: {
      entries: { orderBy: { date: 'asc' } },
      allocations: true,
    },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
  })

  const serialized = campaigns.map(c => ({
    id: c.id,
    name: c.name,
    targetType: c.targetType,
    targetName: c.targetName,
    startDate: c.startDate.toISOString(),
    endDate: c.endDate?.toISOString() ?? null,
    budgetTon: c.budgetTon?.toString() ?? null,
    dailyBudgetTon: c.dailyBudgetTon.toString(),
    bidCpmTon: c.bidCpmTon?.toString() ?? null,
    status: c.status,
    placementName: c.placementName ?? null,
    placementType: c.placementType ?? null,
    note: c.note ?? null,
    goalText: c.goalText ?? null,
    planText: c.planText ?? null,
    targetJoins: c.targetJoins ?? null,
    targetDate: c.targetDate?.toISOString() ?? null,
    sortOrder: c.sortOrder,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
    entries: c.entries.map(e => ({
      id: e.id,
      campaignId: e.campaignId,
      date: e.date.toISOString(),
      spendTon: e.spendTon.toString(),
      dailyBudgetTon: e.dailyBudgetTon.toString(),
      tonPriceUsd: e.tonPriceUsd.toString(),
      usdThbRate: e.usdThbRate.toString(),
      impressions: e.impressions,
      views: e.views,
      clicks: e.clicks,
      joins: e.joins,
      note: e.note ?? null,
    })),
    allocations: c.allocations.map(a => ({
      id: a.id,
      depositId: a.depositId,
      campaignId: a.campaignId,
      amountTon: a.amountTon.toString(),
    })),
  }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Campaigns</h1>
        <Link href="/campaigns/new" className={buttonVariants({ size: 'sm' })}>
          + Campaign
        </Link>
      </div>

      {campaigns.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="mb-4">ยังไม่มี campaign</p>
          <Link href="/campaigns/new" className={buttonVariants()}>
            สร้าง campaign แรก
          </Link>
        </div>
      ) : (
        <CampaignList campaigns={serialized} />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Run tests**

```bash
npm test
```

Expected: ทุก test ผ่าน

- [ ] **Step 3: Commit**

```bash
git add src/app/campaigns/page.tsx
git commit -m "feat: use CampaignList component, serialize Prisma objects for client boundary"
```

---

## Task 5: Export/Import — รองรับ sortOrder

**Files:**
- Modify: `src/lib/export.ts`
- Modify: `tests/export.test.ts`

- [ ] **Step 1: เขียน test ที่ยังไม่ผ่าน**

เพิ่ม describe block ใหม่ต่อท้าย `tests/export.test.ts`:

```ts
describe('importData backward compat — missing sortOrder', () => {
  it('defaults sortOrder to 0 when field absent from JSON', async () => {
    const { prisma } = await import('@/lib/prisma')
    const mockTx = {
      campaignChangeLog: { deleteMany: vi.fn(), create: vi.fn() },
      campaignAllocation: { deleteMany: vi.fn() },
      performanceEntry: { deleteMany: vi.fn() },
      campaign: { deleteMany: vi.fn(), create: vi.fn() },
      walletDeposit: { deleteMany: vi.fn(), create: vi.fn() },
      dailyConversion: { deleteMany: vi.fn(), create: vi.fn() },
      globalGoal: { deleteMany: vi.fn(), upsert: vi.fn() },
    }
    vi.mocked(prisma.$transaction).mockImplementationOnce((fn: any) => fn(mockTx))

    const { importData } = await import('@/lib/export')
    await importData({
      version: 2,
      exportedAt: new Date().toISOString(),
      campaigns: [{
        id: 'c1',
        name: 'Old Campaign',
        targetType: 'CHANNEL',
        targetName: '@test',
        startDate: new Date().toISOString(),
        endDate: null,
        dailyBudgetTon: '5',
        budgetTon: null,
        status: 'ACTIVE',
        placementName: null,
        note: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        entries: [],
        // sortOrder intentionally absent (old JSON)
      }],
    })

    expect(mockTx.campaign.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ sortOrder: 0 }) })
    )
  })
})
```

- [ ] **Step 2: Run test ให้เห็นว่า fail**

```bash
npm test tests/export.test.ts
```

Expected: FAIL — sortOrder not found in create call

- [ ] **Step 3: แก้ export.ts — เพิ่ม sortOrder ใน exportData และ importData**

ใน `src/lib/export.ts`:

**exportData** — ใน `campaigns: campaigns.map(c => ({` เพิ่ม field หลัง `targetDate`:
```ts
      sortOrder: c.sortOrder,
```

**importData** — ใน `tx.campaign.create({ data: { ... } })` เพิ่ม field หลัง `targetDate: ...`:
```ts
          sortOrder: c.sortOrder ?? 0,
```

- [ ] **Step 4: Run test ให้ผ่าน**

```bash
npm test tests/export.test.ts
```

Expected: ทุก test ผ่าน รวม backward compat test ใหม่

- [ ] **Step 5: Run tests ทั้งหมด**

```bash
npm test
```

Expected: ทุก test ผ่าน

- [ ] **Step 6: Commit**

```bash
git add src/lib/export.ts tests/export.test.ts
git commit -m "feat: include sortOrder in export/import with backward compat"
```

---

## Task 6: Manual Smoke Test

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: เปิด http://localhost:3000/campaigns**

Expected: แต่ละแถวในกลุ่ม Channels/Bots/Search/ไม่ระบุ มีปุ่ม ▲ ▼ ด้านซ้าย
- แถวบนสุดของกลุ่ม: เห็นเฉพาะ ▼ (▲ ซ่อน)
- แถวล่างสุดของกลุ่ม: เห็นเฉพาะ ▲ (▼ ซ่อน)
- กลุ่ม Cancelled: ไม่มีปุ่ม

- [ ] **Step 3: กดปุ่ม ▼ บน campaign ตัวแรกในกลุ่มใดก็ได้**

Expected:
- ลำดับเปลี่ยนทันที (optimistic)
- ไม่มี page reload

- [ ] **Step 4: Reload หน้า**

Expected: ลำดับที่เปลี่ยนยังคงอยู่ (บันทึก DB แล้ว)

- [ ] **Step 5: กด ▲ กลับมาที่เดิม แล้ว reload อีกครั้ง**

Expected: ลำดับ reset กลับมาถูกต้อง

- [ ] **Step 6: Final commit (push)**

```bash
git push origin main
```
