# Dashboard Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** แยก Dashboard เป็น aggregate overview (KPI + trend chart) และย้าย campaign grid ไปหน้า `/campaigns` ใหม่

**Architecture:** Server Component ดึงข้อมูลและส่ง pre-computed `chartData[]` ไป Client Component (DashboardChart) ผ่าน props — Client ทำ filter range เอง ไม่มี re-fetch ข้อมูล `groupEntriesByDate` เป็น pure function ใน `lib/chart.ts` ที่ทดสอบได้

**Tech Stack:** Next.js 16 App Router, React 19, Prisma 6, recharts 3, Tailwind CSS 4, shadcn/ui

---

### Task 1: Install recharts

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install package**

```bash
npm install recharts
```

- [ ] **Step 2: Verify TypeScript types bundled**

```bash
ls node_modules/recharts/types/index.d.ts
```

Expected: ไฟล์มีอยู่ (recharts 3 รวม types ไว้แล้ว ไม่ต้อง `@types/recharts`)

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add recharts for dashboard trend chart"
```

---

### Task 2: Create `groupEntriesByDate` helper + tests

**Files:**
- Create: `src/lib/chart.ts`
- Create: `tests/chart.test.ts`

- [ ] **Step 1: Write failing tests**

สร้างไฟล์ `tests/chart.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { groupEntriesByDate } from '@/lib/chart'

describe('groupEntriesByDate', () => {
  it('returns empty array for no entries', () => {
    expect(groupEntriesByDate([])).toEqual([])
  })

  it('groups entries on same date and sums values', () => {
    const entries = [
      { date: new Date('2026-05-01T00:00:00'), spendTon: 1.5, joins: 10 },
      { date: new Date('2026-05-01T00:00:00'), spendTon: 2.0, joins: 5 },
    ]
    const result = groupEntriesByDate(entries)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({ date: '2026-05-01', spendTon: 3.5, joins: 15 })
  })

  it('keeps separate dates distinct', () => {
    const entries = [
      { date: new Date('2026-05-01T00:00:00'), spendTon: 1.0, joins: 8 },
      { date: new Date('2026-05-02T00:00:00'), spendTon: 2.0, joins: 3 },
    ]
    const result = groupEntriesByDate(entries)
    expect(result).toHaveLength(2)
  })

  it('sorts by date ascending', () => {
    const entries = [
      { date: new Date('2026-05-03T00:00:00'), spendTon: 1.0, joins: 5 },
      { date: new Date('2026-05-01T00:00:00'), spendTon: 2.0, joins: 3 },
      { date: new Date('2026-05-02T00:00:00'), spendTon: 1.5, joins: 7 },
    ]
    const result = groupEntriesByDate(entries)
    expect(result[0].date).toBe('2026-05-01')
    expect(result[1].date).toBe('2026-05-02')
    expect(result[2].date).toBe('2026-05-03')
  })

  it('formats date as YYYY-MM-DD string', () => {
    const entries = [
      { date: new Date('2026-05-07T12:00:00'), spendTon: 1.0, joins: 4 },
    ]
    const result = groupEntriesByDate(entries)
    expect(result[0].date).toBe('2026-05-07')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- tests/chart.test.ts
```

Expected: FAIL — "Cannot find module '@/lib/chart'"

- [ ] **Step 3: Implement `src/lib/chart.ts`**

```typescript
export type ChartDataPoint = {
  date: string
  spendTon: number
  joins: number
}

export function groupEntriesByDate(
  entries: { date: Date; spendTon: number; joins: number }[]
): ChartDataPoint[] {
  const map = new Map<string, { spendTon: number; joins: number }>()

  for (const e of entries) {
    const d = e.date
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const existing = map.get(key) ?? { spendTon: 0, joins: 0 }
    map.set(key, {
      spendTon: existing.spendTon + e.spendTon,
      joins: existing.joins + e.joins,
    })
  }

  return Array.from(map.entries())
    .map(([date, v]) => ({ date, ...v }))
    .sort((a, b) => a.date.localeCompare(b.date))
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- tests/chart.test.ts
```

Expected: PASS — 5 tests

- [ ] **Step 5: Run full test suite to confirm no regression**

```bash
npm test
```

Expected: ทุก test ผ่าน (เดิมมีอยู่ ~44 tests + 5 ใหม่)

- [ ] **Step 6: Commit**

```bash
git add src/lib/chart.ts tests/chart.test.ts
git commit -m "feat: add groupEntriesByDate helper for dashboard chart"
```

---

### Task 3: Create DashboardChart client component

**Files:**
- Create: `src/components/dashboard-chart.tsx`

- [ ] **Step 1: Create `src/components/dashboard-chart.tsx`**

```tsx
'use client'

import { useState, useMemo } from 'react'
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { ChartDataPoint } from '@/lib/chart'

type Range = '7d' | '30d' | 'all'

export function DashboardChart({ chartData }: { chartData: ChartDataPoint[] }) {
  const [range, setRange] = useState<Range>('30d')

  const filtered = useMemo(() => {
    if (range === 'all') return chartData
    const days = range === '7d' ? 7 : 30
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - days)
    const cutoffStr = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}-${String(cutoff.getDate()).padStart(2, '0')}`
    return chartData.filter(d => d.date >= cutoffStr)
  }, [chartData, range])

  if (chartData.length === 0) {
    return (
      <div className="rounded-lg border p-8 text-center text-muted-foreground text-sm">
        ยังไม่มีข้อมูล performance
      </div>
    )
  }

  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-medium">Trend</p>
        <div className="flex gap-1">
          {(['7d', '30d', 'all'] as Range[]).map(r => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1 text-xs rounded cursor-pointer transition-colors duration-150 ${
                range === r
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {r === 'all' ? 'ทั้งหมด' : r}
            </button>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <ComposedChart data={filtered} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            tickLine={false}
          />
          <YAxis
            yAxisId="spend"
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            tickLine={false}
            axisLine={false}
            width={48}
          />
          <YAxis
            yAxisId="joins"
            orientation="right"
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            tickLine={false}
            axisLine={false}
            width={36}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--popover))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '6px',
              fontSize: '12px',
            }}
            formatter={(value: number, name: string) =>
              name === 'spendTon'
                ? [`${value.toFixed(3)} TON`, 'Spend']
                : [value, 'Joins']
            }
          />
          <Area
            yAxisId="spend"
            type="monotone"
            dataKey="spendTon"
            fill="#3b82f620"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={false}
          />
          <Line
            yAxisId="joins"
            type="monotone"
            dataKey="joins"
            stroke="#22c55e"
            strokeWidth={2}
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
      <div className="flex gap-4 mt-2 justify-center">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="inline-block w-3 h-0.5 bg-blue-500" /> Spend (TON)
        </span>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="inline-block w-3 h-0.5 bg-green-500" /> Joins
        </span>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: ไม่มี error

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard-chart.tsx
git commit -m "feat: add DashboardChart client component (recharts)"
```

---

### Task 4: Create `/campaigns` page

**Files:**
- Create: `src/app/campaigns/page.tsx`

- [ ] **Step 1: Create `src/app/campaigns/page.tsx`**

```tsx
import { prisma } from '@/lib/prisma'
import { CampaignCard } from '@/components/campaign-card'
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'

export const dynamic = 'force-dynamic'

export default async function CampaignsPage() {
  const campaigns = await prisma.campaign.findMany({
    include: {
      entries: { orderBy: { date: 'asc' } },
      allocations: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  const channelCampaigns = campaigns.filter(c => c.targetType === 'CHANNEL')
  const botCampaigns = campaigns.filter(c => c.targetType === 'BOT')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Campaigns</h1>
        <Link href="/campaigns/new" className={buttonVariants({ size: 'sm' })}>+ Campaign</Link>
      </div>

      {campaigns.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="mb-4">ยังไม่มี campaign</p>
          <Link href="/campaigns/new" className={buttonVariants()}>สร้าง campaign แรก</Link>
        </div>
      ) : (
        <div className="space-y-8">
          {channelCampaigns.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <h2 className="text-lg font-semibold">CHANNEL</h2>
                <span className="text-sm text-muted-foreground">· {channelCampaigns.length}</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {channelCampaigns.map(c => (
                  <CampaignCard key={c.id} campaign={c} />
                ))}
              </div>
            </div>
          )}
          {botCampaigns.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <h2 className="text-lg font-semibold">BOT</h2>
                <span className="text-sm text-muted-foreground">· {botCampaigns.length}</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {botCampaigns.map(c => (
                  <CampaignCard key={c.id} campaign={c} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: ไม่มี error

- [ ] **Step 3: Commit**

```bash
git add src/app/campaigns/page.tsx
git commit -m "feat: add /campaigns page with campaign grid"
```

---

### Task 5: Rewrite Dashboard page (`/`)

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Replace `src/app/page.tsx` ทั้งไฟล์**

```tsx
import { prisma } from '@/lib/prisma'
import { calcAggregateMetrics } from '@/lib/metrics'
import { computeWalletBalance, findCurrentRate } from '@/lib/wallet'
import { groupEntriesByDate } from '@/lib/chart'
import { DashboardChart } from '@/components/dashboard-chart'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const [campaigns, deposits] = await Promise.all([
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
  ])

  // Auto-stop campaigns whose allocated budget is fully spent
  const depletedIds = campaigns
    .filter(c => {
      if (c.status !== 'ACTIVE') return false
      const allocated = c.allocations.reduce((s, a) => s + Number(a.amountTon), 0)
      if (allocated === 0) return false
      const spent = c.entries.reduce((s, e) => s + Number(e.spendTon), 0)
      return spent >= allocated
    })
    .map(c => c.id)
  if (depletedIds.length > 0) {
    await prisma.campaign.updateMany({ where: { id: { in: depletedIds } }, data: { status: 'STOPPED' } })
    campaigns.forEach(c => { if (depletedIds.includes(c.id)) (c as { status: string }).status = 'STOPPED' })
  }

  // Aggregate metrics
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
  const totalCampaigns = campaigns.length

  // Chart data — date serialized to string (ISO YYYY-MM-DD) before passing to Client Component
  const chartData = groupEntriesByDate(
    campaigns.flatMap(c =>
      c.entries.map(e => ({
        date: e.date,
        spendTon: Number(e.spendTon),
        joins: e.joins,
      }))
    )
  )

  // Wallet
  const depositsNum = deposits.map(d => ({
    ...d,
    amountTon: Number(d.amountTon),
    tonPriceUsd: Number(d.tonPriceUsd),
    usdThbRate: Number(d.usdThbRate),
  }))
  const allocationsNum = deposits
    .flatMap(d => d.allocations)
    .map(a => ({ depositId: a.depositId, amountTon: Number(a.amountTon) }))
  const walletBalance = computeWalletBalance(depositsNum, allocationsNum)
  const currentRate = findCurrentRate(depositsNum, allocationsNum)

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const recentSpend = campaigns
    .flatMap(c => c.entries)
    .filter(e => new Date(e.date) >= sevenDaysAgo)
    .reduce((sum, e) => sum + Number(e.spendTon), 0)
  const burnRate7d = recentSpend / 7
  const daysLeft = burnRate7d > 0 ? Math.floor(walletBalance / burnRate7d) : null

  const cpsThb =
    summary && summary.totalJoins > 0
      ? summary.spendThb / summary.totalJoins
      : null

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* Wallet Card */}
      {walletBalance > 0 && (
        <div className="rounded-lg border p-4 bg-muted/20">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground mb-0.5">
                TON Wallet ·{' '}
                <Link href="/wallet" className="text-blue-400 hover:underline">
                  ดูรายละเอียด
                </Link>
              </p>
              <p className="text-2xl font-bold">{walletBalance.toFixed(2)} TON</p>
              {currentRate && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  1 TON = ${currentRate.tonPriceUsd.toFixed(4)} / ฿{currentRate.usdThbRate.toFixed(2)}
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Burn rate (7d avg)</p>
              <p className="text-base font-semibold">{burnRate7d.toFixed(2)} TON/วัน</p>
              {daysLeft !== null ? (
                <p className="text-sm text-muted-foreground mt-0.5">
                  คงเหลือประมาณ{' '}
                  <span
                    className={`font-medium ${
                      daysLeft <= 7
                        ? 'text-destructive'
                        : daysLeft <= 14
                        ? 'text-yellow-400'
                        : 'text-green-400'
                    }`}
                  >
                    {daysLeft} วัน
                  </span>
                </p>
              ) : (
                <p className="text-sm text-muted-foreground mt-0.5">ไม่มีข้อมูล 7 วันล่าสุด</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* KPI Cards — always show */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Total Spend</p>
          <p className="text-2xl font-bold">
            {summary ? summary.totalSpendTon.toFixed(2) : '0.00'} TON
          </p>
          <p className="text-sm text-muted-foreground">
            ≈ ฿{summary ? summary.spendThb.toLocaleString('th-TH', { maximumFractionDigits: 0 }) : '0'}
          </p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Total Joins</p>
          <p className="text-2xl font-bold">
            {summary ? summary.totalJoins.toLocaleString() : '0'}
          </p>
          <p className="text-sm text-muted-foreground">รวม CHANNEL + BOT</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Campaigns</p>
          <p className="text-2xl font-bold text-green-500">{activeCampaigns} Active</p>
          <p className="text-sm text-muted-foreground">{totalCampaigns} ทั้งหมด</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Avg CTR</p>
          <p className="text-2xl font-bold text-blue-400">
            {summary ? summary.ctr.toFixed(2) : '0.00'}%
          </p>
          <p className="text-sm text-muted-foreground">
            {summary ? summary.totalViews.toLocaleString() : '0'} views
          </p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Avg CPS</p>
          <p className="text-2xl font-bold">
            {cpsThb !== null ? `฿${cpsThb.toFixed(2)}` : '—'}
          </p>
          <p className="text-sm text-muted-foreground">cost per join</p>
        </div>
      </div>

      {/* Trend Chart */}
      <DashboardChart chartData={chartData} />
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: ไม่มี error

- [ ] **Step 3: Run full test suite**

```bash
npm test
```

Expected: ทุก test ผ่าน (ไม่มี regression)

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: redesign dashboard — aggregate KPIs + trend chart, remove campaign grid"
```

---

### Task 6: Update Nav

**Files:**
- Modify: `src/components/nav.tsx`

- [ ] **Step 1: แก้ไข `src/components/nav.tsx`**

แทนที่ทั้งไฟล์:

```tsx
'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

export function Nav() {
  const pathname = usePathname()
  const router = useRouter()

  if (pathname === '/login') return null

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  const links = [
    { href: '/', label: 'Dashboard' },
    { href: '/campaigns', label: 'Campaigns' },
    { href: '/wallet', label: 'Wallet' },
    { href: '/settings', label: 'Settings' },
  ]

  function isActive(href: string) {
    if (href === '/campaigns') return pathname.startsWith('/campaigns')
    return pathname === href
  }

  return (
    <nav className="border-b px-6 py-3 flex items-center gap-6">
      <span className="font-semibold text-sm">Ads Tracker</span>
      <div className="flex items-center gap-4 flex-1">
        {links.map(l => (
          <Link
            key={l.href}
            href={l.href}
            className={`text-sm ${isActive(l.href) ? 'text-foreground font-medium' : 'text-muted-foreground hover:text-foreground'}`}
          >
            {l.label}
          </Link>
        ))}
      </div>
      <Button variant="ghost" size="sm" onClick={handleLogout}>
        Logout
      </Button>
    </nav>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: ไม่มี error

- [ ] **Step 3: Commit**

```bash
git add src/components/nav.tsx
git commit -m "feat: update nav — Campaigns link replaces + Campaign, fix active state"
```

---

### Task 7: Smoke Test

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

Expected: server ขึ้นที่ `http://localhost:3000` ไม่มี compile error

- [ ] **Step 2: ตรวจ Dashboard (`/`)**

เปิด `http://localhost:3000`:
- [ ] Wallet card แสดง (ถ้ามียอด)
- [ ] KPI 5 cards: Total Spend, Total Joins, Campaigns, Avg CTR, Avg CPS ครบ
- [ ] Trend chart แสดงพร้อมปุ่ม `7d` / `30d` / `ทั้งหมด`
- [ ] กด toggle เปลี่ยน range ได้ — chart อัปเดต
- [ ] **ไม่มี** campaign card grid บน dashboard

- [ ] **Step 3: ตรวจ Campaigns (`/campaigns`)**

เปิด `http://localhost:3000/campaigns`:
- [ ] หัวข้อ "Campaigns" + ปุ่ม "+ Campaign"
- [ ] Campaign grid CHANNEL / BOT แสดงครบ
- [ ] คลิก campaign card → ไปหน้า detail ได้

- [ ] **Step 4: ตรวจ Nav**

- [ ] "Campaigns" link highlight เมื่ออยู่ที่ `/campaigns`
- [ ] "Campaigns" link highlight เมื่ออยู่ที่ `/campaigns/[id]` (campaign detail)
- [ ] "Dashboard" link highlight เมื่ออยู่ที่ `/`
- [ ] ไม่มี "+ Campaign" ใน nav แล้ว

- [ ] **Step 5: Run full test suite ครั้งสุดท้าย**

```bash
npm test
```

Expected: ทุก test ผ่าน

- [ ] **Step 6: Update PROGRESS.md**

เพิ่มในหัวข้อ "เสร็จแล้ว":
```
- [x] **Dashboard Redesign** — aggregate overview (KPI + trend chart recharts), campaign grid ย้ายไป /campaigns, nav เปลี่ยนเป็น Campaigns link
```

อัปเดตวันที่ด้านบน

- [ ] **Step 7: Commit**

```bash
git add docs/PROGRESS.md
git commit -m "docs: update PROGRESS.md — dashboard redesign complete"
```
