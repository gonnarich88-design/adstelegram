# Wallet System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a TON wallet system that tracks cost-basis by locking exchange rates at deposit time and propagating those rates to campaign entries.

**Architecture:** Two new Prisma models (`WalletDeposit`, `CampaignAllocation`) replace `AppSettings`. Wallet balance is computed (deposits − allocations). Campaign entries created after allocation use the deposit's locked rate instead of live rates. Pure computation logic lives in `src/lib/wallet.ts` for testability.

**Tech Stack:** Prisma 6 (PostgreSQL), Next.js 16 App Router, React 19 Server + Client Components, Tailwind CSS, Vitest

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/lib/wallet.ts` | Pure functions: computeWalletBalance, findCurrentRate |
| Create | `tests/wallet.test.ts` | Unit tests for wallet.ts |
| Modify | `prisma/schema.prisma` | Add WalletDeposit + CampaignAllocation, remove AppSettings |
| Modify | `src/lib/export.ts` | Version 2 export with wallet data, no AppSettings |
| Modify | `tests/export.test.ts` | Update mocks and assertions for version 2 |
| Modify | `src/app/api/export/route.ts` | Accept version 1 and 2 on import |
| Create | `src/app/api/wallet/balance/route.ts` | GET: total deposited, allocated, balance, current rate |
| Create | `src/app/api/wallet/deposits/route.ts` | GET list + POST create deposit |
| Create | `src/app/api/wallet/deposits/[id]/route.ts` | DELETE deposit (if no allocations) |
| Create | `src/app/api/campaigns/[id]/allocation/route.ts` | GET/POST(upsert)/DELETE allocation |
| Create | `src/app/wallet/page.tsx` | Wallet page (Server Component) |
| Create | `src/app/wallet/deposit-form.tsx` | Deposit create form (Client Component) |
| Create | `src/components/allocation-card.tsx` | Campaign allocation card (Client Component) |
| Modify | `src/app/campaigns/[id]/page.tsx` | Add allocation query + AllocationCard |
| Modify | `src/components/entry-form.tsx` | Add allocationRate prop: pre-fill + lock rate fields |
| Modify | `src/components/csv-import.tsx` | Add allocationRate prop: skip historical fetch |
| Modify | `src/app/campaigns/[id]/entries/new/page.tsx` | Fetch allocation, pass allocationRate |
| Modify | `src/app/campaigns/[id]/entries/new/tabs-client.tsx` | Forward allocationRate to EntryForm + CsvImport |
| Modify | `src/app/page.tsx` | Replace AppSettings wallet with computed balance |
| Modify | `src/app/settings/page.tsx` | Remove wallet balance card, keep export/import |
| Modify | `src/components/nav.tsx` | Add Wallet link |
| Delete | `src/app/api/settings/route.ts` | AppSettings removed |

---

## Task 1: Prisma Schema Migration

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Update schema.prisma**

Replace the entire file with:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Campaign {
  id             String              @id @default(uuid())
  name           String
  targetType     TargetType
  targetName     String
  startDate      DateTime
  endDate        DateTime?
  budgetTon      Decimal?            @db.Decimal(18, 8)
  dailyBudgetTon Decimal             @db.Decimal(18, 8)
  status         CampaignStatus      @default(ACTIVE)
  placementName  String?
  note           String?
  entries        PerformanceEntry[]
  allocation     CampaignAllocation?
  createdAt      DateTime            @default(now())
  updatedAt      DateTime            @updatedAt
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
  id          String               @id @default(cuid())
  amountTon   Decimal              @db.Decimal(18, 8)
  tonPriceUsd Decimal              @db.Decimal(18, 8)
  usdThbRate  Decimal              @db.Decimal(18, 8)
  depositedAt DateTime
  note        String?
  createdAt   DateTime             @default(now())
  allocations CampaignAllocation[]
}

model CampaignAllocation {
  id         String        @id @default(cuid())
  depositId  String
  campaignId String        @unique
  amountTon  Decimal       @db.Decimal(18, 8)
  createdAt  DateTime      @default(now())
  deposit    WalletDeposit @relation(fields: [depositId], references: [id])
  campaign   Campaign      @relation(fields: [campaignId], references: [id], onDelete: Cascade)
}

enum TargetType {
  CHANNEL
  BOT
}

enum CampaignStatus {
  ACTIVE
  PAUSED
  DONE
}
```

- [ ] **Step 2: Run migration**

```bash
npx prisma migrate dev --name wallet_system
```

Expected: Migration file created in `prisma/migrations/`, Prisma client regenerated. AppSettings table is dropped, WalletDeposit and CampaignAllocation tables are created.

- [ ] **Step 3: Verify Prisma client generated**

```bash
npx prisma generate
```

Expected: `✔ Generated Prisma Client`

- [ ] **Step 4: Run tests (will fail on export.test.ts — that's expected)**

```bash
npm test 2>&1 | grep -E "PASS|FAIL|Tests"
```

Expected: Some tests fail because `prisma.appSettings` no longer exists in the generated client. We fix this in Task 3.

---

## Task 2: Wallet Computation Library + Tests

**Files:**
- Create: `src/lib/wallet.ts`
- Create: `tests/wallet.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/wallet.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { computeWalletBalance, findCurrentRate } from '@/lib/wallet'

describe('computeWalletBalance', () => {
  it('returns 0 when no deposits', () => {
    expect(computeWalletBalance([], [])).toBe(0)
  })

  it('returns full deposit amount when no allocations', () => {
    expect(computeWalletBalance([{ amountTon: 1000 }, { amountTon: 500 }], [])).toBe(1500)
  })

  it('subtracts total allocations from total deposits', () => {
    expect(
      computeWalletBalance([{ amountTon: 2000 }], [{ amountTon: 300 }, { amountTon: 200 }])
    ).toBe(1500)
  })

  it('returns 0 when fully allocated', () => {
    expect(computeWalletBalance([{ amountTon: 500 }], [{ amountTon: 500 }])).toBe(0)
  })
})

describe('findCurrentRate', () => {
  const deposit = (id: string, date: string, amount: number, tonUsd: number, usdThb: number) => ({
    id,
    amountTon: amount,
    depositedAt: new Date(date),
    tonPriceUsd: tonUsd,
    usdThbRate: usdThb,
  })

  it('returns null when no deposits', () => {
    expect(findCurrentRate([], [])).toBeNull()
  })

  it('returns null when all deposits are fully allocated', () => {
    const deposits = [deposit('d1', '2026-01-01', 100, 3, 100)]
    const allocations = [{ depositId: 'd1', amountTon: 100 }]
    expect(findCurrentRate(deposits, allocations)).toBeNull()
  })

  it('returns the only deposit when no allocations exist', () => {
    const deposits = [deposit('d1', '2026-01-01', 100, 3.21, 105.5)]
    const result = findCurrentRate(deposits, [])
    expect(result).toEqual({ tonPriceUsd: 3.21, usdThbRate: 105.5 })
  })

  it('returns oldest deposit with remaining balance (FIFO)', () => {
    const deposits = [
      deposit('d2', '2026-02-01', 200, 4.0, 110),
      deposit('d1', '2026-01-01', 100, 3.0, 100),
    ]
    const allocations = [{ depositId: 'd1', amountTon: 100 }]
    const result = findCurrentRate(deposits, allocations)
    expect(result?.tonPriceUsd).toBe(4.0)
    expect(result?.usdThbRate).toBe(110)
  })

  it('returns oldest deposit when multiple have remaining balance', () => {
    const deposits = [
      deposit('d2', '2026-02-01', 200, 4.0, 110),
      deposit('d1', '2026-01-01', 100, 3.0, 100),
    ]
    const result = findCurrentRate(deposits, [])
    expect(result?.tonPriceUsd).toBe(3.0)
    expect(result?.usdThbRate).toBe(100)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test tests/wallet.test.ts 2>&1 | tail -10
```

Expected: FAIL — `Cannot find module '@/lib/wallet'`

- [ ] **Step 3: Create src/lib/wallet.ts**

```ts
export function computeWalletBalance(
  deposits: Array<{ amountTon: number }>,
  allocations: Array<{ amountTon: number }>
): number {
  const totalDeposited = deposits.reduce((s, d) => s + d.amountTon, 0)
  const totalAllocated = allocations.reduce((s, a) => s + a.amountTon, 0)
  return totalDeposited - totalAllocated
}

export function findCurrentRate(
  deposits: Array<{ id: string; amountTon: number; depositedAt: Date; tonPriceUsd: number; usdThbRate: number }>,
  allocations: Array<{ depositId: string; amountTon: number }>
): { tonPriceUsd: number; usdThbRate: number } | null {
  const allocatedByDeposit = new Map<string, number>()
  for (const a of allocations) {
    allocatedByDeposit.set(a.depositId, (allocatedByDeposit.get(a.depositId) ?? 0) + a.amountTon)
  }

  const sorted = [...deposits].sort((a, b) => a.depositedAt.getTime() - b.depositedAt.getTime())

  for (const d of sorted) {
    const allocated = allocatedByDeposit.get(d.id) ?? 0
    if (d.amountTon - allocated > 0) {
      return { tonPriceUsd: d.tonPriceUsd, usdThbRate: d.usdThbRate }
    }
  }
  return null
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test tests/wallet.test.ts 2>&1 | tail -10
```

Expected: `Tests 9 passed`

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma src/lib/wallet.ts tests/wallet.test.ts
git commit -m "feat: wallet system schema + lib/wallet.ts pure functions (9 tests)"
```

---

## Task 3: Update Export Library, Tests, and Route

**Files:**
- Modify: `src/lib/export.ts`
- Modify: `tests/export.test.ts`
- Modify: `src/app/api/export/route.ts`

- [ ] **Step 1: Rewrite tests/export.test.ts**

```ts
import { describe, it, expect, vi } from 'vitest'

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
    $transaction: vi.fn(async (fn: (tx: any) => Promise<void>) =>
      fn({
        campaign: { create: vi.fn(), deleteMany: vi.fn() },
        performanceEntry: { deleteMany: vi.fn() },
        walletDeposit: { create: vi.fn(), deleteMany: vi.fn() },
        campaignAllocation: { create: vi.fn(), deleteMany: vi.fn() },
      })
    ),
  },
}))

describe('exportData', () => {
  it('returns version 2, exportedAt, campaigns, walletDeposits, campaignAllocations', async () => {
    const { prisma } = await import('@/lib/prisma')
    vi.mocked(prisma.campaign.findMany).mockResolvedValueOnce([])
    vi.mocked(prisma.walletDeposit.findMany).mockResolvedValueOnce([])
    vi.mocked(prisma.campaignAllocation.findMany).mockResolvedValueOnce([])

    const { exportData } = await import('@/lib/export')
    const result = await exportData()

    expect(result.version).toBe(2)
    expect(result.exportedAt).toBeTruthy()
    expect(result.campaigns).toEqual([])
    expect(result.walletDeposits).toEqual([])
    expect(result.campaignAllocations).toEqual([])
  })
})
```

- [ ] **Step 2: Run export test to verify it fails**

```bash
npm test tests/export.test.ts 2>&1 | tail -10
```

Expected: FAIL — version is 1, walletDeposits/campaignAllocations not in result

- [ ] **Step 3: Rewrite src/lib/export.ts**

```ts
import { prisma } from './prisma'

export interface ExportData {
  version: number
  exportedAt: string
  walletDeposits?: any[]
  campaignAllocations?: any[]
  walletBalanceTon?: string
  campaigns: any[]
}

export async function exportData(): Promise<ExportData> {
  const [campaigns, walletDeposits, campaignAllocations] = await Promise.all([
    prisma.campaign.findMany({
      include: { entries: { orderBy: { date: 'asc' } } },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.walletDeposit.findMany({ orderBy: { depositedAt: 'asc' } }),
    prisma.campaignAllocation.findMany(),
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
      createdAt: d.createdAt.toISOString(),
    })),
    campaignAllocations: campaignAllocations.map(a => ({
      id: a.id,
      depositId: a.depositId,
      campaignId: a.campaignId,
      amountTon: a.amountTon.toString(),
      createdAt: a.createdAt.toISOString(),
    })),
    campaigns: campaigns.map(c => ({
      id: c.id,
      name: c.name,
      targetType: c.targetType,
      targetName: c.targetName,
      budgetTon: c.budgetTon?.toString() ?? null,
      dailyBudgetTon: c.dailyBudgetTon.toString(),
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
  }
}

export async function importData(data: ExportData): Promise<void> {
  await prisma.$transaction(async tx => {
    await tx.campaignAllocation.deleteMany()
    await tx.performanceEntry.deleteMany()
    await tx.campaign.deleteMany()
    await tx.walletDeposit.deleteMany()

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
        },
      })
    }
  })
}
```

- [ ] **Step 4: Update src/app/api/export/route.ts to accept version 1 and 2**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { exportData, importData } from '@/lib/export'

export async function GET() {
  try {
    const data = await exportData()
    return new NextResponse(JSON.stringify(data, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="ads-backup-${new Date().toISOString().split('T')[0]}.json"`,
      },
    })
  } catch {
    return NextResponse.json({ error: 'Export failed' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json()
    if (data.version !== 1 && data.version !== 2) {
      return NextResponse.json({ error: 'Unsupported version' }, { status: 400 })
    }
    if (!Array.isArray(data.campaigns)) {
      return NextResponse.json({ error: 'Invalid data shape' }, { status: 400 })
    }
    await importData(data)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Import failed' }, { status: 500 })
  }
}
```

- [ ] **Step 5: Run all tests**

```bash
npm test 2>&1 | tail -15
```

Expected: All tests pass (wallet.test.ts: 9, export.test.ts: 1, plus existing tests)

- [ ] **Step 6: Commit**

```bash
git add src/lib/export.ts tests/export.test.ts src/app/api/export/route.ts
git commit -m "feat: export v2 with wallet data, remove AppSettings from export/import"
```

---

## Task 4: Wallet Balance API

**Files:**
- Create: `src/app/api/wallet/balance/route.ts`

- [ ] **Step 1: Create directory and route**

```bash
mkdir -p src/app/api/wallet/balance
```

Create `src/app/api/wallet/balance/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { computeWalletBalance, findCurrentRate } from '@/lib/wallet'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const deposits = await prisma.walletDeposit.findMany({
      include: { allocations: true },
      orderBy: { depositedAt: 'asc' },
    })

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

    const totalDeposited = depositsNormalized.reduce((s, d) => s + d.amountTon, 0)
    const totalAllocated = allAllocations.reduce((s, a) => s + a.amountTon, 0)
    const balance = computeWalletBalance(
      depositsNormalized,
      allAllocations
    )
    const currentRate = findCurrentRate(depositsNormalized, allAllocations)

    return NextResponse.json({ totalDeposited, totalAllocated, balance, currentRate })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Run tests (all should still pass)**

```bash
npm test 2>&1 | tail -5
```

Expected: All tests pass

- [ ] **Step 3: Commit**

```bash
git add src/app/api/wallet/balance/route.ts
git commit -m "feat: GET /api/wallet/balance — computed balance + current rate"
```

---

## Task 5: Wallet Deposits API (GET + POST)

**Files:**
- Create: `src/app/api/wallet/deposits/route.ts`

- [ ] **Step 1: Create directory and route**

```bash
mkdir -p src/app/api/wallet/deposits
```

Create `src/app/api/wallet/deposits/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const deposits = await prisma.walletDeposit.findMany({
      include: {
        allocations: {
          include: { campaign: { select: { id: true, name: true } } },
        },
      },
      orderBy: { depositedAt: 'desc' },
    })

    return NextResponse.json(
      deposits.map(d => ({
        id: d.id,
        amountTon: Number(d.amountTon),
        tonPriceUsd: Number(d.tonPriceUsd),
        usdThbRate: Number(d.usdThbRate),
        depositedAt: d.depositedAt.toISOString(),
        note: d.note,
        createdAt: d.createdAt.toISOString(),
        allocations: d.allocations.map(a => ({
          id: a.id,
          campaignId: a.campaignId,
          campaignName: a.campaign.name,
          amountTon: Number(a.amountTon),
        })),
      }))
    )
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const amountTon = Number(body.amountTon)
    const tonPriceUsd = Number(body.tonPriceUsd)
    const usdThbRate = Number(body.usdThbRate)

    if (isNaN(amountTon) || amountTon <= 0) {
      return NextResponse.json({ error: 'amountTon must be > 0' }, { status: 400 })
    }
    if (isNaN(tonPriceUsd) || tonPriceUsd <= 0) {
      return NextResponse.json({ error: 'tonPriceUsd must be > 0' }, { status: 400 })
    }
    if (isNaN(usdThbRate) || usdThbRate <= 0) {
      return NextResponse.json({ error: 'usdThbRate must be > 0' }, { status: 400 })
    }
    if (!body.depositedAt) {
      return NextResponse.json({ error: 'depositedAt is required' }, { status: 400 })
    }

    const deposit = await prisma.walletDeposit.create({
      data: {
        amountTon,
        tonPriceUsd,
        usdThbRate,
        depositedAt: new Date(body.depositedAt),
        note: body.note ?? null,
      },
    })

    return NextResponse.json({ id: deposit.id }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/wallet/deposits/route.ts
git commit -m "feat: GET+POST /api/wallet/deposits"
```

---

## Task 6: Wallet Deposits DELETE

**Files:**
- Create: `src/app/api/wallet/deposits/[id]/route.ts`

- [ ] **Step 1: Create directory and route**

```bash
mkdir -p "src/app/api/wallet/deposits/[id]"
```

Create `src/app/api/wallet/deposits/[id]/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const deposit = await prisma.walletDeposit.findUnique({
      where: { id },
      include: { allocations: true },
    })

    if (!deposit) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    if (deposit.allocations.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete deposit with existing allocations' },
        { status: 409 }
      )
    }

    await prisma.walletDeposit.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add "src/app/api/wallet/deposits/[id]/route.ts"
git commit -m "feat: DELETE /api/wallet/deposits/[id] — blocked when allocations exist"
```

---

## Task 7: Campaign Allocation API

**Files:**
- Create: `src/app/api/campaigns/[id]/allocation/route.ts`

- [ ] **Step 1: Create directory and route**

```bash
mkdir -p "src/app/api/campaigns/[id]/allocation"
```

Create `src/app/api/campaigns/[id]/allocation/route.ts`:

```ts
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

    if (isNaN(amountTon) || amountTon <= 0) {
      return NextResponse.json({ error: 'amountTon must be > 0' }, { status: 400 })
    }

    const existing = await prisma.campaignAllocation.findUnique({
      where: { campaignId },
      include: { deposit: { include: { allocations: true } } },
    })

    if (existing) {
      // Update: validate against same deposit's available balance (remaining + current)
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

    // Create: find oldest deposit with sufficient remaining balance (FIFO)
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

- [ ] **Step 2: Run all tests**

```bash
npm test 2>&1 | tail -5
```

Expected: All tests pass

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/campaigns/[id]/allocation/route.ts"
git commit -m "feat: GET+POST+DELETE /api/campaigns/[id]/allocation — FIFO deposit assignment"
```

---

## Task 8: Wallet Page UI

**Files:**
- Create: `src/app/wallet/page.tsx`
- Create: `src/app/wallet/deposit-form.tsx`

- [ ] **Step 1: Create deposit-form.tsx (Client Component)**

```bash
mkdir -p src/app/wallet
```

Create `src/app/wallet/deposit-form.tsx`:

```tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function DepositForm({ onCancel }: { onCancel: () => void }) {
  const router = useRouter()
  const today = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState({
    amountTon: '',
    depositedAt: today,
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

  async function fetchRateForDate(date: string) {
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
      // user can fill manually
    } finally {
      setFetching(false)
    }
  }

  useEffect(() => {
    fetchRateForDate(today)
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/wallet/deposits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amountTon: parseFloat(form.amountTon),
          tonPriceUsd: parseFloat(form.tonPriceUsd),
          usdThbRate: parseFloat(form.usdThbRate),
          depositedAt: form.depositedAt,
          note: form.note || null,
        }),
      })

      if (res.ok) {
        router.refresh()
        onCancel()
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
    <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border p-4 bg-muted/10">
      <p className="font-medium text-sm">ฝากเงินเข้า Wallet</p>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>จำนวน TON</Label>
          <Input
            type="number"
            step="0.00000001"
            value={form.amountTon}
            onChange={e => set('amountTon', e.target.value)}
            placeholder="2000"
            required
          />
        </div>
        <div className="space-y-2">
          <Label>วันที่ฝาก</Label>
          <Input
            type="date"
            value={form.depositedAt}
            onChange={e => {
              set('depositedAt', e.target.value)
              setForm(f => ({ ...f, depositedAt: e.target.value, tonPriceUsd: '', usdThbRate: '' }))
              fetchRateForDate(e.target.value)
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
        <Label>Note (optional)</Label>
        <Input value={form.note} onChange={e => set('note', e.target.value)} placeholder="เช่น ซื้อรอบเดือนพฤษภาคม" />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-3">
        <Button type="submit" disabled={loading}>
          {loading ? 'กำลังบันทึก...' : 'บันทึก'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          ยกเลิก
        </Button>
      </div>
    </form>
  )
}
```

- [ ] **Step 2: Create wallet/page.tsx (Server Component)**

Create `src/app/wallet/page.tsx`:

```tsx
import { prisma } from '@/lib/prisma'
import { computeWalletBalance, findCurrentRate } from '@/lib/wallet'
import { WalletClient } from './wallet-client'

export const dynamic = 'force-dynamic'

export default async function WalletPage() {
  const deposits = await prisma.walletDeposit.findMany({
    include: {
      allocations: {
        include: { campaign: { select: { id: true, name: true } } },
      },
    },
    orderBy: { depositedAt: 'desc' },
  })

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
    />
  )
}
```

- [ ] **Step 3: Create wallet-client.tsx (Client Component)**

Create `src/app/wallet/wallet-client.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { DepositForm } from './deposit-form'

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
}: {
  balance: number
  currentRate: { tonPriceUsd: number; usdThbRate: number } | null
  deposits: Deposit[]
}) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
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
        <Button onClick={() => setShowForm(true)} disabled={showForm}>
          + ฝากเงิน
        </Button>
      </div>

      {showForm && <DepositForm onCancel={() => setShowForm(false)} />}

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

            {d.allocations.length > 0 ? (
              <div className="text-sm text-muted-foreground pl-2 border-l-2 border-muted">
                <p>จัดสรรให้: <span className="text-foreground font-medium">{d.allocations[0].campaignName}</span> · {d.allocations[0].amountTon.toFixed(4)} TON</p>
                <p>คงเหลือ: <span className={d.remaining > 0 ? 'text-green-400' : 'text-muted-foreground'}>{d.remaining.toFixed(4)} TON</span></p>
              </div>
            ) : (
              <p className="text-sm text-green-400 pl-2">ยังไม่ได้จัดสรร · คงเหลือ {d.remaining.toFixed(4)} TON</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests**

```bash
npm test 2>&1 | tail -5
```

Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add src/app/wallet/
git commit -m "feat: wallet page — deposit history, balance, current rate, create/delete deposit"
```

---

## Task 9: Campaign Allocation Card

**Files:**
- Create: `src/components/allocation-card.tsx`
- Modify: `src/app/campaigns/[id]/page.tsx`

- [ ] **Step 1: Create src/components/allocation-card.tsx**

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface AllocationInfo {
  id: string
  amountTon: number
  tonPriceUsd: number
  usdThbRate: number
}

export function AllocationCard({
  campaignId,
  allocation,
  walletBalance,
  currentRate,
}: {
  campaignId: string
  allocation: AllocationInfo | null
  walletBalance: number
  currentRate: { tonPriceUsd: number; usdThbRate: number } | null
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSave() {
    const amountTon = parseFloat(amount)
    if (isNaN(amountTon) || amountTon <= 0) {
      setError('กรุณากรอกจำนวน TON ที่ถูกต้อง')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/allocation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountTon }),
      })
      if (res.ok) {
        router.refresh()
        setEditing(false)
        setAmount('')
      } else {
        const data = await res.json()
        setError(data.error === 'INSUFFICIENT_BALANCE' ? 'ยอดเงินใน Wallet ไม่พอ' : 'บันทึกไม่สำเร็จ')
      }
    } catch {
      setError('บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง')
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete() {
    setLoading(true)
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/allocation`, { method: 'DELETE' })
      if (res.ok) {
        router.refresh()
      }
    } finally {
      setLoading(false)
    }
  }

  if (!allocation && !editing) {
    return (
      <div className="rounded-lg border border-yellow-700/50 bg-yellow-950/10 p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-yellow-400">⚠ ยังไม่ได้จัดสรรงบจาก Wallet</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {currentRate
                ? `Wallet: ${walletBalance.toFixed(4)} TON · 1 TON = $${currentRate.tonPriceUsd.toFixed(4)} / ฿${currentRate.usdThbRate.toFixed(4)}`
                : 'ไม่มี deposit ที่มีเงินเหลือใน Wallet'}
            </p>
          </div>
          {currentRate && walletBalance > 0 && (
            <Button
              size="sm"
              onClick={() => {
                setEditing(true)
                setAmount('')
              }}
            >
              จัดสรรงบ
            </Button>
          )}
        </div>
      </div>
    )
  }

  if (editing) {
    return (
      <div className="rounded-lg border p-4 space-y-3">
        <p className="text-sm font-medium">จัดสรรงบจาก Wallet</p>
        {currentRate && (
          <p className="text-xs text-muted-foreground">
            อัตราที่จะใช้ (locked): 1 TON = ${currentRate.tonPriceUsd.toFixed(4)} / ฿{currentRate.usdThbRate.toFixed(4)}
          </p>
        )}
        <div className="flex gap-3 items-end">
          <div className="space-y-1.5">
            <Label>จำนวน TON</Label>
            <Input
              type="number"
              step="0.00000001"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="500"
              className="w-40"
            />
          </div>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? 'กำลังบันทึก...' : 'ยืนยัน'}
          </Button>
          <Button variant="outline" onClick={() => { setEditing(false); setError('') }}>
            ยกเลิก
          </Button>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    )
  }

  // Has allocation
  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">งบจาก Wallet</p>
          <p className="font-medium">{allocation!.amountTon.toFixed(4)} TON</p>
          <p className="text-xs text-muted-foreground">
            1 TON = ${allocation!.tonPriceUsd.toFixed(4)} / ฿{allocation!.usdThbRate.toFixed(4)} (locked)
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setEditing(true)
              setAmount(String(allocation!.amountTon))
            }}
          >
            แก้ไข
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-destructive"
            disabled={loading}
            onClick={handleDelete}
          >
            ลบ
          </Button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Modify src/app/campaigns/[id]/page.tsx**

Replace the full file:

```tsx
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { calcAggregateMetrics } from '@/lib/metrics'
import { computeWalletBalance, findCurrentRate } from '@/lib/wallet'
import { MetricCards } from '@/components/metric-cards'
import { PerformanceTable } from '@/components/performance-table'
import { AllocationCard } from '@/components/allocation-card'
import { buttonVariants } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export const dynamic = 'force-dynamic'

const STATUS_COLORS = { ACTIVE: 'default', PAUSED: 'secondary', DONE: 'outline' } as const

export default async function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const [campaign, walletDeposits] = await Promise.all([
    prisma.campaign.findUnique({
      where: { id },
      include: {
        entries: { orderBy: { date: 'desc' } },
        allocation: { include: { deposit: true } },
      },
    }),
    prisma.walletDeposit.findMany({
      include: { allocations: true },
      orderBy: { depositedAt: 'asc' },
    }),
  ])

  if (!campaign) notFound()

  const campaignDailyBudget = Number(campaign.dailyBudgetTon)

  const allAllocations = walletDeposits.flatMap(d =>
    d.allocations.map(a => ({ depositId: a.depositId, amountTon: Number(a.amountTon) }))
  )
  const depositsNormalized = walletDeposits.map(d => ({
    id: d.id,
    amountTon: Number(d.amountTon),
    depositedAt: d.depositedAt,
    tonPriceUsd: Number(d.tonPriceUsd),
    usdThbRate: Number(d.usdThbRate),
  }))

  const walletBalance = computeWalletBalance(depositsNormalized, allAllocations)
  const currentRate = findCurrentRate(depositsNormalized, allAllocations)

  const allocationForCard = campaign.allocation
    ? {
        id: campaign.allocation.id,
        amountTon: Number(campaign.allocation.amountTon),
        tonPriceUsd: Number(campaign.allocation.deposit.tonPriceUsd),
        usdThbRate: Number(campaign.allocation.deposit.usdThbRate),
      }
    : null

  const entriesForCalc = campaign.entries.map(e => ({
    spendTon: Number(e.spendTon),
    dailyBudgetTon: campaignDailyBudget || Number(e.dailyBudgetTon),
    tonPriceUsd: Number(e.tonPriceUsd),
    usdThbRate: Number(e.usdThbRate),
    impressions: e.impressions,
    views: e.views,
    clicks: e.clicks,
    joins: e.joins,
  }))

  const metrics = entriesForCalc.length > 0 ? calcAggregateMetrics(entriesForCalc) : null

  const serializedEntries = campaign.entries.map(e => ({
    id: e.id,
    campaignId: e.campaignId,
    date: e.date.toISOString(),
    spendTon: Number(e.spendTon),
    dailyBudgetTon: Number(e.dailyBudgetTon),
    tonPriceUsd: Number(e.tonPriceUsd),
    usdThbRate: Number(e.usdThbRate),
    impressions: e.impressions,
    views: e.views,
    clicks: e.clicks,
    joins: e.joins,
    note: e.note,
  }))

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold">{campaign.name}</h1>
            <Badge variant={STATUS_COLORS[campaign.status as keyof typeof STATUS_COLORS]}>
              {campaign.status}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            โปรโมต: {campaign.targetType} · {campaign.targetName} ·{' '}
            เริ่ม {new Date(campaign.startDate).toLocaleDateString('th-TH')}
            {campaign.endDate && ` — ${new Date(campaign.endDate).toLocaleDateString('th-TH')}`}
          </p>
          {campaign.placementName && (
            <p className="text-sm text-muted-foreground">ปลายทาง: {campaign.placementName}</p>
          )}
          <p className="text-sm text-muted-foreground">
            Daily Budget: {Number(campaign.dailyBudgetTon).toFixed(2)} TON/วัน
            {campaign.budgetTon && ` · งบรวม: ${Number(campaign.budgetTon).toFixed(2)} TON`}
          </p>
          {campaign.note && <p className="text-sm text-muted-foreground mt-1">{campaign.note}</p>}
        </div>
        <div className="flex gap-2">
          <Link href={`/campaigns/${id}/edit`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>แก้ไข</Link>
          <Link href={`/campaigns/${id}/entries/new`} className={buttonVariants({ size: 'sm' })}>+ บันทึกวันนี้</Link>
        </div>
      </div>

      <AllocationCard
        campaignId={id}
        allocation={allocationForCard}
        walletBalance={walletBalance}
        currentRate={currentRate}
      />

      {metrics ? (
        <MetricCards metrics={metrics} />
      ) : (
        <p className="text-sm text-muted-foreground">ยังไม่มีข้อมูล performance</p>
      )}

      <div>
        <h2 className="text-lg font-semibold mb-3">Performance Log</h2>
        <PerformanceTable entries={serializedEntries} targetType={campaign.targetType} campaignDailyBudget={campaignDailyBudget} campaignId={id} />
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Run tests**

```bash
npm test 2>&1 | tail -5
```

Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add src/components/allocation-card.tsx src/app/campaigns/[id]/page.tsx
git commit -m "feat: campaign allocation card — create/edit/delete allocation from campaign detail"
```

---

## Task 10: EntryForm Rate Locking

**Files:**
- Modify: `src/components/entry-form.tsx`

- [ ] **Step 1: Update EntryForm props and rate logic**

In `src/components/entry-form.tsx`:

**Change the props interface** (lines 11-27) — add `allocationRate`:

```ts
export function EntryForm({ campaignId, targetType, defaultDailyBudget, entry, entryId, allocationRate }: {
  campaignId: string
  targetType: string
  defaultDailyBudget?: string
  entry?: {
    date: string
    spendTon: number
    dailyBudgetTon: number
    tonPriceUsd: number
    usdThbRate: number
    views: number
    clicks: number
    joins: number
    note?: string | null
  }
  entryId?: string
  allocationRate?: { tonPriceUsd: number; usdThbRate: number }
}) {
```

**Change useState initial values** — the `tonPriceUsd` and `usdThbRate` lines in `setForm`:

```ts
  const [form, setForm] = useState({
    date: entry ? entry.date.slice(0, 10) : today,
    dailyBudgetTon: entry ? String(entry.dailyBudgetTon) : (defaultDailyBudget ?? ''),
    spendTon: entry ? String(entry.spendTon) : '',
    tonPriceUsd: entry
      ? String(entry.tonPriceUsd)
      : allocationRate
        ? allocationRate.tonPriceUsd.toFixed(4)
        : '',
    usdThbRate: entry
      ? String(entry.usdThbRate)
      : allocationRate
        ? allocationRate.usdThbRate.toFixed(4)
        : '',
    views: entry ? String(entry.views) : '',
    clicks: entry ? String(entry.clicks) : '',
    joins: entry ? String(entry.joins) : '',
    note: entry?.note ?? '',
  })
```

**Change the useEffect for fetchRates** — skip when allocationRate provided or editing existing entry. Find the existing `useEffect` that calls `fetchRates` and replace it:

```ts
  useEffect(() => {
    if (entry || allocationRate) return
    fetchRates()
  }, [fetchRates])
```

**Change the rate fields section** in the JSX (the `<div className="grid grid-cols-2 gap-4">` containing TON/USD and USD/THB inputs) — replace entire section:

```tsx
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <Label>ราคา TON/USD</Label>
            {!allocationRate && !entry && (
              <button type="button" onClick={fetchRates} disabled={fetching} className="text-xs text-blue-400 hover:underline disabled:opacity-50">
                {fetching ? 'กำลังดึง...' : '↻ ดึงอัตโนมัติ'}
              </button>
            )}
          </div>
          <Input
            type="number"
            step="0.0001"
            value={form.tonPriceUsd}
            onChange={e => set('tonPriceUsd', e.target.value)}
            placeholder="3.18"
            required
            readOnly={!!allocationRate && !entry}
            className={allocationRate && !entry ? 'opacity-70 cursor-not-allowed' : ''}
          />
          {allocationRate && !entry && (
            <p className="text-xs text-blue-400">อัตราจาก Wallet Deposit (locked)</p>
          )}
          {fetchedAt && !allocationRate && <p className="text-xs text-green-500">อัปเดต {fetchedAt}</p>}
        </div>
        <div className="space-y-2">
          <Label>อัตรา USD/THB</Label>
          <Input
            type="number"
            step="0.0001"
            value={form.usdThbRate}
            onChange={e => set('usdThbRate', e.target.value)}
            placeholder="32.45"
            required
            readOnly={!!allocationRate && !entry}
            className={allocationRate && !entry ? 'opacity-70 cursor-not-allowed' : ''}
          />
        </div>
      </div>
```

- [ ] **Step 2: Run tests**

```bash
npm test 2>&1 | tail -5
```

Expected: All tests pass

- [ ] **Step 3: Commit**

```bash
git add src/components/entry-form.tsx
git commit -m "feat: EntryForm allocationRate prop — pre-fill and lock rate fields from wallet deposit"
```

---

## Task 11: CsvImport Rate Locking

**Files:**
- Modify: `src/components/csv-import.tsx`

- [ ] **Step 1: Add allocationRate prop to CsvImport**

In `src/components/csv-import.tsx`:

**Change the component signature** (line 65):

```ts
export function CsvImport({ campaignId, targetType, defaultDailyBudget, allocationRate }: {
  campaignId: string
  targetType: string
  defaultDailyBudget?: string
  allocationRate?: { tonPriceUsd: number; usdThbRate: number }
}) {
```

**Change fetchHistorical call in handleFile** — skip historical fetch when allocationRate provided. In the Promise.all `.then()` block, replace the `if (merged.length > 0)` section:

```ts
      if (merged.length > 0 && !allocationRate) {
        const dates = merged.map(r => r.date)
        fetchHistorical(dates[0], dates[dates.length - 1])
      }
```

**Change rate status display** — replace the entire "Rate status" comment block in the JSX:

```tsx
            {/* Rate status */}
            {allocationRate ? (
              <p className="text-xs text-blue-400">
                ใช้อัตราจาก Wallet Deposit: 1 TON = ${allocationRate.tonPriceUsd.toFixed(4)} / ฿{allocationRate.usdThbRate.toFixed(4)} (locked ทุกแถว)
              </p>
            ) : (
              <>
                {ratesFetching && (
                  <p className="text-xs text-blue-400">กำลังดึง rate ย้อนหลังรายวัน...</p>
                )}
                {hasHistoricalRates && !ratesFetching && (
                  <p className="text-xs text-green-500">ดึง rate รายวันสำเร็จ ({Object.keys(historicalRates).length} วัน) — TON/USD และ USD/THB แต่ละวันจะถูกใช้อัตโนมัติ</p>
                )}
                {ratesError && (
                  <p className="text-xs text-yellow-500">{ratesError}</p>
                )}
              </>
            )}
```

**Change the rate fallback inputs** — wrap the `{!hasHistoricalRates && !ratesFetching && ...}` block with an additional `allocationRate` check:

```tsx
              {!allocationRate && !hasHistoricalRates && !ratesFetching && (
                <>
                  <div className="space-y-2">
                    <Label>ราคา TON/USD {ratesError ? '(ค่าสำรอง)' : ''}</Label>
                    <Input type="number" step="0.0001" value={fallback.tonPriceUsd} onChange={e => setF('tonPriceUsd', e.target.value)} placeholder="3.18" required={!hasHistoricalRates} />
                  </div>
                  <div className="space-y-2">
                    <Label>อัตรา USD/THB {ratesError ? '(ค่าสำรอง)' : ''}</Label>
                    <Input type="number" step="0.0001" value={fallback.usdThbRate} onChange={e => setF('usdThbRate', e.target.value)} placeholder="32.45" required={!hasHistoricalRates} />
                  </div>
                </>
              )}
```

**Change missingRateDates check in handleSubmit** — when allocationRate is provided, no missing rates:

```ts
    const fbTon = allocationRate ? allocationRate.tonPriceUsd : parseFloat(fallback.tonPriceUsd)
    const fbThb = allocationRate ? allocationRate.usdThbRate : parseFloat(fallback.usdThbRate)
    const missingRateDates = rows.filter(r => {
      const ton = historicalRates[r.date]?.tonUsd ?? fbTon
      const thb = historicalRates[r.date]?.usdThb ?? fbThb
      return isNaN(ton) || isNaN(thb)
    })
```

**Change payload construction** — when allocationRate provided, use it for all rows:

```ts
    const payload = rows.map(r => ({
      ...r,
      spendTon: r.spendTon ?? parseFloat(fallback.spendTon),
      dailyBudgetTon: parseFloat(defaultDailyBudget ?? '0'),
      tonPriceUsd: allocationRate
        ? allocationRate.tonPriceUsd
        : (historicalRates[r.date]?.tonUsd ?? fbTon),
      usdThbRate: allocationRate
        ? allocationRate.usdThbRate
        : (historicalRates[r.date]?.usdThb ?? fbThb),
    }))
```

- [ ] **Step 2: Run tests**

```bash
npm test 2>&1 | tail -5
```

Expected: All tests pass

- [ ] **Step 3: Commit**

```bash
git add src/components/csv-import.tsx
git commit -m "feat: CsvImport allocationRate prop — skip historical fetch, use fixed deposit rate"
```

---

## Task 12: New Entry Page + TabsClient

**Files:**
- Modify: `src/app/campaigns/[id]/entries/new/page.tsx`
- Modify: `src/app/campaigns/[id]/entries/new/tabs-client.tsx`

- [ ] **Step 1: Update tabs-client.tsx to forward allocationRate**

Replace `src/app/campaigns/[id]/entries/new/tabs-client.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { EntryForm } from '@/components/entry-form'
import { CsvImport } from '@/components/csv-import'

export function TabsClient({
  campaignId,
  targetType,
  defaultDailyBudget,
  allocationRate,
}: {
  campaignId: string
  targetType: string
  defaultDailyBudget?: string
  allocationRate?: { tonPriceUsd: number; usdThbRate: number }
}) {
  const [tab, setTab] = useState<'manual' | 'csv'>('manual')

  return (
    <div className="space-y-4">
      <div className="flex gap-1 border-b">
        <button
          onClick={() => setTab('manual')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'manual' ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          กรอกเอง
        </button>
        <button
          onClick={() => setTab('csv')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'csv' ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Import CSV
        </button>
      </div>

      {tab === 'manual' ? (
        <EntryForm
          campaignId={campaignId}
          targetType={targetType}
          defaultDailyBudget={defaultDailyBudget}
          allocationRate={allocationRate}
        />
      ) : (
        <CsvImport
          campaignId={campaignId}
          targetType={targetType}
          defaultDailyBudget={defaultDailyBudget}
          allocationRate={allocationRate}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Update new entry page to fetch allocation**

Replace `src/app/campaigns/[id]/entries/new/page.tsx`:

```tsx
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { TabsClient } from './tabs-client'

export default async function NewEntryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: { allocation: { include: { deposit: true } } },
  })

  if (!campaign) notFound()

  const allocationRate = campaign.allocation
    ? {
        tonPriceUsd: Number(campaign.allocation.deposit.tonPriceUsd),
        usdThbRate: Number(campaign.allocation.deposit.usdThbRate),
      }
    : undefined

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">บันทึก Performance</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {campaign.name} · {campaign.targetType} · {campaign.targetName}
        </p>
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

- [ ] **Step 3: Run tests**

```bash
npm test 2>&1 | tail -5
```

Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add "src/app/campaigns/[id]/entries/new/"
git commit -m "feat: new entry page passes allocation rate to EntryForm and CsvImport"
```

---

## Task 13: Dashboard Wallet Card

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Replace AppSettings query with wallet balance**

Replace `src/app/page.tsx`:

```tsx
import { prisma } from '@/lib/prisma'
import { CampaignCard } from '@/components/campaign-card'
import { calcAggregateMetrics } from '@/lib/metrics'
import { computeWalletBalance, findCurrentRate } from '@/lib/wallet'
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const [campaigns, walletDeposits] = await Promise.all([
    prisma.campaign.findMany({
      include: { entries: { orderBy: { date: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.walletDeposit.findMany({
      include: { allocations: true },
      orderBy: { depositedAt: 'asc' },
    }),
  ])

  const allEntries = campaigns.flatMap(c => c.entries).map(e => ({
    spendTon: Number(e.spendTon),
    dailyBudgetTon: Number(e.dailyBudgetTon),
    tonPriceUsd: Number(e.tonPriceUsd),
    usdThbRate: Number(e.usdThbRate),
    impressions: e.impressions,
    views: e.views,
    clicks: e.clicks,
    joins: e.joins,
  }))

  const summary = allEntries.length > 0 ? calcAggregateMetrics(allEntries) : null
  const activeCampaigns = campaigns.filter(c => c.status === 'ACTIVE').length

  const allAllocations = walletDeposits.flatMap(d =>
    d.allocations.map(a => ({ depositId: a.depositId, amountTon: Number(a.amountTon) }))
  )
  const depositsNormalized = walletDeposits.map(d => ({
    id: d.id,
    amountTon: Number(d.amountTon),
    depositedAt: d.depositedAt,
    tonPriceUsd: Number(d.tonPriceUsd),
    usdThbRate: Number(d.usdThbRate),
  }))

  const walletBalance = computeWalletBalance(depositsNormalized, allAllocations)
  const currentRate = findCurrentRate(depositsNormalized, allAllocations)

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const recentSpend = campaigns
    .flatMap(c => c.entries)
    .filter(e => new Date(e.date) >= sevenDaysAgo)
    .reduce((sum, e) => sum + Number(e.spendTon), 0)
  const burnRate7d = recentSpend / 7
  const daysLeft = burnRate7d > 0 ? Math.floor(walletBalance / burnRate7d) : null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <Link href="/campaigns/new" className={buttonVariants({ size: 'sm' })}>+ Campaign</Link>
      </div>

      {walletBalance > 0 && (
        <div className="rounded-lg border p-4 bg-muted/20">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground mb-0.5">TON Wallet</p>
              <p className="text-2xl font-bold">{walletBalance.toFixed(4)} TON</p>
              {currentRate && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  1 TON = ${currentRate.tonPriceUsd.toFixed(4)} / ฿{currentRate.usdThbRate.toFixed(4)}
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Burn rate (7d avg)</p>
              <p className="text-base font-semibold">{burnRate7d.toFixed(2)} TON/วัน</p>
              {daysLeft !== null && (
                <p className="text-sm text-muted-foreground mt-0.5">
                  คงเหลือประมาณ{' '}
                  <span className={`font-medium ${daysLeft <= 7 ? 'text-destructive' : daysLeft <= 14 ? 'text-yellow-400' : 'text-green-400'}`}>
                    {daysLeft} วัน
                  </span>
                </p>
              )}
              {daysLeft === null && (
                <p className="text-sm text-muted-foreground mt-0.5">ไม่มีข้อมูล 7 วันล่าสุด</p>
              )}
            </div>
          </div>
        </div>
      )}

      {summary && (
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">Total Spend</p>
            <p className="text-2xl font-bold">{summary.totalSpendTon.toFixed(2)} TON</p>
            <p className="text-sm text-muted-foreground">≈ ฿{summary.spendThb.toLocaleString('th-TH', { maximumFractionDigits: 0 })}</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">Active Campaigns</p>
            <p className="text-2xl font-bold text-green-500">{activeCampaigns}</p>
            <p className="text-sm text-muted-foreground">{campaigns.length} ทั้งหมด</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">Avg CTR</p>
            <p className="text-2xl font-bold text-blue-400">{summary.ctr.toFixed(2)}%</p>
            <p className="text-sm text-muted-foreground">{summary.totalViews.toLocaleString()} views</p>
          </div>
        </div>
      )}

      {campaigns.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="mb-4">ยังไม่มี campaign</p>
          <Link href="/campaigns/new" className={buttonVariants()}>สร้าง campaign แรก</Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {campaigns.map(c => (
            <CampaignCard key={c.id} campaign={c} />
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Run tests**

```bash
npm test 2>&1 | tail -5
```

Expected: All tests pass

- [ ] **Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: dashboard wallet card from computed balance (replaces AppSettings)"
```

---

## Task 14: Settings Cleanup + Nav + Delete API

**Files:**
- Modify: `src/app/settings/page.tsx`
- Modify: `src/components/nav.tsx`
- Delete: `src/app/api/settings/route.ts`

- [ ] **Step 1: Remove wallet balance card from settings/page.tsx**

Replace `src/app/settings/page.tsx`:

```tsx
'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function SettingsPage() {
  const [importStatus, setImportStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle')
  const [exportError, setExportError] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleExport() {
    setExportError(false)
    try {
      const res = await fetch('/api/export')
      if (!res.ok) throw new Error('Export failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `ads-backup-${new Date().toISOString().split('T')[0]}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      setExportError(true)
    }
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setImportStatus('loading')
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      setImportStatus(res.ok ? 'ok' : 'error')
    } catch {
      setImportStatus('error')
    }

    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="space-y-6 max-w-xl">
      <h1 className="text-2xl font-bold">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Export / Import ข้อมูล</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground mb-3">
              ดาวน์โหลดข้อมูลทั้งหมดเป็นไฟล์ JSON สำหรับ backup
            </p>
            <Button onClick={handleExport} variant="outline">
              Export JSON
            </Button>
            {exportError && (
              <p className="text-sm text-destructive mt-2">Export ล้มเหลว ลองใหม่อีกครั้ง</p>
            )}
          </div>

          <hr className="border-border" />

          <div>
            <p className="text-sm text-muted-foreground mb-1">
              นำเข้าข้อมูลจากไฟล์ JSON
            </p>
            <p className="text-xs text-destructive mb-3">
              ⚠️ การ import จะลบข้อมูลทั้งหมดที่มีอยู่และแทนที่ด้วยข้อมูลจากไฟล์
            </p>
            <input
              ref={fileRef}
              type="file"
              accept=".json"
              onChange={handleImport}
              className="hidden"
              id="import-file"
            />
            <Button
              variant="outline"
              disabled={importStatus === 'loading'}
              onClick={() => fileRef.current?.click()}
            >
              {importStatus === 'loading' ? 'กำลัง import...' : 'Import JSON'}
            </Button>
            {importStatus === 'ok' && (
              <p className="text-sm text-green-500 mt-2">Import สำเร็จ</p>
            )}
            {importStatus === 'error' && (
              <p className="text-sm text-destructive mt-2">Import ล้มเหลว ตรวจสอบไฟล์อีกครั้ง</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 2: Add Wallet link to nav.tsx**

In `src/components/nav.tsx`, replace the `links` array:

```ts
  const links = [
    { href: '/', label: 'Dashboard' },
    { href: '/campaigns/new', label: '+ Campaign' },
    { href: '/wallet', label: 'Wallet' },
    { href: '/settings', label: 'Settings' },
  ]
```

- [ ] **Step 3: Delete the settings API route**

```bash
rm src/app/api/settings/route.ts
```

- [ ] **Step 4: Run all tests**

```bash
npm test 2>&1 | tail -15
```

Expected: All tests pass. Note the expected count after all tasks: wallet.test.ts (9) + export.test.ts (1) + existing tests (auth, entries-route, metrics, rates) ≈ 24+ tests total.

- [ ] **Step 5: Final commit**

```bash
git add src/app/settings/page.tsx src/components/nav.tsx
git rm src/app/api/settings/route.ts
git commit -m "feat: settings cleanup + Wallet nav link — remove wallet balance card, delete /api/settings"
```

---

## Post-Implementation Notes

### Manual step required after deploy
Before using the Wallet, create the first WalletDeposit via `/wallet → + ฝากเงิน`. The old `walletBalanceTon` from `AppSettings` is not migrated automatically (deposit date and rate were unknown).

### Backward compatibility
- Campaigns without allocation: entry form and CSV import continue using live rates (unchanged)
- Export v1 backups: can be imported; wallet data is ignored (no AppSettings table to restore to)
- Export v2 backups: full round-trip including wallet data
