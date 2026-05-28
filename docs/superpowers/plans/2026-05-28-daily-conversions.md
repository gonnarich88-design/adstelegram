# Daily Conversions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เพิ่ม feature ติดตาม downstream conversion metrics รายวัน (สมัครสมาชิก + ฝากเงิน) พร้อมคำนวณ CPR/CPD จาก ad spend และแสดงสรุปบน Dashboard

**Architecture:** ตาราง `DailyConversion` ใหม่เก็บ aggregate business metrics รายวัน (ไม่ผูกกับ Campaign ใด) — หน้า `/conversions` ให้กรอกข้อมูลและดูตาราง — Dashboard เพิ่ม strip สรุป 30 วันล่าสุดระหว่าง Hero bar กับ WoW strip — CPR/CPD คำนวณ ณ query time โดย join กับ PerformanceEntry ใน JavaScript

**Tech Stack:** Next.js 16 App Router, Prisma 6, PostgreSQL, React 19, Tailwind CSS 4, shadcn/ui, Vitest

---

## File Map

| Action | File | Purpose |
|--------|------|---------|
| Modify | `prisma/schema.prisma` | เพิ่ม DailyConversion model |
| Create | `src/app/api/conversions/route.ts` | GET list + POST create |
| Create | `src/app/api/conversions/[id]/route.ts` | PATCH edit + DELETE |
| Create | `src/app/conversions/page.tsx` | Server Component — fetch + compute CPR/CPD |
| Create | `src/app/conversions/conversions-client.tsx` | Client Component — form + inline-edit table |
| Modify | `src/components/nav.tsx` | เพิ่ม Conversions link |
| Modify | `src/app/page.tsx` | เพิ่ม Conversion strip บน Dashboard |
| Modify | `src/lib/export.ts` | เพิ่ม dailyConversions ใน export/import |
| Modify | `tests/export.test.ts` | tests สำหรับ DailyConversion export/import |

---

## Task 1: Prisma Schema Migration

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: เพิ่ม DailyConversion model ใน schema.prisma**

เปิด `prisma/schema.prisma` แล้วเพิ่ม model นี้ต่อท้ายไฟล์ (หลัง enum DepositType):

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

- [ ] **Step 2: สร้าง migration**

```bash
npx prisma migrate dev --name add_daily_conversions
```

Expected output: `✔  Your database is now in sync with your schema.`

- [ ] **Step 3: Regenerate Prisma client**

```bash
npx prisma generate
```

Expected: `✔ Generated Prisma Client`

- [ ] **Step 4: Run tests เพื่อให้แน่ใจว่า migration ไม่ทำลายอะไร**

```bash
npm test
```

Expected: ทุก test ผ่าน (44+ tests)

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add DailyConversion schema — daily business metrics table"
```

---

## Task 2: API Route — GET + POST `/api/conversions`

**Files:**
- Create: `src/app/api/conversions/route.ts`

- [ ] **Step 1: สร้างไฟล์ API route**

สร้าง `src/app/api/conversions/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const records = await prisma.dailyConversion.findMany({
      orderBy: { date: 'desc' },
    })
    return NextResponse.json(
      records.map(r => ({
        id: r.id,
        date: r.date.toISOString().slice(0, 10),
        registrations: r.registrations,
        depositCount: r.depositCount,
        depositAmountThb: Number(r.depositAmountThb),
        note: r.note,
        createdAt: r.createdAt.toISOString(),
      }))
    )
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { date, registrations, depositCount, depositAmountThb, note } = body

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'date must be YYYY-MM-DD' }, { status: 400 })
    }
    if (typeof registrations !== 'number' || !Number.isInteger(registrations) || registrations < 0) {
      return NextResponse.json({ error: 'registrations must be non-negative integer' }, { status: 400 })
    }
    if (typeof depositCount !== 'number' || !Number.isInteger(depositCount) || depositCount < 0) {
      return NextResponse.json({ error: 'depositCount must be non-negative integer' }, { status: 400 })
    }
    if (typeof depositAmountThb !== 'number' || isNaN(depositAmountThb) || depositAmountThb < 0) {
      return NextResponse.json({ error: 'depositAmountThb must be non-negative number' }, { status: 400 })
    }

    const record = await prisma.dailyConversion.create({
      data: {
        date: new Date(date),
        registrations,
        depositCount,
        depositAmountThb,
        note: note ?? null,
      },
    })
    return NextResponse.json({ id: record.id }, { status: 201 })
  } catch (e: any) {
    if (e?.code === 'P2002') {
      return NextResponse.json({ error: 'DUPLICATE_DATE' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

- [ ] **Step 2: เริ่ม dev server แล้วทดสอบ GET**

```bash
npm run dev
```

เปิด terminal ใหม่:

```bash
curl -s http://localhost:3000/api/conversions \
  -H "Cookie: session=<token>" | head -50
```

Expected: `[]` (array ว่าง เพราะยังไม่มีข้อมูล)

- [ ] **Step 3: ทดสอบ POST**

```bash
curl -s -X POST http://localhost:3000/api/conversions \
  -H "Content-Type: application/json" \
  -H "Cookie: session=<token>" \
  -d '{"date":"2026-05-28","registrations":42,"depositCount":18,"depositAmountThb":54000,"note":"test"}'
```

Expected: `{"id":"<cuid>"}` status 201

- [ ] **Step 4: ทดสอบ POST ซ้ำวันเดิม (409)**

```bash
curl -s -X POST http://localhost:3000/api/conversions \
  -H "Content-Type: application/json" \
  -H "Cookie: session=<token>" \
  -d '{"date":"2026-05-28","registrations":1,"depositCount":1,"depositAmountThb":100}'
```

Expected: `{"error":"DUPLICATE_DATE"}` status 409

- [ ] **Step 5: Commit**

```bash
git add src/app/api/conversions/route.ts
git commit -m "feat: GET + POST /api/conversions"
```

---

## Task 3: API Route — PATCH + DELETE `/api/conversions/[id]`

**Files:**
- Create: `src/app/api/conversions/[id]/route.ts`

- [ ] **Step 1: สร้างไฟล์**

สร้าง `src/app/api/conversions/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()
    const { date, registrations, depositCount, depositAmountThb, note } = body

    if (date !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'date must be YYYY-MM-DD' }, { status: 400 })
    }
    if (registrations !== undefined && (!Number.isInteger(registrations) || registrations < 0)) {
      return NextResponse.json({ error: 'registrations must be non-negative integer' }, { status: 400 })
    }
    if (depositCount !== undefined && (!Number.isInteger(depositCount) || depositCount < 0)) {
      return NextResponse.json({ error: 'depositCount must be non-negative integer' }, { status: 400 })
    }
    if (depositAmountThb !== undefined && (isNaN(depositAmountThb) || depositAmountThb < 0)) {
      return NextResponse.json({ error: 'depositAmountThb must be non-negative' }, { status: 400 })
    }

    await prisma.dailyConversion.update({
      where: { id },
      data: {
        ...(date !== undefined && { date: new Date(date) }),
        ...(registrations !== undefined && { registrations }),
        ...(depositCount !== undefined && { depositCount }),
        ...(depositAmountThb !== undefined && { depositAmountThb }),
        ...(note !== undefined && { note: note ?? null }),
      },
    })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    if (e?.code === 'P2002') {
      return NextResponse.json({ error: 'DUPLICATE_DATE' }, { status: 409 })
    }
    if (e?.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await prisma.dailyConversion.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    if (e?.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

- [ ] **Step 2: ทดสอบ PATCH — ใช้ ID จาก Task 2**

```bash
curl -s -X PATCH http://localhost:3000/api/conversions/<id-จาก-task2> \
  -H "Content-Type: application/json" \
  -H "Cookie: session=<token>" \
  -d '{"registrations":50,"depositCount":20}'
```

Expected: `{"ok":true}`

- [ ] **Step 3: ทดสอบ DELETE**

```bash
curl -s -X DELETE http://localhost:3000/api/conversions/<id-จาก-task2> \
  -H "Cookie: session=<token>"
```

Expected: `{"ok":true}`

- [ ] **Step 4: Commit**

```bash
git add src/app/api/conversions/[id]/route.ts
git commit -m "feat: PATCH + DELETE /api/conversions/[id]"
```

---

## Task 4: Export/Import + Tests

**Files:**
- Modify: `src/lib/export.ts`
- Modify: `tests/export.test.ts`

- [ ] **Step 1: เพิ่ม dailyConversions ใน ExportData interface**

ใน `src/lib/export.ts` แก้ interface:

```typescript
export interface ExportData {
  version: number
  exportedAt: string
  walletDeposits?: any[]
  campaignAllocations?: any[]
  walletBalanceTon?: string
  campaigns: any[]
  dailyConversions?: any[]
}
```

- [ ] **Step 2: เพิ่ม fetch DailyConversion ใน exportData()**

แก้ `exportData()` — เพิ่ม `prisma.dailyConversion.findMany` ใน Promise.all และ map ผลลัพธ์:

```typescript
export async function exportData(): Promise<ExportData> {
  const [campaigns, walletDeposits, campaignAllocations, dailyConversions] = await Promise.all([
    prisma.campaign.findMany({
      include: { entries: { orderBy: { date: 'asc' } } },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.walletDeposit.findMany({ orderBy: { depositedAt: 'asc' } }),
    prisma.campaignAllocation.findMany(),
    prisma.dailyConversion.findMany({ orderBy: { date: 'asc' } }),
  ])

  return {
    version: 2,
    exportedAt: new Date().toISOString(),
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
    campaignAllocations: campaignAllocations.map(a => ({
      id: a.id,
      depositId: a.depositId,
      campaignId: a.campaignId,
      amountTon: a.amountTon.toString(),
      allocatedAt: a.allocatedAt.toISOString(),
      createdAt: a.createdAt.toISOString(),
    })),
    campaigns: campaigns.map(c => ({
      id: c.id,
      name: c.name,
      targetType: c.targetType,
      targetName: c.targetName,
      budgetTon: c.budgetTon?.toString() ?? null,
      dailyBudgetTon: c.dailyBudgetTon.toString(),
      bidCpmTon: c.bidCpmTon?.toString() ?? null,
      startDate: c.startDate.toISOString(),
      endDate: c.endDate?.toISOString() ?? null,
      status: c.status,
      placementName: c.placementName,
      note: c.note,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
      entries: (c.entries as any[]).map((e: any) => ({
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
        note: e.note,
        createdAt: e.createdAt.toISOString(),
      })),
    })),
    dailyConversions: dailyConversions.map(r => ({
      id: r.id,
      date: r.date.toISOString().slice(0, 10),
      registrations: r.registrations,
      depositCount: r.depositCount,
      depositAmountThb: r.depositAmountThb.toString(),
      note: r.note,
      createdAt: r.createdAt.toISOString(),
    })),
  }
}
```

- [ ] **Step 3: เพิ่ม DailyConversion restore ใน importData()**

ใน `importData()` เพิ่ม deleteMany + create ใน transaction:

```typescript
export async function importData(data: ExportData): Promise<void> {
  await prisma.$transaction(async tx => {
    await tx.campaignAllocation.deleteMany()
    await tx.performanceEntry.deleteMany()
    await tx.campaign.deleteMany()
    await tx.walletDeposit.deleteMany()
    await tx.dailyConversion.deleteMany()

    for (const c of data.campaigns) {
      await tx.campaign.create({
        data: {
          id: c.id,
          name: c.name,
          targetType: c.targetType,
          targetName: c.targetName,
          startDate: new Date(c.startDate),
          endDate: c.endDate ? new Date(c.endDate) : null,
          dailyBudgetTon: c.dailyBudgetTon ?? 0,
          bidCpmTon: c.bidCpmTon ?? null,
          budgetTon: c.budgetTon ?? null,
          status: c.status,
          placementName: c.placementName ?? null,
          note: c.note,
          entries: {
            create: c.entries.map((e: any) => ({
              id: e.id,
              date: new Date(e.date),
              spendTon: e.spendTon,
              dailyBudgetTon: e.dailyBudgetTon,
              tonPriceUsd: e.tonPriceUsd,
              usdThbRate: e.usdThbRate,
              impressions: e.impressions,
              views: e.views,
              clicks: e.clicks,
              joins: e.joins,
              note: e.note,
            })),
          },
        },
      })
    }

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

    for (const r of data.dailyConversions ?? []) {
      await tx.dailyConversion.create({
        data: {
          id: r.id,
          date: new Date(r.date),
          registrations: r.registrations ?? 0,
          depositCount: r.depositCount ?? 0,
          depositAmountThb: r.depositAmountThb ?? 0,
          note: r.note ?? null,
        },
      })
    }
  })
}
```

- [ ] **Step 4: เพิ่ม mock dailyConversion ใน tests/export.test.ts**

เปิด `tests/export.test.ts` แก้ mock ให้รองรับ `dailyConversion`:

```typescript
vi.mock('@/lib/prisma', () => ({
  prisma: {
    campaign: {
      findMany: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    walletDeposit: {
      findMany: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    campaignAllocation: {
      findMany: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    performanceEntry: {
      deleteMany: vi.fn(),
    },
    dailyConversion: {
      findMany: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn(async (fn: (tx: any) => Promise<void>) =>
      fn({
        campaign: { create: vi.fn(), deleteMany: vi.fn() },
        performanceEntry: { deleteMany: vi.fn() },
        walletDeposit: { create: vi.fn(), deleteMany: vi.fn() },
        campaignAllocation: { create: vi.fn(), deleteMany: vi.fn() },
        dailyConversion: { create: vi.fn(), deleteMany: vi.fn() },
      })
    ),
  },
}))
```

- [ ] **Step 5: เพิ่ม test cases สำหรับ DailyConversion**

เพิ่ม describe blocks ต่อท้ายไฟล์ (หลัง describe ที่มีอยู่):

```typescript
describe('exportData includes dailyConversions', () => {
  it('returns dailyConversions array with serialized records', async () => {
    const { prisma } = await import('@/lib/prisma')
    vi.mocked(prisma.campaign.findMany).mockResolvedValueOnce([])
    vi.mocked(prisma.walletDeposit.findMany).mockResolvedValueOnce([])
    vi.mocked(prisma.campaignAllocation.findMany).mockResolvedValueOnce([])
    vi.mocked(prisma.dailyConversion.findMany).mockResolvedValueOnce([
      {
        id: 'dc1',
        date: new Date('2026-05-28'),
        registrations: 42,
        depositCount: 18,
        depositAmountThb: { toString: () => '54000.00' } as any,
        note: 'test',
        createdAt: new Date('2026-05-28T10:00:00Z'),
        updatedAt: new Date('2026-05-28T10:00:00Z'),
      },
    ])

    const { exportData } = await import('@/lib/export')
    const result = await exportData()

    expect(result.dailyConversions).toHaveLength(1)
    expect(result.dailyConversions![0]).toMatchObject({
      id: 'dc1',
      date: '2026-05-28',
      registrations: 42,
      depositCount: 18,
      depositAmountThb: '54000.00',
      note: 'test',
    })
  })
})

describe('importData backward compat — missing dailyConversions', () => {
  it('handles JSON without dailyConversions field gracefully', async () => {
    const { prisma } = await import('@/lib/prisma')
    const mockTx = {
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
      // dailyConversions intentionally absent
    })

    expect(mockTx.dailyConversion.deleteMany).toHaveBeenCalled()
    expect(mockTx.dailyConversion.create).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 6: Run tests**

```bash
npm test
```

Expected: ทุก test ผ่าน (เพิ่มอีก 2 tests)

- [ ] **Step 7: Commit**

```bash
git add src/lib/export.ts tests/export.test.ts
git commit -m "feat: export/import DailyConversion + tests"
```

---

## Task 5: Navigation

**Files:**
- Modify: `src/components/nav.tsx`

- [ ] **Step 1: เพิ่ม Conversions link ใน nav**

ใน `src/components/nav.tsx` แก้ array `links`:

```typescript
const links = [
  { href: '/', label: 'Dashboard' },
  { href: '/campaigns', label: 'Campaigns' },
  { href: '/wallet', label: 'Wallet' },
  { href: '/conversions', label: 'Conversions' },
  { href: '/settings', label: 'Settings' },
]
```

และเพิ่ม `/conversions` ใน `isActive` ให้ highlight เมื่ออยู่ใน path นั้น (startsWith สำหรับ consistency):

```typescript
function isActive(href: string) {
  if (href === '/campaigns') return pathname.startsWith('/campaigns')
  if (href === '/conversions') return pathname.startsWith('/conversions')
  return pathname === href
}
```

- [ ] **Step 2: ตรวจ TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/components/nav.tsx
git commit -m "feat: add Conversions nav link"
```

---

## Task 6: Conversions Page

**Files:**
- Create: `src/app/conversions/page.tsx`
- Create: `src/app/conversions/conversions-client.tsx`

- [ ] **Step 1: สร้าง Client Component ก่อน เพื่อ export type ให้ page.tsx ใช้**

`ConversionRow` interface ต้อง define ใน `conversions-client.tsx` แล้ว import เข้า `page.tsx` (ไม่ใช่ทางกลับ เพราะ page.tsx ควรเป็น consumer ของ type จาก client)

ดูขั้นตอนที่ถูกต้องใน Step 2 ด้านล่าง

- [ ] **Step 2: สร้าง Server Component `page.tsx`**

สร้าง `src/app/conversions/page.tsx`:

```typescript
import { prisma } from '@/lib/prisma'
import { ConversionsClient } from './conversions-client'
import type { ConversionRow } from './conversions-client'

export const dynamic = 'force-dynamic'

export default async function ConversionsPage() {
  const [rawConversions, allEntries] = await Promise.all([
    prisma.dailyConversion.findMany({ orderBy: { date: 'desc' } }),
    prisma.performanceEntry.findMany({
      select: { date: true, spendTon: true, tonPriceUsd: true, usdThbRate: true },
    }),
  ])

  // Group PerformanceEntry spend by date string (join in JS to avoid DATE vs TIMESTAMP mismatch)
  const spendByDate = new Map<string, number>()
  for (const e of allEntries) {
    const dateStr = e.date.toISOString().slice(0, 10)
    const spendThb = Number(e.spendTon) * Number(e.tonPriceUsd) * Number(e.usdThbRate)
    spendByDate.set(dateStr, (spendByDate.get(dateStr) ?? 0) + spendThb)
  }

  const records: ConversionRow[] = rawConversions.map(r => {
    const dateStr = r.date.toISOString().slice(0, 10)
    const spendThb = spendByDate.has(dateStr) ? spendByDate.get(dateStr)! : null
    const depositAmountThb = Number(r.depositAmountThb)
    return {
      id: r.id,
      date: dateStr,
      registrations: r.registrations,
      depositCount: r.depositCount,
      depositAmountThb,
      note: r.note,
      spendThb,
      cpr: spendThb !== null && r.registrations > 0 ? spendThb / r.registrations : null,
      cpd: spendThb !== null && r.depositCount > 0 ? spendThb / r.depositCount : null,
    }
  })

  return <ConversionsClient records={records} />
}
```

- [ ] **Step 3: สร้าง Client Component `conversions-client.tsx`**

หมายเหตุสำคัญ: `InputRow` ต้อง define **นอก** `ConversionsClient` เสมอ — component ที่ define ใน render function จะถูก recreate ทุก render ทำให้ input เสีย focus

สร้าง `src/app/conversions/conversions-client.tsx`:

```typescript
'use client'

import { useState, Fragment } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

export interface ConversionRow {
  id: string
  date: string
  registrations: number
  depositCount: number
  depositAmountThb: number
  note: string | null
  spendThb: number | null
  cpr: number | null
  cpd: number | null
}

interface FormState {
  date: string
  registrations: string
  depositCount: string
  depositAmountThb: string
  note: string
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function fmtDate(dateStr: string) {
  // เพิ่ม T00:00:00 เพื่อหลีกเลี่ยง timezone offset เมื่อ parse date-only string

  return new Date(dateStr + 'T00:00:00').toLocaleDateString('th-TH', {
    day: 'numeric', month: 'short', year: '2-digit',
  })
}

function fmtThb(n: number) {
  return '฿' + Math.round(n).toLocaleString('th-TH')
}

// InputRow ต้องอยู่นอก ConversionsClient เสมอ — ถ้าอยู่ใน render function
// React จะสร้าง component ใหม่ทุก render ทำให้ input เสีย focus
function InputRow({ f, setF }: { f: FormState; setF: (fn: (prev: FormState) => FormState) => void }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div className="space-y-1.5">
        <label className="text-xs font-medium">วันที่ *</label>
        <input type="date" className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
          value={f.date} onChange={e => setF(p => ({ ...p, date: e.target.value }))} />
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-medium">สมัครสมาชิก (คน) *</label>
        <input type="number" min="0" step="1" className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
          value={f.registrations} onChange={e => setF(p => ({ ...p, registrations: e.target.value }))} />
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-medium">ฝากเงิน (คน) *</label>
        <input type="number" min="0" step="1" className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
          value={f.depositCount} onChange={e => setF(p => ({ ...p, depositCount: e.target.value }))} />
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-medium">ฝากเงิน (฿) *</label>
        <input type="number" min="0" step="0.01" className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
          value={f.depositAmountThb} onChange={e => setF(p => ({ ...p, depositAmountThb: e.target.value }))} />
      </div>
    </div>
  )
}

export function ConversionsClient({ records }: { records: ConversionRow[] }) {
  const router = useRouter()
  const emptyForm: FormState = { date: todayStr(), registrations: '', depositCount: '', depositAmountThb: '', note: '' }

  const [form, setForm] = useState<FormState>(emptyForm)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<FormState>(emptyForm)
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError] = useState('')

  const [deletingId, setDeletingId] = useState<string | null>(null)

  function validateForm(f: FormState): string | null {
    if (!f.date) return 'กรุณาใส่วันที่'
    const reg = parseInt(f.registrations)
    const dep = parseInt(f.depositCount)
    const amt = parseFloat(f.depositAmountThb)
    if (isNaN(reg) || reg < 0) return 'สมัครสมาชิกต้องเป็นจำนวนเต็มที่ไม่ติดลบ'
    if (isNaN(dep) || dep < 0) return 'ฝากเงิน (คน) ต้องเป็นจำนวนเต็มที่ไม่ติดลบ'
    if (isNaN(amt) || amt < 0) return 'ฝากเงิน (฿) ต้องเป็นตัวเลขที่ไม่ติดลบ'
    return null
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const err = validateForm(form)
    if (err) { setFormError(err); return }
    setSubmitting(true)
    setFormError('')
    try {
      const res = await fetch('/api/conversions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: form.date,
          registrations: parseInt(form.registrations),
          depositCount: parseInt(form.depositCount),
          depositAmountThb: parseFloat(form.depositAmountThb),
          note: form.note || null,
        }),
      })
      if (res.ok) {
        setForm({ ...emptyForm, date: todayStr() })
        router.refresh()
      } else {
        const data = await res.json()
        setFormError(data.error === 'DUPLICATE_DATE'
          ? 'มีข้อมูลวันนี้แล้ว กรุณาแก้ไขแทน'
          : (data.error ?? 'บันทึกไม่สำเร็จ'))
      }
    } catch {
      setFormError('บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง')
    } finally {
      setSubmitting(false)
    }
  }

  function startEdit(r: ConversionRow) {
    setEditingId(r.id)
    setEditForm({
      date: r.date,
      registrations: r.registrations.toString(),
      depositCount: r.depositCount.toString(),
      depositAmountThb: r.depositAmountThb.toFixed(2),
      note: r.note ?? '',
    })
    setEditError('')
  }

  async function handleSaveEdit(id: string) {
    const err = validateForm(editForm)
    if (err) { setEditError(err); return }
    setEditLoading(true)
    setEditError('')
    try {
      const res = await fetch(`/api/conversions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: editForm.date,
          registrations: parseInt(editForm.registrations),
          depositCount: parseInt(editForm.depositCount),
          depositAmountThb: parseFloat(editForm.depositAmountThb),
          note: editForm.note || null,
        }),
      })
      if (res.ok) {
        setEditingId(null)
        router.refresh()
      } else {
        const data = await res.json()
        setEditError(data.error === 'DUPLICATE_DATE'
          ? 'วันที่ซ้ำกับรายการอื่น'
          : (data.error ?? 'บันทึกไม่สำเร็จ'))
      }
    } catch {
      setEditError('บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง')
    } finally {
      setEditLoading(false)
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    try {
      const res = await fetch(`/api/conversions/${id}`, { method: 'DELETE' })
      if (res.ok) {
        router.refresh()
      } else {
        const data = await res.json()
        alert(data.error ?? 'ลบไม่สำเร็จ')
      }
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <h1 className="text-2xl font-bold">Conversions</h1>

      {/* Add form */}
      <div className="rounded-md border p-4 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">บันทึกรายวัน</p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <InputRow f={form} setF={setForm} />
          <div className="flex items-end gap-3">
            <div className="flex-1 space-y-1.5">
              <label className="text-xs font-medium">หมายเหตุ</label>
              <input
                type="text"
                className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
                placeholder="optional"
                value={form.note}
                onChange={e => setForm(p => ({ ...p, note: e.target.value }))}
              />
            </div>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'กำลังบันทึก...' : '+ บันทึก'}
            </Button>
          </div>
          {formError && <p className="text-xs text-destructive">{formError}</p>}
        </form>
      </div>

      {/* Table */}
      {records.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">ยังไม่มีข้อมูล</p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/20 text-xs text-muted-foreground">
                <th className="px-3 py-2 text-left font-medium whitespace-nowrap">วันที่</th>
                <th className="px-3 py-2 text-right font-medium">สมัคร</th>
                <th className="px-3 py-2 text-right font-medium whitespace-nowrap">ฝาก (คน)</th>
                <th className="px-3 py-2 text-right font-medium whitespace-nowrap">ฝาก (฿)</th>
                <th className="px-3 py-2 text-right font-medium whitespace-nowrap">CPR (฿)</th>
                <th className="px-3 py-2 text-right font-medium whitespace-nowrap">CPD (฿)</th>
                <th className="px-1 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {records.map(r => (
                <Fragment key={r.id}>
                  <tr className="hover:bg-muted/10">
                    <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                      {fmtDate(r.date)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-medium text-green-400">
                      {r.registrations.toLocaleString()}
                    </td>
                    <td className="px-3 py-2.5 text-right font-medium text-blue-400">
                      {r.depositCount.toLocaleString()}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {fmtThb(r.depositAmountThb)}
                    </td>
                    <td className="px-3 py-2.5 text-right text-amber-400">
                      {r.cpr !== null ? fmtThb(r.cpr) : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-right text-amber-400">
                      {r.cpd !== null ? fmtThb(r.cpd) : '—'}
                    </td>
                    <td className="px-1 py-2.5">
                      <div className="flex gap-0.5">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 text-xs"
                          onClick={() => editingId === r.id ? setEditingId(null) : startEdit(r)}
                        >
                          {editingId === r.id ? 'ยกเลิก' : 'แก้ไข'}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive h-6 px-2 text-xs"
                          disabled={deletingId === r.id}
                          onClick={() => handleDelete(r.id)}
                        >
                          ลบ
                        </Button>
                      </div>
                    </td>
                  </tr>
                  {editingId === r.id && (
                    <tr>
                      <td colSpan={7} className="px-3 pb-3 pt-0">
                        <div className="mt-1 space-y-3 rounded-md border p-3 bg-muted/10">
                          <InputRow f={editForm} setF={setEditForm} />
                          <div className="flex items-end gap-3">
                            <div className="flex-1 space-y-1.5">
                              <label className="text-xs font-medium">หมายเหตุ</label>
                              <input
                                type="text"
                                className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
                                value={editForm.note}
                                onChange={e => setEditForm(p => ({ ...p, note: e.target.value }))}
                              />
                            </div>
                            <Button size="sm" disabled={editLoading} onClick={() => handleSaveEdit(r.id)}>
                              {editLoading ? 'กำลังบันทึก...' : 'บันทึก'}
                            </Button>
                          </div>
                          {editError && <p className="text-xs text-destructive">{editError}</p>}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: ตรวจ TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 4: ทดสอบหน้า `/conversions` ในเบราว์เซอร์**

เปิด http://localhost:3000/conversions

ตรวจสอบ:
- Nav มี "Conversions" link ที่ active ✅
- Form แสดงถูกต้อง วันที่ default = วันนี้ ✅
- กรอกข้อมูลแล้วกด "+ บันทึก" → record ปรากฏในตาราง ✅
- กด "แก้ไข" → inline form เปิดพร้อม pre-fill ✅
- แก้ไขแล้ว Save → ตารางอัปเดต ✅
- กด "ลบ" → record หายไป ✅
- กรอกวันที่ซ้ำ → แสดง error "มีข้อมูลวันนี้แล้ว กรุณาแก้ไขแทน" ✅

- [ ] **Step 5: Commit**

```bash
git add src/app/conversions/
git commit -m "feat: Conversions page — form + inline-edit table + CPR/CPD"
```

---

## Task 7: Dashboard — Conversion Strip

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: เพิ่ม fetch DailyConversion ใน DashboardPage**

ใน `src/app/page.tsx` เพิ่ม query ใน `Promise.all` (เพิ่มหลัง `deposits`):

```typescript
const [campaigns, deposits, last30Conversions] = await Promise.all([
  prisma.campaign.findMany({
    include: {
      entries: { orderBy: { date: 'asc' } },
      allocations: true,
    },
    orderBy: { createdAt: 'desc' },
  }),
  prisma.walletDeposit.findMany({
    include: { allocations: true },
    orderBy: { depositedAt: 'asc' },
  }),
  prisma.dailyConversion.findMany({
    where: { date: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
  }),
])
```

- [ ] **Step 2: คำนวณ conversionStrip data**

เพิ่มหลัง block `const hasLeaderboard = ...`:

```typescript
// Conversion strip (30d)
const hasConversionData = last30Conversions.length > 0
const conversionStrip = hasConversionData ? (() => {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const totalRegistrations = last30Conversions.reduce((s, r) => s + r.registrations, 0)
  const totalDepositCount = last30Conversions.reduce((s, r) => s + r.depositCount, 0)
  const totalDepositAmountThb = last30Conversions.reduce((s, r) => s + Number(r.depositAmountThb), 0)
  const last30SpendThb = allRawEntries
    .filter(e => new Date(e.date) >= thirtyDaysAgo)
    .reduce((s, e) => s + Number(e.spendTon) * Number(e.tonPriceUsd) * Number(e.usdThbRate), 0)
  return {
    totalRegistrations,
    totalDepositCount,
    totalDepositAmountThb,
    cpr: totalRegistrations > 0 ? last30SpendThb / totalRegistrations : null,
    cpd: totalDepositCount > 0 ? last30SpendThb / totalDepositCount : null,
  }
})() : null
```

- [ ] **Step 3: เพิ่ม Conversion strip ใน JSX**

ใน return statement เพิ่ม strip ระหว่าง Hero bar กับ `{/* 2-column body */}`:

```tsx
{/* Conversion Strip */}
{conversionStrip && (
  <div className="rounded-lg border bg-muted/5 px-6 py-4">
    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
      Conversions — 30 วันล่าสุด
    </p>
    <div className="grid grid-cols-2 gap-0 divide-x divide-border sm:grid-cols-4">
      <div className="pr-6">
        <p className="text-xs text-muted-foreground">สมัครสมาชิก</p>
        <p className="text-2xl font-bold text-green-400 mt-0.5">
          {conversionStrip.totalRegistrations.toLocaleString()}
        </p>
        <p className="text-xs text-muted-foreground">คน</p>
      </div>
      <div className="px-6">
        <p className="text-xs text-muted-foreground">ฝากเงิน</p>
        <p className="text-2xl font-bold text-blue-400 mt-0.5">
          {conversionStrip.totalDepositCount.toLocaleString()}
        </p>
        <p className="text-xs text-muted-foreground">
          คน · ฿{Math.round(conversionStrip.totalDepositAmountThb).toLocaleString('th-TH')}
        </p>
      </div>
      <div className="px-6">
        <p className="text-xs text-muted-foreground">CPR</p>
        <p className="text-2xl font-bold text-amber-400 mt-0.5">
          {conversionStrip.cpr !== null ? `฿${Math.round(conversionStrip.cpr).toLocaleString('th-TH')}` : '—'}
        </p>
        <p className="text-xs text-muted-foreground">/สมัคร</p>
      </div>
      <div className="pl-6">
        <p className="text-xs text-muted-foreground">CPD</p>
        <p className="text-2xl font-bold text-amber-400 mt-0.5">
          {conversionStrip.cpd !== null ? `฿${Math.round(conversionStrip.cpd).toLocaleString('th-TH')}` : '—'}
        </p>
        <p className="text-xs text-muted-foreground">/ฝาก</p>
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 4: ตรวจ TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 5: ทดสอบ Dashboard ในเบราว์เซอร์**

เปิด http://localhost:3000

ตรวจสอบ:
- ก่อนมีข้อมูล conversion: strip ไม่แสดง ✅
- กรอกข้อมูลใน `/conversions` แล้วกลับมา Dashboard: strip ปรากฏ ✅
- Strip แสดง 4 columns: สมัคร / ฝาก / CPR / CPD ✅
- CPR/CPD แสดง "—" ถ้าไม่มี PerformanceEntry วันนั้น ✅
- Strip อยู่ระหว่าง Hero bar กับ 2-column section ✅

- [ ] **Step 6: Run tests ครั้งสุดท้าย**

```bash
npm test
```

Expected: ทุก test ผ่าน

- [ ] **Step 7: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: dashboard conversion strip — 30d registrations/deposits/CPR/CPD"
```

---

## Task 8: Final Smoke Test

- [ ] **Step 1: ทดสอบ flow ครบทุกอย่าง**

เปิด http://localhost:3000 ทดสอบตามลำดับ:

1. **Nav** — Conversions link ปรากฏ, กดแล้วไปหน้าที่ถูกต้อง ✅
2. **Conversions page — กรอกข้อมูล** — กรอกวันที่+ตัวเลข กด "+ บันทึก" → record ปรากฏในตาราง พร้อม CPR/CPD (ถ้ามี ad entries วันนั้น) หรือ "—" ✅
3. **Conversions page — duplicate** — กรอกวันเดิมซ้ำ → error "มีข้อมูลวันนี้แล้ว กรุณาแก้ไขแทน" ✅
4. **Conversions page — edit** — กด "แก้ไข" → inline form เปิด, แก้ไข, บันทึก → ตารางอัปเดต ✅
5. **Conversions page — delete** — กด "ลบ" → record หายไป ✅
6. **Dashboard** — กลับหน้า Dashboard → Conversion strip ปรากฏ (ถ้ามีข้อมูล) ✅
7. **Export** — ไป Settings → Export → ตรวจว่า JSON มี `dailyConversions` array ✅

- [ ] **Step 2: Update PROGRESS.md**

เพิ่มในหัวข้อ "เสร็จแล้ว":

```
- [x] **Daily Conversions feature** — DailyConversion table, /api/conversions CRUD, หน้า /conversions (form + inline-edit table + CPR/CPD), Dashboard strip 30d, export/import — browser verified ✅ (session 19)
```

---

## Spec Reference

`docs/superpowers/specs/2026-05-28-daily-conversions-design.md`
