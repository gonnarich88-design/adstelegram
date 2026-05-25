# Campaign CPM Bid Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เพิ่ม field `bidCpmTon` บน Campaign เพื่อบันทึก CPM bid (TON/1,000 impressions) และแสดง estimated daily impressions บน card และ detail page

**Architecture:** เพิ่ม nullable Decimal field ใน schema → API รับ/ส่ง field → form บังคับกรอก → card/detail แสดงคู่กับ daily budget → export/import backward compat

**Tech Stack:** Prisma 6, Next.js 16 App Router, React 19, TypeScript strict

---

## Files Changed

| File | Action |
|------|--------|
| `prisma/schema.prisma` | เพิ่ม `bidCpmTon Decimal?` |
| `src/app/api/campaigns/route.ts` | POST รับ + validate bidCpmTon |
| `src/app/api/campaigns/[id]/route.ts` | PUT รับ bidCpmTon |
| `src/components/campaign-form.tsx` | เพิ่ม field ใน form |
| `src/components/campaign-card.tsx` | เพิ่ม CPM Bid box |
| `src/app/campaigns/[id]/page.tsx` | เพิ่ม CPM Bid line ใน header |
| `src/lib/export.ts` | export + import backward compat |
| `tests/export.test.ts` | test backward compat |
| `src/app/campaigns/[id]/edit/page.tsx` | pass bidCpmTon ไปให้ form |

---

### Task 1: Schema Migration

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: เพิ่ม field ใน schema**

ใน `prisma/schema.prisma` เพิ่มบรรทัดหลัง `placementName`:

```prisma
model Campaign {
  id             String               @id @default(uuid())
  name           String
  targetType     TargetType
  targetName     String
  startDate      DateTime
  endDate        DateTime?
  budgetTon      Decimal?             @db.Decimal(18, 8)
  dailyBudgetTon Decimal              @db.Decimal(18, 8)
  bidCpmTon      Decimal?             @db.Decimal(18, 8)
  status         CampaignStatus       @default(ACTIVE)
  placementName  String?
  note           String?
  entries        PerformanceEntry[]
  allocations    CampaignAllocation[]
  refunds        WalletDeposit[]      @relation("CampaignRefunds")
  createdAt      DateTime             @default(now())
  updatedAt      DateTime             @updatedAt
}
```

- [ ] **Step 2: Run migration**

```bash
npx prisma migrate dev --name add_bid_cpm_ton
```

Expected: migration file สร้างใน `prisma/migrations/` และ schema apply สำเร็จ

- [ ] **Step 3: Regenerate Prisma client**

```bash
npx prisma generate
```

Expected: ไม่มี error

- [ ] **Step 4: Run tests**

```bash
npm test
```

Expected: 35 tests passed (ไม่มีอะไรเสีย)

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add bidCpmTon nullable field to Campaign schema"
```

---

### Task 2: API Routes — POST + PUT

**Files:**
- Modify: `src/app/api/campaigns/route.ts`
- Modify: `src/app/api/campaigns/[id]/route.ts`

- [ ] **Step 1: แก้ POST handler ใน `src/app/api/campaigns/route.ts`**

แก้ validation check และ prisma create:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const campaigns = await prisma.campaign.findMany({
      include: { entries: { orderBy: { date: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(campaigns)
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    if (!body.name || !body.targetType || !body.targetName || !body.startDate || !body.dailyBudgetTon) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    const bidCpmTon = body.bidCpmTon != null ? Number(body.bidCpmTon) : null
    if (bidCpmTon !== null && (isNaN(bidCpmTon) || bidCpmTon <= 0)) {
      return NextResponse.json({ error: 'bidCpmTon must be > 0' }, { status: 400 })
    }
    const campaign = await prisma.campaign.create({
      data: {
        name: body.name,
        targetType: body.targetType,
        targetName: body.targetName,
        startDate: new Date(body.startDate),
        endDate: body.endDate ? new Date(body.endDate) : null,
        budgetTon: body.budgetTon ?? null,
        dailyBudgetTon: body.dailyBudgetTon,
        bidCpmTon: bidCpmTon,
        status: body.status ?? 'ACTIVE',
        placementName: body.placementName ?? null,
        note: body.note ?? null,
      },
    })
    return NextResponse.json(campaign, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

- [ ] **Step 2: แก้ PUT handler ใน `src/app/api/campaigns/[id]/route.ts`**

เพิ่ม `bidCpmTon` ใน data object ของ update (รับ null ได้ สำหรับ backward compat):

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: { entries: { orderBy: { date: 'desc' } } },
    })
    if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(campaign)
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

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
    return NextResponse.json(campaign)
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
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
    await prisma.campaign.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

- [ ] **Step 3: Run tests**

```bash
npm test
```

Expected: 35 passed

- [ ] **Step 4: Commit**

```bash
git add src/app/api/campaigns/route.ts src/app/api/campaigns/\[id\]/route.ts
git commit -m "feat: API accept bidCpmTon on campaign POST/PUT"
```

---

### Task 3: Campaign Form

**Files:**
- Modify: `src/components/campaign-form.tsx`

- [ ] **Step 1: แก้ไฟล์ทั้งหมด**

แทนที่ไฟล์ `src/components/campaign-form.tsx` ด้วยโค้ดต่อไปนี้ (เพิ่ม `bidCpmTon` ใน interface, state, payload และ JSX):

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

interface CampaignFormProps {
  initialData?: {
    id: string
    name: string
    targetType: string
    targetName: string
    startDate: string
    endDate?: string | null
    dailyBudgetTon: string
    bidCpmTon?: string | null
    budgetTon?: string
    status: string
    note?: string | null
  }
}

export function CampaignForm({ initialData }: CampaignFormProps) {
  const router = useRouter()
  const isEdit = !!initialData

  const [form, setForm] = useState({
    name: initialData?.name ?? '',
    targetType: initialData?.targetType ?? 'CHANNEL',
    targetName: initialData?.targetName ?? '',
    placementName: (initialData as any)?.placementName ?? '',
    startDate: initialData?.startDate?.split('T')[0] ?? new Date().toISOString().split('T')[0],
    endDate: initialData?.endDate?.split('T')[0] ?? '',
    dailyBudgetTon: initialData?.dailyBudgetTon ?? '',
    bidCpmTon: initialData?.bidCpmTon ?? '',
    budgetTon: initialData?.budgetTon ?? '',
    status: initialData?.status ?? 'ACTIVE',
    note: initialData?.note ?? '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function set(key: string, value: string) {
    setForm(f => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const payload = {
      ...form,
      endDate: form.endDate || null,
      placementName: form.placementName || null,
      note: form.note || null,
      dailyBudgetTon: parseFloat(form.dailyBudgetTon),
      bidCpmTon: form.bidCpmTon ? parseFloat(form.bidCpmTon) : null,
      budgetTon: form.budgetTon ? parseFloat(form.budgetTon) : null,
    }

    const url = isEdit ? `/api/campaigns/${initialData!.id}` : '/api/campaigns'
    const method = isEdit ? 'PUT' : 'POST'

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        const data = await res.json()
        router.push(`/campaigns/${data.id}`)
        router.refresh()
      } else {
        setError('เกิดข้อผิดพลาด ลองใหม่อีกครั้ง')
      }
    } catch {
      setError('เกิดข้อผิดพลาด ลองใหม่อีกครั้ง')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-xl">
      <div className="space-y-2">
        <Label>ชื่อ Campaign</Label>
        <Input value={form.name} onChange={e => set('name', e.target.value)} required />
      </div>

      <div className="space-y-2">
        <Label>Target</Label>
        <div className="flex rounded-md border border-input overflow-hidden focus-within:ring-1 focus-within:ring-ring">
          <Select value={form.targetType} onValueChange={v => set('targetType', v ?? '')}>
            <SelectTrigger className="w-32 rounded-none border-0 border-r border-input focus:ring-0 shrink-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="CHANNEL">CHANNEL</SelectItem>
              <SelectItem value="BOT">BOT</SelectItem>
            </SelectContent>
          </Select>
          <input
            className="flex-1 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground"
            value={form.targetName}
            onChange={e => set('targetName', e.target.value)}
            placeholder="@username"
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>วันเริ่ม</Label>
          <Input type="date" value={form.startDate} onChange={e => set('startDate', e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label>วันสิ้นสุด (optional)</Label>
          <Input type="date" value={form.endDate} onChange={e => set('endDate', e.target.value)} />
        </div>
      </div>

      <div className="space-y-2">
        <Label>ปลายทาง <span className="text-muted-foreground font-normal">(optional — channel/topic ที่ ads โผล่)</span></Label>
        <Input
          value={form.placementName}
          onChange={e => set('placementName', e.target.value)}
          placeholder="เช่น Gaming, @somechannel"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>งบต่อวัน (TON)</Label>
          <Input
            type="number"
            step="0.001"
            value={form.dailyBudgetTon}
            onChange={e => set('dailyBudgetTon', e.target.value)}
            placeholder="10"
            required
          />
        </div>
        <div className="space-y-2">
          <Label>CPM Bid (TON)</Label>
          <Input
            type="number"
            step="0.0001"
            min="0.0001"
            value={form.bidCpmTon}
            onChange={e => set('bidCpmTon', e.target.value)}
            placeholder="0.50"
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>งบรวมทั้ง campaign (TON) <span className="text-muted-foreground font-normal">optional</span></Label>
        <Input
          type="number"
          step="0.001"
          value={form.budgetTon}
          onChange={e => set('budgetTon', e.target.value)}
          placeholder="300"
        />
      </div>

      {isEdit && (
        <div className="space-y-2">
          <Label>Status</Label>
          <Select value={form.status} onValueChange={v => set('status', v ?? '')}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ACTIVE">ACTIVE</SelectItem>
              <SelectItem value="PAUSED">PAUSED</SelectItem>
              <SelectItem value="DONE">DONE</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-2">
        <Label>Note (optional)</Label>
        <Textarea value={form.note ?? ''} onChange={e => set('note', e.target.value)} rows={3} />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-3">
        <Button type="submit" disabled={loading}>
          {loading ? 'กำลังบันทึก...' : isEdit ? 'บันทึกการแก้ไข' : 'สร้าง Campaign'}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          ยกเลิก
        </Button>
      </div>
    </form>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/campaign-form.tsx
git commit -m "feat: add CPM Bid field to campaign form"
```

---

### Task 4: Campaign Card

**Files:**
- Modify: `src/components/campaign-card.tsx`

- [ ] **Step 1: แก้ Daily Budget section ให้รองรับ CPM Bid box**

ใน `src/components/campaign-card.tsx` แทนที่ `CardContent` ทั้งหมด:

```typescript
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { calcAggregateMetrics } from '@/lib/metrics'

const STATUS_COLORS = {
  ACTIVE: 'default',
  PAUSED: 'secondary',
  DONE: 'outline',
  CANCELLED: 'destructive',
} as const

function fmt(n: number, digits = 2) {
  return n.toFixed(digits)
}

export function CampaignCard({ campaign }: { campaign: any }) {
  const campaignDailyBudget = Number(campaign.dailyBudgetTon)
  const bidCpmTon = campaign.bidCpmTon ? Number(campaign.bidCpmTon) : null
  const estimatedImpressions = bidCpmTon && bidCpmTon > 0
    ? Math.round((campaignDailyBudget / bidCpmTon) * 1000)
    : null

  const metrics = campaign.entries.length > 0
    ? calcAggregateMetrics(campaign.entries.map((e: any) => ({
        spendTon: Number(e.spendTon),
        dailyBudgetTon: Number(e.dailyBudgetTon) || campaignDailyBudget,
        tonPriceUsd: Number(e.tonPriceUsd),
        usdThbRate: Number(e.usdThbRate),
        impressions: e.impressions,
        views: e.views,
        clicks: e.clicks,
        joins: e.joins,
      })))
    : null

  const avgBsp = metrics?.bsp ?? 0
  const bspPct = Math.min(avgBsp, 100)

  const budgetTon = campaign.budgetTon ? Number(campaign.budgetTon) : null
  const totalSpentTon = metrics?.totalSpendTon ?? 0
  const budgetUsedPct = budgetTon && budgetTon > 0 ? Math.min((totalSpentTon / budgetTon) * 100, 100) : null

  return (
    <Link href={`/campaigns/${campaign.id}`}>
      <Card className="hover:border-foreground/30 transition-colors cursor-pointer">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-base">{campaign.name}</CardTitle>
            <Badge variant={STATUS_COLORS[campaign.status as keyof typeof STATUS_COLORS]}>
              {campaign.status}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            โปรโมต: {campaign.targetType} · {campaign.targetName}
          </p>
          {campaign.placementName && (
            <p className="text-xs text-muted-foreground">ปลายทาง: {campaign.placementName}</p>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          <div className={bidCpmTon !== null ? 'grid grid-cols-2 gap-3' : undefined}>
            <div>
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>Daily Budget</span>
                <span>{fmt(campaignDailyBudget, 2)} TON/วัน</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${bspPct}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">Avg BSP {fmt(avgBsp, 1)}%</p>
            </div>
            {bidCpmTon !== null && (
              <div>
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>CPM Bid</span>
                  <span>{bidCpmTon.toFixed(4)} TON</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden" />
                {estimatedImpressions !== null && (
                  <p className="text-xs text-muted-foreground mt-1">
                    ~{estimatedImpressions.toLocaleString('th-TH')} imp/วัน
                  </p>
                )}
              </div>
            )}
          </div>
          {budgetTon !== null && (
            <div>
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>Total Budget</span>
                <span>{totalSpentTon.toFixed(2)} / {budgetTon.toFixed(2)} TON</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${budgetUsedPct ?? 0}%`,
                    backgroundColor: (budgetUsedPct ?? 0) >= 90 ? 'hsl(0 72% 51%)' : (budgetUsedPct ?? 0) >= 70 ? 'hsl(45 93% 47%)' : 'hsl(142 71% 45%)',
                  }}
                />
              </div>
            </div>
          )}
          {metrics && (
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <p className="text-muted-foreground">CTR</p>
                <p className="font-medium">{fmt(metrics.ctr, 2)}%</p>
              </div>
              <div>
                <p className="text-muted-foreground">CPS</p>
                <p className="font-medium">฿{metrics.totalJoins > 0 ? fmt(metrics.spendThb / metrics.totalJoins, 2) : '—'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">{campaign.targetType === 'BOT' ? 'Startbot' : 'Joins'}</p>
                <p className="font-medium">{metrics.totalJoins.toLocaleString()}</p>
              </div>
            </div>
          )}
          {!metrics && (
            <p className="text-xs text-muted-foreground">ยังไม่มีข้อมูล</p>
          )}
          {campaign.allocations && campaign.allocations.length > 0 && (
            <p className="text-xs text-blue-400">
              จัดสรร {campaign.allocations.reduce((s: number, a: { amountTon: unknown }) => s + Number(a.amountTon), 0).toFixed(2)} TON จาก Wallet
            </p>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/campaign-card.tsx
git commit -m "feat: show CPM Bid box on campaign card"
```

---

### Task 5: Campaign Detail Page

**Files:**
- Modify: `src/app/campaigns/[id]/page.tsx`

- [ ] **Step 1: เพิ่ม CPM Bid line ใน header**

ใน `src/app/campaigns/[id]/page.tsx` แทนที่ส่วน header info (บรรทัด 113–117):

**ก่อนแก้:**
```typescript
          <p className="text-sm text-muted-foreground">
            Daily Budget: {Number(campaign.dailyBudgetTon).toFixed(2)} TON/วัน
            {campaign.budgetTon && ` · งบรวม: ${Number(campaign.budgetTon).toFixed(2)} TON`}
          </p>
          {campaign.note && <p className="text-sm text-muted-foreground mt-1">{campaign.note}</p>}
```

**หลังแก้:**
```typescript
          <p className="text-sm text-muted-foreground">
            Daily Budget: {Number(campaign.dailyBudgetTon).toFixed(2)} TON/วัน
            {campaign.budgetTon && ` · งบรวม: ${Number(campaign.budgetTon).toFixed(2)} TON`}
          </p>
          {campaign.bidCpmTon && Number(campaign.bidCpmTon) > 0 && (
            <p className="text-sm text-muted-foreground">
              CPM Bid: {Number(campaign.bidCpmTon).toFixed(4)} TON{' '}
              · ~{Math.round((Number(campaign.dailyBudgetTon) / Number(campaign.bidCpmTon)) * 1000).toLocaleString('th-TH')} imp/วัน
            </p>
          )}
          {campaign.note && <p className="text-sm text-muted-foreground mt-1">{campaign.note}</p>}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/campaigns/\[id\]/page.tsx
git commit -m "feat: show CPM Bid + estimated impressions on campaign detail"
```

---

### Task 6: Export / Import + Test

**Files:**
- Modify: `src/lib/export.ts`
- Modify: `tests/export.test.ts`

- [ ] **Step 1: เพิ่ม bidCpmTon ใน exportData**

ใน `src/lib/export.ts` แทนที่ campaigns map section (ประมาณบรรทัด 44–73):

```typescript
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
```

- [ ] **Step 2: เพิ่ม bidCpmTon ใน importData**

ใน `src/lib/export.ts` ใน `importData` แทนที่ `tx.campaign.create` data block:

```typescript
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
```

- [ ] **Step 3: เพิ่ม test backward compat ใน `tests/export.test.ts`**

เพิ่ม test case ต่อท้าย describe block ปัจจุบัน:

```typescript
describe('importData backward compat', () => {
  it('accepts campaign without bidCpmTon (old JSON) and stores null', async () => {
    const { prisma } = await import('@/lib/prisma')
    const mockTx = {
      campaignAllocation: { deleteMany: vi.fn() },
      performanceEntry: { deleteMany: vi.fn() },
      campaign: { deleteMany: vi.fn(), create: vi.fn() },
      walletDeposit: { deleteMany: vi.fn(), create: vi.fn() },
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
        // bidCpmTon intentionally missing (old JSON)
        status: 'ACTIVE',
        placementName: null,
        note: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        entries: [],
      }],
    })

    expect(mockTx.campaign.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ bidCpmTon: null }) })
    )
  })
})
```

- [ ] **Step 4: Run tests**

```bash
npm test
```

Expected: 36 passed (เพิ่ม 1 test)

- [ ] **Step 5: Commit**

```bash
git add src/lib/export.ts tests/export.test.ts
git commit -m "feat: export/import include bidCpmTon, backward compat for old JSON"
```

---

### Task 7: Edit Page — Pass bidCpmTon to Form

**Files:**
- Modify: `src/app/campaigns/[id]/edit/page.tsx`

- [ ] **Step 1: เพิ่ม bidCpmTon ใน initialData**

แทนที่ `initialData` object ใน `src/app/campaigns/[id]/edit/page.tsx`:

```typescript
      <CampaignForm
        initialData={{
          id: campaign.id,
          name: campaign.name,
          targetType: campaign.targetType,
          targetName: campaign.targetName,
          startDate: campaign.startDate.toISOString(),
          endDate: campaign.endDate?.toISOString() ?? null,
          dailyBudgetTon: campaign.dailyBudgetTon.toString(),
          bidCpmTon: campaign.bidCpmTon?.toString() ?? '',
          budgetTon: campaign.budgetTon?.toString() ?? '',
          status: campaign.status,
          note: campaign.note,
        }}
      />
```

- [ ] **Step 2: Run tests**

```bash
npm test
```

Expected: 36 passed

- [ ] **Step 3: Commit**

```bash
git add src/app/campaigns/\[id\]/edit/page.tsx
git commit -m "feat: pass bidCpmTon to edit form"
```
