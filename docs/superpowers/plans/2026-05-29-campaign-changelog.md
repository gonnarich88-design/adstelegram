# Campaign Change Log Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** บันทึกประวัติการเปลี่ยนแปลงแคมเปญอัตโนมัติ (field diff + status changes) พร้อม manual note และแสดงเป็น timeline ท้ายหน้า Campaign Detail

**Architecture:** เพิ่ม `CampaignChangeLog` table ใน Prisma, helper `lib/changelog.ts` รวม logic ไว้จุดเดียว, auto-log ใน PUT handler + refund + auto-stop ทุกจุด, UI client component รับ logs เป็น prop จาก server page (ไม่ fetch ซ้ำ) + form สำหรับ manual note

**Tech Stack:** Prisma 6, Next.js 16 App Router, TypeScript strict, Tailwind CSS 4, shadcn/ui

---

## File Map

| Action | File | หน้าที่ |
|--------|------|--------|
| Create | `src/lib/changelog.ts` | helper `logCampaignChanges()` + `diffCampaignFields()` |
| Modify | `prisma/schema.prisma` | เพิ่ม CampaignChangeLog model + relation |
| Create | `prisma/migrations/...` | migration file (auto-generated) |
| Modify | `src/app/api/campaigns/[id]/route.ts` | PUT: diff + log + accept note in body |
| Modify | `src/app/api/campaigns/[id]/refund/route.ts` | log CANCELLED status change |
| Modify | `src/app/api/campaigns/[id]/entries/route.ts` | log STOPPED in autoStopIfDepleted |
| Create | `src/app/api/campaigns/[id]/changelog/route.ts` | GET logs + POST manual note |
| Modify | `src/app/campaigns/[id]/page.tsx` | log passive status changes + fetch + pass logs to UI |
| Modify | `src/app/api/campaigns/route.ts` | POST: log "สร้างแคมเปญ" |
| Create | `src/components/campaign-changelog.tsx` | UI timeline + manual note form |
| Modify | `src/lib/export.ts` | เพิ่ม campaignChangeLogs ใน exportData/importData |
| Modify | `tests/export.test.ts` | backward compat test + export test |

---

## Task 1: Prisma Schema Migration

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: เพิ่ม model CampaignChangeLog และ relation ใน Campaign**

เพิ่มต่อท้าย schema.prisma:
```prisma
model CampaignChangeLog {
  id         String   @id @default(cuid())
  campaignId String
  campaign   Campaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  changedAt  DateTime @default(now())
  field      String?
  oldValue   String?
  newValue   String?
  note       String?

  @@index([campaignId])
}
```

และใน model Campaign เพิ่ม relation (ต่อจาก `refunds WalletDeposit[]`):
```prisma
  changeLogs CampaignChangeLog[]
```

- [ ] **Step 2: Run migration**

```bash
npx prisma migrate dev --name add_campaign_changelog
```

Expected output: `✓ Generated Prisma Client` และไม่มี error

- [ ] **Step 3: Verify generated client**

```bash
npx prisma generate
```

Expected: `✓ Generated Prisma Client`

- [ ] **Step 4: Run tests ยืนยัน schema ไม่พัง**

```bash
npm test
```

Expected: all tests pass (53+)

---

## Task 2: Helper lib/changelog.ts

**Files:**
- Create: `src/lib/changelog.ts`

- [ ] **Step 1: สร้าง helper file**

สร้าง `src/lib/changelog.ts`:
```typescript
import { prisma } from './prisma'

export interface ChangeEntry {
  field: string | null
  oldValue?: string | null
  newValue?: string | null
  note?: string | null
}

export async function logCampaignChanges(
  campaignId: string,
  changes: ChangeEntry[]
): Promise<void> {
  if (changes.length === 0) return
  const changedAt = new Date()
  await prisma.campaignChangeLog.createMany({
    data: changes.map(c => ({
      campaignId,
      changedAt,
      field: c.field ?? null,
      oldValue: c.oldValue ?? null,
      newValue: c.newValue ?? null,
      note: c.note ?? null,
    })),
  })
}

const NUMERIC_FIELDS = new Set(['dailyBudgetTon', 'bidCpmTon', 'budgetTon'])
const DATE_FIELDS = new Set(['startDate', 'endDate'])

function normalize(field: string, val: unknown): string | null {
  if (val == null) return null
  if (NUMERIC_FIELDS.has(field)) return Number(val).toFixed(8)
  if (DATE_FIELDS.has(field)) return new Date(val as string).toISOString().slice(0, 10)
  return String(val)
}

export interface CampaignSnapshot {
  name: string
  targetType: string
  targetName: string
  startDate: Date | string
  endDate: Date | string | null
  budgetTon: unknown
  dailyBudgetTon: unknown
  bidCpmTon: unknown
  status: string
  placementName: string | null
}

const WATCHED_FIELDS = [
  'name', 'targetType', 'targetName', 'startDate', 'endDate',
  'budgetTon', 'dailyBudgetTon', 'bidCpmTon', 'status', 'placementName',
] as const

export function diffCampaignFields(
  oldSnap: CampaignSnapshot,
  newSnap: CampaignSnapshot
): ChangeEntry[] {
  const changes: ChangeEntry[] = []
  for (const field of WATCHED_FIELDS) {
    const oldVal = normalize(field, (oldSnap as Record<string, unknown>)[field])
    const newVal = normalize(field, (newSnap as Record<string, unknown>)[field])
    if (oldVal !== newVal) {
      changes.push({ field, oldValue: oldVal, newValue: newVal })
    }
  }
  return changes
}
```

- [ ] **Step 2: Run tests ยืนยันไม่มี TypeScript error**

```bash
npm test
```

Expected: all tests pass

---

## Task 3: API Route GET/POST /api/campaigns/[id]/changelog

**Files:**
- Create: `src/app/api/campaigns/[id]/changelog/route.ts`

- [ ] **Step 1: สร้าง route handler**

สร้าง `src/app/api/campaigns/[id]/changelog/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logCampaignChanges } from '@/lib/changelog'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const logs = await prisma.campaignChangeLog.findMany({
      where: { campaignId: id },
      orderBy: { changedAt: 'desc' },
    })
    return NextResponse.json(logs)
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()
    if (!body.note || typeof body.note !== 'string' || body.note.trim() === '') {
      return NextResponse.json({ error: 'note is required' }, { status: 400 })
    }
    const campaign = await prisma.campaign.findUnique({ where: { id } })
    if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    await logCampaignChanges(id, [{ field: null, note: body.note.trim() }])
    return NextResponse.json({ ok: true }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Run tests**

```bash
npm test
```

Expected: all tests pass

---

## Task 4: Auto-log ใน PUT /api/campaigns/[id]

**Files:**
- Modify: `src/app/api/campaigns/[id]/route.ts`

- [ ] **Step 1: แก้ PUT handler ให้ diff และ log**

แทนที่ PUT function ทั้งหมดใน `src/app/api/campaigns/[id]/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { logCampaignChanges, diffCampaignFields } from '@/lib/changelog'

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()
    const bidCpmTon = body.bidCpmTon != null ? Number(body.bidCpmTon) : null
    if (bidCpmTon !== null && (isNaN(bidCpmTon) || bidCpmTon <= 0)) {
      return NextResponse.json({ error: 'bidCpmTon must be > 0' }, { status: 400 })
    }

    const old = await prisma.campaign.findUnique({ where: { id } })
    if (!old) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const campaign = await prisma.campaign.update({
      where: { id },
      data: {
        name: body.name,
        targetType: body.targetType,
        targetName: body.targetName,
        startDate: new Date(body.startDate),
        endDate: body.endDate ? new Date(body.endDate) : null,
        budgetTon: body.budgetTon ?? null,
        dailyBudgetTon: body.dailyBudgetTon,
        bidCpmTon: bidCpmTon,
        status: body.status,
        placementName: body.placementName ?? null,
        note: body.note ?? null,
      },
    })

    const changes = diffCampaignFields(old, {
      name: body.name,
      targetType: body.targetType,
      targetName: body.targetName,
      startDate: body.startDate,
      endDate: body.endDate ?? null,
      budgetTon: body.budgetTon ?? null,
      dailyBudgetTon: body.dailyBudgetTon,
      bidCpmTon: bidCpmTon,
      status: body.status,
      placementName: body.placementName ?? null,
    })

    const note = typeof body.changeNote === 'string' && body.changeNote.trim()
      ? body.changeNote.trim()
      : null

    if (note) changes.push({ field: null, note })
    await logCampaignChanges(id, changes)

    return NextResponse.json(campaign)
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

หมายเหตุ: ใช้ `body.changeNote` (ไม่ใช่ `body.note`) เพื่อแยกออกจาก `note` ของ campaign

- [ ] **Step 2: Run tests**

```bash
npm test
```

Expected: all tests pass

---

## Task 5: Auto-log ใน Refund + Auto-stop + Campaign Create

**Files:**
- Modify: `src/app/api/campaigns/[id]/refund/route.ts`
- Modify: `src/app/api/campaigns/[id]/entries/route.ts`
- Modify: `src/app/campaigns/[id]/page.tsx`
- Modify: `src/app/api/campaigns/route.ts`

### 5a: Refund route — log CANCELLED

แก้ `src/app/api/campaigns/[id]/refund/route.ts` เพิ่ม import และ log หลัง transaction:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logCampaignChanges } from '@/lib/changelog'

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
    if (campaign.status === 'CANCELLED')
      return NextResponse.json({ error: 'Campaign already cancelled' }, { status: 409 })

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

    if (updatedCampaign.status === 'CANCELLED' && campaign.status !== 'CANCELLED') {
      await logCampaignChanges(id, [
        { field: 'status', oldValue: campaign.status, newValue: 'CANCELLED', note: 'ยกเลิกแคมเปญ' },
      ])
    }

    return NextResponse.json(
      { deposit: { id: deposit.id }, campaign: { id: updatedCampaign.id, status: updatedCampaign.status } },
      { status: 201 }
    )
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

### 5b: Entries route — log STOPPED ใน autoStopIfDepleted

- [ ] **Step 1: แก้ autoStopIfDepleted ใน `src/app/api/campaigns/[id]/entries/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logCampaignChanges } from '@/lib/changelog'

async function autoStopIfDepleted(campaignId: string) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: {
      status: true,
      allocations: { select: { amountTon: true } },
      entries: { select: { spendTon: true } },
    },
  })
  if (!campaign || campaign.status !== 'ACTIVE') return
  const totalAllocated = campaign.allocations.reduce((s, a) => s + Number(a.amountTon), 0)
  if (totalAllocated === 0) return
  const totalSpent = campaign.entries.reduce((s, e) => s + Number(e.spendTon), 0)
  if (totalSpent >= totalAllocated) {
    await prisma.campaign.update({ where: { id: campaignId }, data: { status: 'STOPPED' } })
    await logCampaignChanges(campaignId, [
      { field: 'status', oldValue: 'ACTIVE', newValue: 'STOPPED', note: 'งบถูกใช้หมด (auto)' },
    ])
  }
}
// ... ส่วน GET/POST คงเดิม
```

### 5c: Campaign detail page — log passive status checks

- [ ] **Step 1: แก้ passive status checks ใน `src/app/campaigns/[id]/page.tsx`**

แก้ 2 block ใน page.tsx (บรรทัด 56-64):

```typescript
  // แทนที่ block เดิม 2 block
  if (campaign.status === 'ACTIVE' && totalAllocatedTon > 0 && totalSpendTon >= totalAllocatedTon) {
    await prisma.campaign.update({ where: { id }, data: { status: 'STOPPED' } })
    ;(campaign as { status: string }).status = 'STOPPED'
    await logCampaignChanges(id, [
      { field: 'status', oldValue: 'ACTIVE', newValue: 'STOPPED', note: 'งบถูกใช้หมด (auto)' },
    ])
  }

  if (campaign.status === 'STOPPED' && totalAllocatedTon > 0 && totalSpendTon < totalAllocatedTon) {
    await prisma.campaign.update({ where: { id }, data: { status: 'ACTIVE' } })
    ;(campaign as { status: string }).status = 'ACTIVE'
    await logCampaignChanges(id, [
      { field: 'status', oldValue: 'STOPPED', newValue: 'ACTIVE', note: 'งบยังเหลือ (auto reactivate)' },
    ])
  }
```

เพิ่ม import ด้านบนของ page.tsx:
```typescript
import { logCampaignChanges } from '@/lib/changelog'
```

### 5d: Campaign creation — log "สร้างแคมเปญ"

- [ ] **Step 1: แก้ POST /api/campaigns/route.ts**

ใน POST handler หลัง `prisma.campaign.create` สำเร็จ:
```typescript
    const campaign = await prisma.campaign.create({ ... })
    await logCampaignChanges(campaign.id, [
      { field: null, note: 'สร้างแคมเปญ' },
    ])
    return NextResponse.json(campaign, { status: 201 })
```

เพิ่ม import:
```typescript
import { logCampaignChanges } from '@/lib/changelog'
```

- [ ] **Step 2: Run tests**

```bash
npm test
```

Expected: all tests pass

---

## Task 6: Export/Import + Tests

**Files:**
- Modify: `src/lib/export.ts`
- Modify: `tests/export.test.ts`

### 6a: แก้ export.ts

- [ ] **Step 1: เพิ่ม campaignChangeLogs ใน ExportData interface**

```typescript
export interface ExportData {
  version: number
  exportedAt: string
  walletDeposits?: any[]
  campaignAllocations?: any[]
  walletBalanceTon?: string
  campaigns: any[]
  dailyConversions?: any[]
  campaignChangeLogs?: any[]     // เพิ่มบรรทัดนี้
}
```

- [ ] **Step 2: แก้ exportData() — เพิ่ม fetch + serialize**

เพิ่มใน Promise.all:
```typescript
export async function exportData(): Promise<ExportData> {
  const [campaigns, walletDeposits, campaignAllocations, dailyConversions, campaignChangeLogs] = await Promise.all([
    prisma.campaign.findMany({
      include: { entries: { orderBy: { date: 'asc' } } },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.walletDeposit.findMany({ orderBy: { depositedAt: 'asc' } }),
    prisma.campaignAllocation.findMany(),
    prisma.dailyConversion.findMany({ orderBy: { date: 'asc' } }),
    prisma.campaignChangeLog.findMany({ orderBy: { changedAt: 'asc' } }),
  ])

  return {
    // ... เดิมทั้งหมด
    campaignChangeLogs: campaignChangeLogs.map(l => ({
      id: l.id,
      campaignId: l.campaignId,
      changedAt: l.changedAt.toISOString(),
      field: l.field ?? null,
      oldValue: l.oldValue ?? null,
      newValue: l.newValue ?? null,
      note: l.note ?? null,
    })),
  }
}
```

- [ ] **Step 3: แก้ importData() — delete + create**

ใน $transaction เพิ่ม delete ก่อน:
```typescript
    await tx.campaignChangeLog.deleteMany()
    await tx.campaignAllocation.deleteMany()
    // ... ที่เหลือคงเดิม
```

และเพิ่ม loop สร้าง logs หลัง campaigns:
```typescript
    for (const l of data.campaignChangeLogs ?? []) {
      await tx.campaignChangeLog.create({
        data: {
          id: l.id,
          campaignId: l.campaignId,
          changedAt: new Date(l.changedAt),
          field: l.field ?? null,
          oldValue: l.oldValue ?? null,
          newValue: l.newValue ?? null,
          note: l.note ?? null,
        },
      })
    }
```

### 6b: แก้ tests/export.test.ts

- [ ] **Step 1: เพิ่ม mock สำหรับ campaignChangeLog**

ใน vi.mock แก้ `prisma` object เพิ่ม:
```typescript
    campaignChangeLog: {
      findMany: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
```

และใน `$transaction` mock เพิ่มใน tx object:
```typescript
        campaignChangeLog: { deleteMany: vi.fn(), create: vi.fn() },
```

- [ ] **Step 2: เพิ่ม test backward compat — ไม่มี campaignChangeLogs ในไฟล์เก่า**

```typescript
describe('importData backward compat — missing campaignChangeLogs', () => {
  it('handles JSON without campaignChangeLogs field gracefully', async () => {
    const { prisma } = await import('@/lib/prisma')
    const mockTx = {
      campaignChangeLog: { deleteMany: vi.fn(), create: vi.fn() },
      campaignAllocation: { deleteMany: vi.fn() },
      performanceEntry: { deleteMany: vi.fn() },
      campaign: { deleteMany: vi.fn(), create: vi.fn() },
      walletDeposit: { deleteMany: vi.fn(), create: vi.fn() },
      dailyConversion: { deleteMany: vi.fn(), create: vi.fn() },
    }
    vi.mocked(prisma.$transaction).mockImplementationOnce((fn: any) => fn(mockTx))

    const { importData } = await import('@/lib/export')
    await importData({
      version: 2,
      exportedAt: new Date().toISOString(),
      campaigns: [],
      // campaignChangeLogs intentionally absent
    })

    expect(mockTx.campaignChangeLog.deleteMany).toHaveBeenCalled()
    expect(mockTx.campaignChangeLog.create).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 3: เพิ่ม test exportData includes campaignChangeLogs**

```typescript
describe('exportData includes campaignChangeLogs', () => {
  it('returns campaignChangeLogs array with serialized records', async () => {
    const { prisma } = await import('@/lib/prisma')
    vi.mocked(prisma.campaign.findMany).mockResolvedValueOnce([])
    vi.mocked(prisma.walletDeposit.findMany).mockResolvedValueOnce([])
    vi.mocked(prisma.campaignAllocation.findMany).mockResolvedValueOnce([])
    vi.mocked(prisma.dailyConversion.findMany).mockResolvedValueOnce([])
    vi.mocked(prisma.campaignChangeLog.findMany).mockResolvedValueOnce([
      {
        id: 'log1',
        campaignId: 'c1',
        changedAt: new Date('2026-05-29T10:00:00Z'),
        field: 'dailyBudgetTon',
        oldValue: '5.00000000',
        newValue: '7.00000000',
        note: null,
      } as any,
    ])

    const { exportData } = await import('@/lib/export')
    const result = await exportData()

    expect(result.campaignChangeLogs).toHaveLength(1)
    expect(result.campaignChangeLogs![0]).toMatchObject({
      id: 'log1',
      campaignId: 'c1',
      field: 'dailyBudgetTon',
      oldValue: '5.00000000',
      newValue: '7.00000000',
      note: null,
    })
  })
})
```

- [ ] **Step 4: Run tests ยืนยันทุก test ผ่าน**

```bash
npm test
```

Expected: all tests pass (57+)

---

## Task 7: UI Component campaign-changelog.tsx

**Files:**
- Create: `src/components/campaign-changelog.tsx`
- Modify: `src/app/campaigns/[id]/page.tsx`

### 7a: สร้าง component

- [ ] **Step 1: สร้าง `src/components/campaign-changelog.tsx`**

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export interface ChangeLog {
  id: string
  campaignId: string
  changedAt: string
  field: string | null
  oldValue: string | null
  newValue: string | null
  note: string | null
}

const FIELD_LABELS: Record<string, string> = {
  name: 'ชื่อแคมเปญ',
  targetType: 'ประเภท',
  targetName: 'Target',
  startDate: 'วันเริ่ม',
  endDate: 'วันสิ้นสุด',
  budgetTon: 'งบรวม (TON)',
  dailyBudgetTon: 'งบรายวัน (TON)',
  bidCpmTon: 'CPM Bid (TON)',
  status: 'สถานะ',
  placementName: 'Placement',
}

function formatValue(field: string | null, val: string | null): string {
  if (val == null) return '—'
  if (field === 'dailyBudgetTon' || field === 'bidCpmTon' || field === 'budgetTon') {
    const n = parseFloat(val)
    return isNaN(n) ? val : n.toFixed(4)
  }
  return val
}

function fmtDateTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('th-TH', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'Asia/Bangkok',
  })
}

// Group logs by changedAt (same millisecond = same save)
function groupByTime(logs: ChangeLog[]): Array<{ time: string; items: ChangeLog[] }> {
  const map = new Map<string, ChangeLog[]>()
  for (const l of logs) {
    if (!map.has(l.changedAt)) map.set(l.changedAt, [])
    map.get(l.changedAt)!.push(l)
  }
  return Array.from(map.entries())
    .map(([time, items]) => ({ time, items }))
    .sort((a, b) => b.time.localeCompare(a.time))
}

export function CampaignChangelog({
  campaignId,
  logs,
}: {
  campaignId: string
  logs: ChangeLog[]
}) {
  const router = useRouter()
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const groups = groupByTime(logs)

  async function handleAddNote(e: React.FormEvent) {
    e.preventDefault()
    if (!note.trim()) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/changelog`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: note.trim() }),
      })
      if (res.ok) {
        setNote('')
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">ประวัติการเปลี่ยนแปลง</h2>
      </div>

      {/* Manual note form */}
      <form onSubmit={handleAddNote} className="flex gap-2">
        <input
          type="text"
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="บันทึกหมายเหตุ..."
          className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <button
          type="submit"
          disabled={loading || !note.trim()}
          className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted/50 disabled:opacity-50"
        >
          {loading ? '...' : '+ บันทึก'}
        </button>
      </form>
      {error && <p className="text-xs text-destructive">{error}</p>}

      {/* Timeline */}
      {groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">ยังไม่มีประวัติ</p>
      ) : (
        <div className="space-y-3">
          {groups.map(({ time, items }) => {
            const fieldChanges = items.filter(l => l.field !== null)
            const notes = items.filter(l => l.field === null && l.note)
            return (
              <div key={time} className="rounded-lg border border-muted/40 p-3 space-y-1.5">
                <p className="text-xs text-muted-foreground">{fmtDateTime(time)}</p>
                {fieldChanges.map(l => (
                  <div key={l.id} className="flex items-baseline gap-2 text-sm">
                    <span className="text-muted-foreground text-xs min-w-[120px]">
                      {FIELD_LABELS[l.field!] ?? l.field}
                    </span>
                    <span className="text-muted-foreground/60 line-through text-xs">
                      {formatValue(l.field, l.oldValue)}
                    </span>
                    <span className="text-xs text-muted-foreground">→</span>
                    <span className="font-medium text-xs">{formatValue(l.field, l.newValue)}</span>
                  </div>
                ))}
                {notes.map(l => (
                  <p key={l.id} className="text-xs text-muted-foreground">
                    💬 {l.note}
                  </p>
                ))}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
```

### 7b: Fetch logs ใน page + ส่งให้ component

- [ ] **Step 1: แก้ `src/app/campaigns/[id]/page.tsx`**

เพิ่ม import:
```typescript
import { CampaignChangelog, type ChangeLog } from '@/components/campaign-changelog'
import { logCampaignChanges } from '@/lib/changelog'
```

เพิ่ม query ใน Promise.all ของ page:
```typescript
  const [campaign, walletDeposits, changeLogRaw] = await Promise.all([
    prisma.campaign.findUnique({...}),
    prisma.walletDeposit.findMany({...}),
    prisma.campaignChangeLog.findMany({
      where: { campaignId: id },
      orderBy: { changedAt: 'desc' },
    }),
  ])
```

Serialize ก่อนส่งให้ Client Component (เพราะ Date object ข้าม boundary ไม่ได้):
```typescript
  const changeLogs: ChangeLog[] = changeLogRaw.map(l => ({
    id: l.id,
    campaignId: l.campaignId,
    changedAt: l.changedAt.toISOString(),
    field: l.field ?? null,
    oldValue: l.oldValue ?? null,
    newValue: l.newValue ?? null,
    note: l.note ?? null,
  }))
```

เพิ่ม section ท้าย return JSX (ต่อจาก Performance Log):
```tsx
      <CampaignChangelog campaignId={id} logs={changeLogs} />
```

- [ ] **Step 2: Run tests**

```bash
npm test
```

Expected: all tests pass

---

## Task 8: Campaign Edit Form — รับ changeNote

**Files:**
- Modify: `src/components/campaign-form.tsx`

- [ ] **Step 1: ดู campaign-form.tsx ก่อนแก้**

```bash
grep -n "changeNote\|note\|submit\|onSubmit" src/components/campaign-form.tsx | head -20
```

- [ ] **Step 2: เพิ่ม changeNote field ในฟอร์ม**

หา `zod schema` ใน campaign-form.tsx และเพิ่ม:
```typescript
  changeNote: z.string().optional(),
```

หา submit handler และเพิ่ม `changeNote: values.changeNote ?? ''` ในข้อมูลที่ส่งไป PUT

เพิ่ม field ใน JSX (ต่อจาก note field):
```tsx
<div className="space-y-2">
  <Label>เหตุผลที่แก้ไข (optional)</Label>
  <Input
    {...form.register('changeNote')}
    placeholder="เช่น ปรับ CPM เพราะ CTR ตก"
  />
</div>
```

- [ ] **Step 3: Run tests**

```bash
npm test
```

Expected: all tests pass

---

## Task 9: Smoke Test ใน Browser

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: เปิดหน้า Campaign Detail และตรวจสอบ**

1. เข้าหน้า `/campaigns/[id]` ของแคมเปญที่มีอยู่
2. ตรวจสอบว่า section "ประวัติการเปลี่ยนแปลง" ปรากฏท้ายหน้า
3. log "สร้างแคมเปญ" ควรมีอยู่แล้ว (ถ้า campaign สร้างหลัง deploy)
4. พิมพ์ manual note แล้วกด "+ บันทึก" — ต้อง appear ใน timeline

- [ ] **Step 3: ทดสอบ auto-log จาก Edit**

1. กด "แก้ไข" แล้วเปลี่ยน Daily Budget หรือ CPM
2. กด "บันทึก"
3. กลับมาหน้า detail — ต้องมี log แสดงค่าเก่า → ค่าใหม่

- [ ] **Step 4: Commit**

```bash
git add prisma/ src/ tests/
git commit -m "feat: campaign change log — auto-diff, manual note, timeline UI"
```

---

## Self-Review Checklist

- [x] Export/Import ครอบคลุม (`campaignChangeLogs ?? []` backward compat)
- [x] Auto-stop ทุก 3 จุด (entries/route.ts, page.tsx passive STOPPED, page.tsx passive ACTIVE)
- [x] Multi-field batch ใช้ `changedAt` เดียวกัน + note เป็น `field=null` record แยก
- [x] Campaign create log (POST /api/campaigns)
- [x] Refund → CANCELLED log
- [x] ไม่มี breaking change บน API (changeNote เป็น optional field ใน body)
- [x] Serialize Decimal/Date ก่อนส่งไป Client Component (page.tsx)
- [x] `onDelete: Cascade` ใน schema — campaign ถูกลบ, log หายตาม
