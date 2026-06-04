# Goals Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** สร้างหน้า `/goals` สำหรับจดเป้าหมายรวม (global note) และเป้าหมายรายแคมเปญ (goalText, planText, targetJoins, targetDate) พร้อม progress bar แบบ linear pace

**Architecture:** Server Component ดึงข้อมูลจาก DB แล้วส่งให้ Client Component สำหรับ inline edit. Global note เก็บใน `GlobalGoal` singleton (id=1). Per-campaign goal fields เก็บบน Campaign record โดยตรง. Progress คำนวณ client-side จาก actual joins vs linear pace target.

**Tech Stack:** Prisma (schema migration), Next.js App Router (Server + Client), React, Tailwind, zod, lucide-react

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `prisma/schema.prisma` | Modify | Add 4 goal fields to Campaign + new GlobalGoal model |
| `prisma/migrations/...` | Create (auto) | Migration via `prisma migrate dev` |
| `src/app/api/goals/global/route.ts` | Create | GET/PUT global note endpoint |
| `src/app/api/campaigns/[id]/route.ts` | Modify | Accept goal fields in PUT (no changelog) |
| `src/app/goals/page.tsx` | Create | Server Component: fetch all data, render page shell |
| `src/app/goals/goals-client.tsx` | Create | Client Component: global note editor + campaign goal cards |
| `src/components/nav.tsx` | Modify | Add "เป้าหมาย" link |
| `src/lib/export.ts` | Modify | Include goal fields in campaign export + GlobalGoal in export/import |

---

### Task 1: Schema Migration

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add fields to schema**

In `prisma/schema.prisma`, add these 4 nullable fields to the `Campaign` model (after the existing `note` field):

```prisma
  goalText       String?
  planText       String?
  targetJoins    Int?
  targetDate     DateTime?
```

And add the new `GlobalGoal` model at the end of the file (before or after `DailyConversion`):

```prisma
model GlobalGoal {
  id        Int      @id @default(1)
  note      String?
  updatedAt DateTime @updatedAt
}
```

- [ ] **Step 2: Run migration**

```bash
npx prisma migrate dev --name add-goals
```

Expected: migration created and applied, Prisma client regenerated. Output includes "Your database is now in sync with your schema."

- [ ] **Step 3: Verify Prisma client**

```bash
npx prisma generate
```

Expected: "Generated Prisma Client" with no errors.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add goal fields to Campaign + GlobalGoal model"
```

---

### Task 2: Global Goal API

**Files:**
- Create: `src/app/api/goals/global/route.ts`

- [ ] **Step 1: Write failing test**

In `tests/goals-global.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    globalGoal: {
      upsert: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}))

import { prisma } from '@/lib/prisma'

describe('GlobalGoal upsert logic', () => {
  beforeEach(() => vi.clearAllMocks())

  it('upserts with id=1', async () => {
    const mock = vi.mocked(prisma.globalGoal.upsert)
    mock.mockResolvedValue({ id: 1, note: 'hello', updatedAt: new Date() } as any)

    await prisma.globalGoal.upsert({
      where: { id: 1 },
      create: { id: 1, note: 'hello' },
      update: { note: 'hello' },
    })

    expect(mock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 1 } })
    )
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test tests/goals-global.test.ts
```

Expected: FAIL — `prisma.globalGoal` not recognized yet (before migration applied, or passes after migration).

- [ ] **Step 3: Create the route**

Create `src/app/api/goals/global/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const putSchema = z.object({
  note: z.string().nullable().optional(),
})

export async function GET() {
  try {
    const record = await prisma.globalGoal.findUnique({ where: { id: 1 } })
    return NextResponse.json({ note: record?.note ?? null })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = putSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
    }
    const note = parsed.data.note ?? null
    const record = await prisma.globalGoal.upsert({
      where: { id: 1 },
      create: { id: 1, note },
      update: { note },
    })
    return NextResponse.json({ note: record.note })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

- [ ] **Step 4: Run tests**

```bash
npm test
```

Expected: all tests pass (44+1 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/goals/ tests/goals-global.test.ts
git commit -m "feat: add GET/PUT /api/goals/global endpoint"
```

---

### Task 3: Extend Campaign PUT for Goal Fields

**Files:**
- Modify: `src/app/api/campaigns/[id]/route.ts`

- [ ] **Step 1: Update PUT handler**

In `src/app/api/campaigns/[id]/route.ts`, update the `PUT` function to accept and save goal fields. These fields must NOT be passed to `diffCampaignFields` to avoid changelog entries.

Replace the `data: { ... }` block in the `prisma.campaign.update` call to include goal fields:

```typescript
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
  placementType: body.placementType ?? null,
  note: body.note ?? null,
  goalText: body.goalText ?? null,
  planText: body.planText ?? null,
  targetJoins: body.targetJoins != null ? Number(body.targetJoins) : null,
  targetDate: body.targetDate ? new Date(body.targetDate) : null,
},
```

The `diffCampaignFields` call and `changes` array remain unchanged — goal fields are intentionally excluded from changelog tracking.

- [ ] **Step 2: Run tests**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/campaigns/[id]/route.ts
git commit -m "feat: extend campaign PUT to accept goal fields (no changelog)"
```

---

### Task 4: Goals Page — Server Component

**Files:**
- Create: `src/app/goals/page.tsx`

- [ ] **Step 1: Create the Server Component**

Create `src/app/goals/page.tsx`:

```typescript
import { prisma } from '@/lib/prisma'
import { GoalsClient } from './goals-client'

export const dynamic = 'force-dynamic'

export default async function GoalsPage() {
  const [globalGoal, campaigns] = await Promise.all([
    prisma.globalGoal.findUnique({ where: { id: 1 } }),
    prisma.campaign.findMany({
      where: { status: { notIn: ['CANCELLED', 'DONE'] } },
      include: { entries: true },
      orderBy: [{ status: 'asc' }, { startDate: 'desc' }],
    }),
  ])

  return (
    <GoalsClient
      globalNote={globalGoal?.note ?? null}
      campaigns={campaigns.map(c => ({
        id: c.id,
        name: c.name,
        status: c.status,
        targetType: c.targetType,
        startDate: c.startDate.toISOString(),
        endDate: c.endDate?.toISOString() ?? null,
        targetDate: c.targetDate?.toISOString() ?? null,
        targetJoins: c.targetJoins ?? null,
        goalText: c.goalText ?? null,
        planText: c.planText ?? null,
        totalJoins: c.entries.reduce((s: number, e: any) => s + e.joins, 0),
      }))}
    />
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/goals/page.tsx
git commit -m "feat: goals page server component"
```

---

### Task 5: Goals Page — Client Component

**Files:**
- Create: `src/app/goals/goals-client.tsx`

This is the main UI. It renders:
1. Global note section (editable textarea, saved on blur)
2. Per-campaign goal cards (editable inline — click pencil icon to open form)

Progress bar logic:
- `paceTarget = targetJoins × (min(daysElapsed, totalDays) / totalDays)`
  where `totalDays = daysBetween(startDate, targetDate)` and `daysElapsed = daysBetween(startDate, today)`
- Progress bar fill = `actualJoins / targetJoins` (capped at 100%)
- Pace dot position = `paceTarget / targetJoins` (capped at 100%) — a small vertical line on the bar

- [ ] **Step 1: Create the Client Component**

Create `src/app/goals/goals-client.tsx`:

```typescript
'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface CampaignGoal {
  id: string
  name: string
  status: string
  targetType: string
  startDate: string
  endDate: string | null
  targetDate: string | null
  targetJoins: number | null
  goalText: string | null
  planText: string | null
  totalJoins: number
}

interface Props {
  globalNote: string | null
  campaigns: CampaignGoal[]
}

function daysBetween(a: Date, b: Date) {
  return Math.max(0, Math.floor((b.getTime() - a.getTime()) / 86400000))
}

function PaceBar({ startDate, targetDate, targetJoins, actualJoins }: {
  startDate: string
  targetDate: string | null
  targetJoins: number | null
  actualJoins: number
}) {
  if (!targetJoins || targetJoins <= 0 || !targetDate) return null

  const now = new Date()
  const start = new Date(startDate)
  const end = new Date(targetDate)
  const totalDays = daysBetween(start, end)

  if (totalDays <= 0) return null

  const daysElapsed = Math.min(daysBetween(start, now), totalDays)
  const paceTarget = Math.round(targetJoins * (daysElapsed / totalDays))
  const progressPct = Math.min(100, (actualJoins / targetJoins) * 100)
  const pacePct = Math.min(100, (paceTarget / targetJoins) * 100)
  const ahead = actualJoins >= paceTarget

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[11px] text-muted-foreground">
        <span>{actualJoins.toLocaleString('th-TH')} / {targetJoins.toLocaleString('th-TH')} joins</span>
        <span className={ahead ? 'text-green-500' : 'text-yellow-500'}>
          {ahead ? 'ahead' : 'behind'} pace ({paceTarget.toLocaleString('th-TH')} expected)
        </span>
      </div>
      <div className="relative h-2 bg-muted rounded-full overflow-visible">
        <div
          className={`h-full rounded-full transition-all ${ahead ? 'bg-green-500' : 'bg-yellow-400'}`}
          style={{ width: `${progressPct}%` }}
        />
        {/* pace marker */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-0.5 h-4 bg-foreground/40 rounded-full"
          style={{ left: `${pacePct}%` }}
        />
      </div>
      <div className="text-[10px] text-muted-foreground text-right">
        เส้นตาย: {new Date(targetDate!).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}
        {' · '}เหลือ {Math.max(0, daysBetween(now, end))} วัน
      </div>
    </div>
  )
}

function CampaignGoalCard({ campaign, onSaved }: { campaign: CampaignGoal; onSaved: () => void }) {
  const [editing, setEditing] = useState(false)
  const [goalText, setGoalText] = useState(campaign.goalText ?? '')
  const [planText, setPlanText] = useState(campaign.planText ?? '')
  const [targetJoins, setTargetJoins] = useState(campaign.targetJoins?.toString() ?? '')
  const [targetDate, setTargetDate] = useState(
    campaign.targetDate ? campaign.targetDate.slice(0, 10) : ''
  )
  const [saving, setSaving] = useState(false)

  const joinsLabel = campaign.targetType === 'BOT' ? 'Startbot' : 'Joins'
  const hasGoal = campaign.goalText || campaign.planText || campaign.targetJoins

  async function save() {
    setSaving(true)
    try {
      const res = await fetch(`/api/campaigns/${campaign.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: campaign.name,
          targetType: campaign.targetType,
          status: campaign.status,
          startDate: campaign.startDate,
          endDate: campaign.endDate,
          goalText: goalText.trim() || null,
          planText: planText.trim() || null,
          targetJoins: targetJoins ? Number(targetJoins) : null,
          targetDate: targetDate || null,
        }),
      })
      if (res.ok) {
        setEditing(false)
        onSaved()
      }
    } finally {
      setSaving(false)
    }
  }

  function cancel() {
    setGoalText(campaign.goalText ?? '')
    setPlanText(campaign.planText ?? '')
    setTargetJoins(campaign.targetJoins?.toString() ?? '')
    setTargetDate(campaign.targetDate ? campaign.targetDate.slice(0, 10) : '')
    setEditing(false)
  }

  return (
    <div className="border border-border rounded-lg p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-medium text-sm">{campaign.name}</div>
          <div className="text-[11px] text-muted-foreground">{campaign.status} · {campaign.targetType}</div>
        </div>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="text-muted-foreground hover:text-foreground p-1 rounded"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-3">
          <div>
            <label className="text-[11px] text-muted-foreground">เป้าหมาย</label>
            <textarea
              value={goalText}
              onChange={e => setGoalText(e.target.value)}
              placeholder="เป้าหมายของแคมเปญนี้..."
              rows={2}
              className="w-full mt-1 text-sm border border-border rounded-md px-3 py-2 bg-background resize-none focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground">แผน / วิธีการ</label>
            <textarea
              value={planText}
              onChange={e => setPlanText(e.target.value)}
              placeholder="จะทำอย่างไรต่อ..."
              rows={3}
              className="w-full mt-1 text-sm border border-border rounded-md px-3 py-2 bg-background resize-none focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-[11px] text-muted-foreground">เป้า {joinsLabel}</label>
              <input
                type="number"
                value={targetJoins}
                onChange={e => setTargetJoins(e.target.value)}
                placeholder="0"
                min={1}
                className="w-full mt-1 text-sm border border-border rounded-md px-3 py-2 bg-background focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div className="flex-1">
              <label className="text-[11px] text-muted-foreground">เส้นตาย</label>
              <input
                type="date"
                value={targetDate}
                onChange={e => setTargetDate(e.target.value)}
                className="w-full mt-1 text-sm border border-border rounded-md px-3 py-2 bg-background focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" onClick={cancel} disabled={saving}>
              <X className="w-3.5 h-3.5 mr-1" /> ยกเลิก
            </Button>
            <Button size="sm" onClick={save} disabled={saving}>
              <Check className="w-3.5 h-3.5 mr-1" /> {saving ? 'กำลังบันทึก...' : 'บันทึก'}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {!hasGoal && (
            <p className="text-[12px] text-muted-foreground italic">ยังไม่มีเป้าหมาย — กด ✏️ เพื่อเพิ่ม</p>
          )}
          {campaign.goalText && (
            <div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">เป้าหมาย</div>
              <p className="text-sm whitespace-pre-wrap">{campaign.goalText}</p>
            </div>
          )}
          {campaign.planText && (
            <div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">แผน</div>
              <p className="text-sm whitespace-pre-wrap">{campaign.planText}</p>
            </div>
          )}
          {campaign.targetJoins && (
            <PaceBar
              startDate={campaign.startDate}
              targetDate={campaign.targetDate}
              targetJoins={campaign.targetJoins}
              actualJoins={campaign.totalJoins}
            />
          )}
        </div>
      )}
    </div>
  )
}

export function GoalsClient({ globalNote, campaigns }: Props) {
  const router = useRouter()
  const [note, setNote] = useState(globalNote ?? '')
  const [noteSaving, setNoteSaving] = useState(false)
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const saveNote = useCallback(async (value: string) => {
    setNoteSaving(true)
    try {
      await fetch('/api/goals/global', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: value.trim() || null }),
      })
    } finally {
      setNoteSaving(false)
    }
  }, [])

  function handleNoteChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const value = e.target.value
    setNote(value)
    if (saveTimeout.current) clearTimeout(saveTimeout.current)
    saveTimeout.current = setTimeout(() => saveNote(value), 1000)
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">เป้าหมาย</h1>
      </div>

      {/* Global note */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">บันทึกรวม</h2>
          {noteSaving && <span className="text-[11px] text-muted-foreground">กำลังบันทึก...</span>}
        </div>
        <textarea
          value={note}
          onChange={handleNoteChange}
          placeholder="จดเป้าหมายโดยรวมของการยิงโฆษณา วิธีคิด แนวทาง..."
          rows={5}
          className="w-full text-sm border border-border rounded-lg px-4 py-3 bg-background resize-y focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      {/* Per-campaign goals */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          เป้าหมายรายแคมเปญ
          <span className="ml-2 font-normal">· {campaigns.length} แคมเปญที่ active</span>
        </h2>
        {campaigns.length === 0 ? (
          <p className="text-sm text-muted-foreground">ไม่มีแคมเปญที่กำลังทำงานอยู่</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {campaigns.map(c => (
              <CampaignGoalCard
                key={c.id}
                campaign={c}
                onSaved={() => router.refresh()}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Run tests**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/app/goals/
git commit -m "feat: goals page client component with pace bar"
```

---

### Task 6: Add Nav Link

**Files:**
- Modify: `src/components/nav.tsx`

- [ ] **Step 1: Add link**

In `src/components/nav.tsx`, add `{ href: '/goals', label: 'เป้าหมาย' }` to the `links` array, between Campaigns and Wallet:

```typescript
const links = [
  { href: '/', label: 'Dashboard' },
  { href: '/campaigns', label: 'Campaigns' },
  { href: '/goals', label: 'เป้าหมาย' },
  { href: '/wallet', label: 'Wallet' },
  { href: '/conversions', label: 'Conversions' },
  { href: '/settings', label: 'Settings' },
]
```

Also add the active check for `/goals` in the `isActive` function:

```typescript
function isActive(href: string) {
  if (href === '/campaigns') return pathname.startsWith('/campaigns')
  if (href === '/conversions') return pathname.startsWith('/conversions')
  if (href === '/goals') return pathname.startsWith('/goals')
  return pathname === href
}
```

- [ ] **Step 2: Run tests**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/components/nav.tsx
git commit -m "feat: add เป้าหมาย nav link"
```

---

### Task 7: Update Export/Import

**Files:**
- Modify: `src/lib/export.ts`

- [ ] **Step 1: Update ExportData interface**

In `src/lib/export.ts`, add `globalGoal` to the `ExportData` interface:

```typescript
export interface ExportData {
  version: number
  exportedAt: string
  globalGoal?: { note: string | null } | null
  walletDeposits?: any[]
  campaignAllocations?: any[]
  walletBalanceTon?: string
  campaigns: any[]
  dailyConversions?: any[]
  campaignChangeLogs?: any[]
}
```

- [ ] **Step 2: Update exportData to include GlobalGoal and campaign goal fields**

In `exportData()`, add `globalGoal` fetch to the `Promise.all`:

```typescript
const [campaigns, walletDeposits, campaignAllocations, dailyConversions, campaignChangeLogs, globalGoal] =
  await Promise.all([
    prisma.campaign.findMany({
      include: { entries: { orderBy: { date: 'asc' } } },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.walletDeposit.findMany({ orderBy: { depositedAt: 'asc' } }),
    prisma.campaignAllocation.findMany(),
    prisma.dailyConversion.findMany({ orderBy: { date: 'asc' } }),
    prisma.campaignChangeLog.findMany({ orderBy: { changedAt: 'asc' } }),
    prisma.globalGoal.findUnique({ where: { id: 1 } }),
  ])
```

Add `globalGoal` to the return object:

```typescript
return {
  version: 2,
  exportedAt: new Date().toISOString(),
  globalGoal: globalGoal ? { note: globalGoal.note } : null,
  // ... rest unchanged
}
```

In the campaigns mapping, add the 4 goal fields:

```typescript
campaigns: campaigns.map(c => ({
  // ... existing fields ...
  goalText: c.goalText ?? null,
  planText: c.planText ?? null,
  targetJoins: c.targetJoins ?? null,
  targetDate: c.targetDate?.toISOString() ?? null,
  // ... entries mapping
})),
```

- [ ] **Step 3: Update importData to restore GlobalGoal and campaign goal fields**

In `importData()`, add GlobalGoal restore before campaign loop:

```typescript
// Add GlobalGoal delete at start of transaction (before campaigns):
await tx.globalGoal.deleteMany()

// After the campaign loop, restore GlobalGoal:
if (data.globalGoal) {
  await tx.globalGoal.upsert({
    where: { id: 1 },
    create: { id: 1, note: data.globalGoal.note ?? null },
    update: { note: data.globalGoal.note ?? null },
  })
}
```

In the campaign create loop, add goal fields:

```typescript
await tx.campaign.create({
  data: {
    // ... existing fields ...
    goalText: c.goalText ?? null,
    planText: c.planText ?? null,
    targetJoins: c.targetJoins ?? null,
    targetDate: c.targetDate ? new Date(c.targetDate) : null,
    entries: { create: c.entries.map(...) },
  },
})
```

- [ ] **Step 4: Run tests**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/export.ts
git commit -m "feat: include goal fields and GlobalGoal in backup export/import"
```

---

### Task 8: Smoke Test

- [ ] **Step 1: Build check**

```bash
npm run build 2>&1 | tail -20
```

Expected: build succeeds with no type errors.

- [ ] **Step 2: Start dev server and navigate**

```bash
npm run dev
```

Open `http://localhost:3000/goals` and verify:
1. Page loads — global note textarea appears
2. Type something in global note → wait 1 second → "กำลังบันทึก..." flashes
3. Reload page → note persists
4. For a campaign card, click ✏️ → form opens with all 4 fields
5. Fill in goalText, planText, targetJoins, targetDate → click บันทึก
6. Card closes and shows entered data + progress bar
7. Campaign with only goalText (no targetJoins) shows no bar
8. Nav shows "เป้าหมาย" link that highlights when on `/goals`

- [ ] **Step 3: Final commit**

```bash
npm test
git add -A
git commit -m "chore: verify goals page smoke test complete"
```

---

## Self-Review

**Spec coverage:**
- ✅ Global note — GlobalGoal singleton, auto-save on change
- ✅ Per-campaign: goalText, planText, targetJoins, targetDate
- ✅ Progress bar with linear pace formula
- ✅ Pace marker (vertical line) on bar
- ✅ CANCELLED/DONE filtered out of goals page
- ✅ Nav link "เป้าหมาย"
- ✅ Export/Import includes all new data
- ✅ Goal fields NOT logged in changelog

**Placeholder scan:** None found.

**Type consistency:**
- `CampaignGoal` interface in `goals-client.tsx` matches data shape from `page.tsx`
- `targetDate` passed as ISO string from server, sliced to `YYYY-MM-DD` for `<input type="date">`
- `daysBetween` returns 0 minimum (safe for campaigns not yet started)
