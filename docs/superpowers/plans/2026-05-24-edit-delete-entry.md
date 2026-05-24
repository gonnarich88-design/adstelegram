# Edit & Delete PerformanceEntry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ให้ผู้ใช้แก้ไขและลบ PerformanceEntry ที่บันทึกไปแล้วได้

**Architecture:** เพิ่ม PATCH + DELETE API route ใหม่, สร้าง edit page แบบ dedicated (pattern เดิมกับ Campaign edit), reuse EntryForm ด้วย edit mode props, เพิ่ม action buttons ใน PerformanceTable

**Tech Stack:** Next.js 16 App Router, Prisma 6, Vitest, lucide-react, Tailwind CSS

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| CREATE | `src/app/api/campaigns/[id]/entries/[entryId]/route.ts` | PATCH + DELETE handlers |
| CREATE | `src/app/campaigns/[id]/entries/[entryId]/edit/page.tsx` | Edit page (Server Component) |
| MODIFY | `src/components/entry-form.tsx` | เพิ่ม `entry?` + `entryId?` props สำหรับ edit mode |
| MODIFY | `src/components/performance-table.tsx` | เพิ่ม `campaignId` prop + edit/delete buttons |
| MODIFY | `src/app/campaigns/[id]/page.tsx` | ส่ง `campaignId` ลง `<PerformanceTable>` |
| CREATE | `tests/entries-route.test.ts` | Unit tests สำหรับ PATCH + DELETE |
| MODIFY | `docs/PROGRESS.md` | อัปเดต progress |

---

## Task 1: API Route — PATCH + DELETE

**Files:**
- Create: `tests/entries-route.test.ts`
- Create: `src/app/api/campaigns/[id]/entries/[entryId]/route.ts`

### Step 1.1 — เขียน failing tests

- [ ] สร้างไฟล์ `tests/entries-route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockFindUnique = vi.fn()
const mockUpdate = vi.fn()
const mockDelete = vi.fn()

vi.mock('@/lib/prisma', () => ({
  prisma: {
    performanceEntry: {
      findUnique: mockFindUnique,
      update: mockUpdate,
      delete: mockDelete,
    },
  },
}))

const VALID_BODY = {
  date: '2026-05-21',
  spendTon: 8.5,
  dailyBudgetTon: 10,
  tonPriceUsd: 3.18,
  usdThbRate: 32.45,
  impressions: 0,
  views: 9800,
  clicks: 384,
  joins: 69,
  note: null,
}

function makeReq(method: string, body?: object) {
  return new NextRequest('http://localhost/api/campaigns/c1/entries/e1', {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('PATCH /api/campaigns/[id]/entries/[entryId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 404 when entry not found', async () => {
    mockFindUnique.mockResolvedValue(null)
    const { PATCH } = await import('@/app/api/campaigns/[id]/entries/[entryId]/route')
    const res = await PATCH(makeReq('PATCH', VALID_BODY), {
      params: Promise.resolve({ id: 'c1', entryId: 'e1' }),
    })
    expect(res.status).toBe(404)
  })

  it('returns 404 when entry belongs to different campaign', async () => {
    mockFindUnique.mockResolvedValue({ id: 'e1', campaignId: 'other' })
    const { PATCH } = await import('@/app/api/campaigns/[id]/entries/[entryId]/route')
    const res = await PATCH(makeReq('PATCH', VALID_BODY), {
      params: Promise.resolve({ id: 'c1', entryId: 'e1' }),
    })
    expect(res.status).toBe(404)
  })

  it('returns 400 when required fields missing', async () => {
    mockFindUnique.mockResolvedValue({ id: 'e1', campaignId: 'c1' })
    const { PATCH } = await import('@/app/api/campaigns/[id]/entries/[entryId]/route')
    const res = await PATCH(makeReq('PATCH', { date: '2026-05-21' }), {
      params: Promise.resolve({ id: 'c1', entryId: 'e1' }),
    })
    expect(res.status).toBe(400)
  })

  it('updates entry and returns 200 on success', async () => {
    mockFindUnique.mockResolvedValue({ id: 'e1', campaignId: 'c1' })
    mockUpdate.mockResolvedValue({ id: 'e1', ...VALID_BODY })
    const { PATCH } = await import('@/app/api/campaigns/[id]/entries/[entryId]/route')
    const res = await PATCH(makeReq('PATCH', VALID_BODY), {
      params: Promise.resolve({ id: 'c1', entryId: 'e1' }),
    })
    expect(res.status).toBe(200)
    expect(mockUpdate).toHaveBeenCalledOnce()
  })
})

describe('DELETE /api/campaigns/[id]/entries/[entryId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 404 when entry not found', async () => {
    mockFindUnique.mockResolvedValue(null)
    const { DELETE } = await import('@/app/api/campaigns/[id]/entries/[entryId]/route')
    const res = await DELETE(makeReq('DELETE'), {
      params: Promise.resolve({ id: 'c1', entryId: 'e1' }),
    })
    expect(res.status).toBe(404)
  })

  it('returns 404 when entry belongs to different campaign', async () => {
    mockFindUnique.mockResolvedValue({ id: 'e1', campaignId: 'other' })
    const { DELETE } = await import('@/app/api/campaigns/[id]/entries/[entryId]/route')
    const res = await DELETE(makeReq('DELETE'), {
      params: Promise.resolve({ id: 'c1', entryId: 'e1' }),
    })
    expect(res.status).toBe(404)
  })

  it('deletes entry and returns 204 on success', async () => {
    mockFindUnique.mockResolvedValue({ id: 'e1', campaignId: 'c1' })
    mockDelete.mockResolvedValue({})
    const { DELETE } = await import('@/app/api/campaigns/[id]/entries/[entryId]/route')
    const res = await DELETE(makeReq('DELETE'), {
      params: Promise.resolve({ id: 'c1', entryId: 'e1' }),
    })
    expect(res.status).toBe(204)
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: 'e1' } })
  })
})
```

### Step 1.2 — รัน tests เพื่อยืนยันว่า fail

- [ ] รัน: `npm test -- tests/entries-route.test.ts`
- Expected: FAIL — `Cannot find module '@/app/api/campaigns/[id]/entries/[entryId]/route'`

### Step 1.3 — สร้าง API route

- [ ] สร้างไฟล์ `src/app/api/campaigns/[id]/entries/[entryId]/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

async function getOwned(entryId: string, campaignId: string) {
  const entry = await prisma.performanceEntry.findUnique({ where: { id: entryId } })
  if (!entry || entry.campaignId !== campaignId) return null
  return entry
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; entryId: string }> }
) {
  try {
    const { id, entryId } = await params
    const existing = await getOwned(entryId, id)
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const body = await req.json()
    if (
      !body.date ||
      body.spendTon == null ||
      body.dailyBudgetTon == null ||
      body.tonPriceUsd == null ||
      body.usdThbRate == null ||
      body.views == null ||
      body.clicks == null ||
      body.joins == null
    ) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const updated = await prisma.performanceEntry.update({
      where: { id: entryId },
      data: {
        date: new Date(body.date),
        spendTon: body.spendTon,
        dailyBudgetTon: body.dailyBudgetTon,
        tonPriceUsd: body.tonPriceUsd,
        usdThbRate: body.usdThbRate,
        impressions: Number(body.impressions ?? 0),
        views: Number(body.views),
        clicks: Number(body.clicks),
        joins: Number(body.joins),
        note: body.note ?? null,
      },
    })
    return NextResponse.json(updated)
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; entryId: string }> }
) {
  try {
    const { id, entryId } = await params
    const existing = await getOwned(entryId, id)
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await prisma.performanceEntry.delete({ where: { id: entryId } })
    return new NextResponse(null, { status: 204 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

### Step 1.4 — รัน tests เพื่อยืนยันว่า pass

- [ ] รัน: `npm test`
- Expected: ผ่านทั้งหมด (17 tests เดิม + 7 tests ใหม่ = 24 tests)

### Step 1.5 — Commit

- [ ] Commit:
```bash
git add src/app/api/campaigns/\[id\]/entries/\[entryId\]/route.ts tests/entries-route.test.ts
git commit -m "feat: add PATCH + DELETE API for PerformanceEntry"
```

---

## Task 2: Edit Page (Server Component)

**Files:**
- Create: `src/app/campaigns/[id]/entries/[entryId]/edit/page.tsx`

### Step 2.1 — สร้าง edit page

- [ ] สร้างไฟล์ `src/app/campaigns/[id]/entries/[entryId]/edit/page.tsx`:

```tsx
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { EntryForm } from '@/components/entry-form'

export const dynamic = 'force-dynamic'

export default async function EditEntryPage({
  params,
}: {
  params: Promise<{ id: string; entryId: string }>
}) {
  const { id, entryId } = await params

  const [entry, campaign] = await Promise.all([
    prisma.performanceEntry.findUnique({ where: { id: entryId } }),
    prisma.campaign.findUnique({ where: { id } }),
  ])

  if (!entry || !campaign || entry.campaignId !== id) notFound()

  const serialized = {
    date: entry.date.toISOString(),
    spendTon: Number(entry.spendTon),
    dailyBudgetTon: Number(entry.dailyBudgetTon),
    tonPriceUsd: Number(entry.tonPriceUsd),
    usdThbRate: Number(entry.usdThbRate),
    impressions: entry.impressions,
    views: entry.views,
    clicks: entry.clicks,
    joins: entry.joins,
    note: entry.note,
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">แก้ไข Entry</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {campaign.name} ·{' '}
          {new Date(entry.date).toLocaleDateString('th-TH', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </p>
      </div>
      <EntryForm
        campaignId={id}
        targetType={campaign.targetType}
        defaultDailyBudget={String(Number(campaign.dailyBudgetTon))}
        entry={serialized}
        entryId={entryId}
      />
    </div>
  )
}
```

### Step 2.2 — Commit

- [ ] Commit:
```bash
git add src/app/campaigns/\[id\]/entries/\[entryId\]/edit/page.tsx
git commit -m "feat: add edit entry page"
```

---

## Task 3: EntryForm — Edit Mode

**Files:**
- Modify: `src/components/entry-form.tsx`

### Step 3.1 — เพิ่ม props และปรับ logic

- [ ] แก้ไข `src/components/entry-form.tsx` — เปลี่ยน props signature และ state initialization:

เปลี่ยน:
```tsx
export function EntryForm({ campaignId, targetType, defaultDailyBudget }: {
  campaignId: string
  targetType: string
  defaultDailyBudget?: string
})
```

เป็น:
```tsx
export function EntryForm({ campaignId, targetType, defaultDailyBudget, entry, entryId }: {
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
})
```

### Step 3.2 — ปรับ initial state

- [ ] เปลี่ยน `useState` ของ `form` จาก:
```tsx
const [form, setForm] = useState({
  date: today,
  dailyBudgetTon: defaultDailyBudget ?? '',
  spendTon: '',
  tonPriceUsd: '',
  usdThbRate: '',
  views: '',
  clicks: '',
  joins: '',
  note: '',
})
```

เป็น:
```tsx
// entry.date คือ ISO string จาก server (.toISOString())
// ใช้ .slice(0, 10) ได้ปลอดภัยเพราะเป็น UTC midnight — ไม่มี timezone shift
const [form, setForm] = useState({
  date: entry ? entry.date.slice(0, 10) : today,
  dailyBudgetTon: entry ? String(entry.dailyBudgetTon) : (defaultDailyBudget ?? ''),
  spendTon: entry ? String(entry.spendTon) : '',
  tonPriceUsd: entry ? String(entry.tonPriceUsd) : '',
  usdThbRate: entry ? String(entry.usdThbRate) : '',
  views: entry ? String(entry.views) : '',
  clicks: entry ? String(entry.clicks) : '',
  joins: entry ? String(entry.joins) : '',
  note: entry?.note ?? '',
})
```

### Step 3.3 — ปรับ useEffect ไม่ให้ auto-fetch ใน edit mode

- [ ] เปลี่ยน:
```tsx
useEffect(() => { fetchRates() }, [fetchRates])
```

เป็น:
```tsx
useEffect(() => { if (!entry) fetchRates() }, [fetchRates, entry])
```

### Step 3.4 — ปรับ handleSubmit ให้ใช้ PATCH ใน edit mode

- [ ] เปลี่ยนส่วน fetch ใน `handleSubmit` จาก:
```tsx
const res = await fetch(`/api/campaigns/${campaignId}/entries`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({...}),
})
```

เป็น:
```tsx
const url = entryId
  ? `/api/campaigns/${campaignId}/entries/${entryId}`
  : `/api/campaigns/${campaignId}/entries`
const res = await fetch(url, {
  method: entryId ? 'PATCH' : 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    date: form.date,
    dailyBudgetTon: parseFloat(form.dailyBudgetTon),
    spendTon: parseFloat(form.spendTon),
    tonPriceUsd: parseFloat(form.tonPriceUsd),
    usdThbRate: parseFloat(form.usdThbRate),
    impressions: 0,
    views: parseInt(form.views),
    clicks: parseInt(form.clicks),
    joins: parseInt(form.joins),
    note: form.note || null,
  }),
})
```

### Step 3.5 — ปรับ submit button label

- [ ] เปลี่ยน button label เพื่อให้รู้ว่าอยู่ใน mode ไหน:
```tsx
{loading ? 'กำลังบันทึก...' : entryId ? 'บันทึกการแก้ไข' : 'บันทึก Entry'}
```

### Step 3.6 — Commit

- [ ] รัน: `npm test` — ต้องผ่านทั้งหมด (24 tests)
- [ ] Commit:
```bash
git add src/components/entry-form.tsx
git commit -m "feat: add edit mode to EntryForm (entry + entryId props)"
```

---

## Task 4: PerformanceTable — Edit/Delete Buttons

**Files:**
- Modify: `src/components/performance-table.tsx`
- Modify: `src/app/campaigns/[id]/page.tsx`

### Step 4.1 — เพิ่ม imports ใน performance-table.tsx

- [ ] เพิ่ม imports ที่บรรทัดต้นของ `src/components/performance-table.tsx`:

```tsx
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Pencil, Trash2 } from 'lucide-react'
```

### Step 4.2 — เพิ่ม `campaignId` prop

- [ ] เปลี่ยน signature ของ `PerformanceTable` จาก:
```tsx
export function PerformanceTable({ entries, targetType, campaignDailyBudget = 0 }: {
  entries: any[]
  targetType?: string
  campaignDailyBudget?: number
})
```

เป็น:
```tsx
export function PerformanceTable({ entries, targetType, campaignDailyBudget = 0, campaignId }: {
  entries: any[]
  targetType?: string
  campaignDailyBudget?: number
  campaignId: string
})
```

### Step 4.3 — เพิ่ม state สำหรับ delete

**หมายเหตุ:** ต้องวาง hooks ใหม่ทั้งหมด **ก่อน** `if (entries.length === 0) return ...` เพราะ React Rules of Hooks ห้ามเรียก hook หลัง conditional return

- [ ] เพิ่มหลัง `const joinsLabel = ...` (ก่อน early return):
```tsx
const router = useRouter()
const [deletingId, setDeletingId] = useState<string | null>(null)
const [deleteError, setDeleteError] = useState('')

async function handleDelete(entryId: string, dateStr: string) {
  const label = new Date(dateStr).toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
  if (!window.confirm(`ลบ entry วันที่ ${label}?`)) return

  setDeletingId(entryId)
  setDeleteError('')
  try {
    const res = await fetch(`/api/campaigns/${campaignId}/entries/${entryId}`, {
      method: 'DELETE',
    })
    if (res.ok) {
      router.refresh()
    } else {
      setDeleteError('ลบไม่สำเร็จ ลองใหม่อีกครั้ง')
    }
  } catch {
    setDeleteError('ลบไม่สำเร็จ ลองใหม่อีกครั้ง')
  } finally {
    setDeletingId(null)
  }
}
```

### Step 4.4 — เพิ่ม column header ใน `<thead>`

- [ ] เพิ่ม `<th>` สุดท้ายใน header row ของตาราง (หลัง `<th>BSP</th>`):
```tsx
<th className="py-2 px-2 pr-4 w-16"></th>
```

### Step 4.5 — เพิ่ม action buttons ในแต่ละ data row

- [ ] เพิ่ม `<td>` สุดท้ายใน data row ของตาราง (หลัง `<td>` ของ BSP):
```tsx
<td className="py-1.5 px-2 pr-4">
  <div className="flex items-center gap-1 justify-end">
    <Link
      href={`/campaigns/${campaignId}/entries/${e.id}/edit`}
      className="p-1 rounded hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
    >
      <Pencil size={13} />
    </Link>
    <button
      type="button"
      onClick={() => handleDelete(e.id, e.date)}
      disabled={deletingId === e.id}
      className="p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-40"
    >
      <Trash2 size={13} />
    </button>
  </div>
</td>
```

### Step 4.6 — เพิ่ม empty `<td>` ใน summary row "รวมเดือน"

- [ ] เพิ่ม `<td>` ว่างสุดท้ายใน summary row (หลัง `<td>` ของ BSP ใน summary):
```tsx
<td />
```

### Step 4.7 — แสดง deleteError ใต้ตาราง

- [ ] เพิ่มภายใน `<div className="space-y-2">` หลัง `{months.map(...)}`:
```tsx
{deleteError && (
  <p className="text-sm text-destructive mt-2">{deleteError}</p>
)}
```

### Step 4.8 — ส่ง campaignId จาก campaign detail page

- [ ] แก้ไข `src/app/campaigns/[id]/page.tsx` บรรทัดที่ render `<PerformanceTable>`:

เปลี่ยน:
```tsx
<PerformanceTable entries={serializedEntries} targetType={campaign.targetType} campaignDailyBudget={campaignDailyBudget} />
```

เป็น:
```tsx
<PerformanceTable entries={serializedEntries} targetType={campaign.targetType} campaignDailyBudget={campaignDailyBudget} campaignId={id} />
```

### Step 4.9 — รัน tests และ commit

- [ ] รัน: `npm test` — ต้องผ่านทั้งหมด (24 tests)
- [ ] Commit:
```bash
git add src/components/performance-table.tsx src/app/campaigns/\[id\]/page.tsx
git commit -m "feat: add edit/delete buttons to PerformanceTable"
```

---

## Task 5: ตรวจสอบและ PROGRESS.md

### Step 5.1 — ตรวจสอบ TypeScript

- [ ] รัน: `npx tsc --noEmit`
- Expected: ไม่มี error

### Step 5.2 — รัน test suite สุดท้าย

- [ ] รัน: `npm test`
- Expected: ผ่านทั้งหมด 24 tests

### Step 5.3 — อัปเดต PROGRESS.md

- [ ] เพิ่มใน section "เสร็จแล้ว":
```
- [x] Edit + Delete PerformanceEntry — edit page `/entries/[id]/edit`, PATCH + DELETE API, action buttons ใน PerformanceTable
```

- [ ] ลบออกจาก "ขั้นตอนถัดไป" ถ้ามี

### Step 5.4 — Commit สุดท้าย

- [ ] Commit:
```bash
git add docs/PROGRESS.md
git commit -m "docs: update PROGRESS.md — edit/delete entry complete"
```

---

## Success Criteria

- [ ] แก้ไข entry ที่มีอยู่ได้ครบทุก field — form pre-fill ถูกต้อง
- [ ] ลบ entry ได้ พร้อม confirm dialog ระบุวันที่ภาษาไทย
- [ ] URL manipulation (`/entries/อื่น/edit` ใน campaign อื่น) → 404
- [ ] ปุ่ม delete disabled ระหว่าง fetch + แสดง error ถ้าล้มเหลว
- [ ] ผ่าน `npm test` ทั้งหมด (17 tests เดิม + 7 tests ใหม่)
- [ ] `npx tsc --noEmit` ไม่มี error
