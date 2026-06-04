# Campaign List Edit Button Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เพิ่มปุ่ม pencil icon ท้ายแต่ละ campaign row บนหน้า `/campaigns` เพื่อให้ navigate ไปหน้า edit ได้เลย โดยไม่ต้องผ่านหน้า detail ก่อน

**Architecture:** แก้ `CampaignRow` ให้ outer container เป็น `div` แทน `Link` แล้วแยก content area เป็น `Link` ไปหน้า detail, เพิ่ม `Link` ปุ่ม edit แยกต่างหากท้ายแถว — ไม่มี nested `<a>` ใน `<a>`

**Tech Stack:** Next.js App Router, React, Tailwind CSS, lucide-react

---

### Task 1: Refactor CampaignRow — แยก outer container ออกจาก Link

**Files:**
- Modify: `src/components/campaign-row.tsx`

บริบท: ปัจจุบัน `CampaignRow` คือ `<Link href="/campaigns/[id]">` ครอบทั้ง row เราต้องเปลี่ยนให้ outer container เป็น `div` แล้วให้ content area เป็น `<Link flex-1>` แทน จากนั้นเพิ่ม `<Link>` ปุ่ม edit แยก

- [ ] **Step 1: เปิดไฟล์ `src/components/campaign-row.tsx` และทำความเข้าใจโครงสร้างปัจจุบัน**

โครงสร้างปัจจุบัน (ย่อ):
```tsx
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { calcAggregateMetrics } from '@/lib/metrics'
import { ChevronRight } from 'lucide-react'
// ...
export function CampaignRow({ campaign }: { campaign: any }) {
  // ...
  return (
    <Link
      href={`/campaigns/${campaign.id}`}
      className="flex items-center gap-4 px-4 py-3 rounded-lg border border-border hover:bg-muted/30 transition-colors group"
    >
      {/* Left: name + meta */}
      <div className="flex-1 min-w-0">...</div>
      {/* Right: metrics */}
      <div className="flex items-center gap-3 shrink-0">
        ...
        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </Link>
  )
}
```

- [ ] **Step 2: แก้ไข `campaign-row.tsx` ให้ตรงกับ code ด้านล่างนี้ทั้งหมด**

```tsx
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { calcAggregateMetrics } from '@/lib/metrics'
import { ChevronRight, Pencil } from 'lucide-react'

const STATUS_CLASS: Record<string, string> = {
  ACTIVE: 'bg-green-600 text-white hover:bg-green-600',
  PAUSED: 'bg-secondary text-secondary-foreground hover:bg-secondary',
  STOPPED: 'bg-yellow-500 text-black hover:bg-yellow-500',
  DONE: 'border border-border bg-transparent text-foreground',
  CANCELLED: 'bg-destructive text-white hover:bg-destructive',
}

function bspColor(bsp: number): string {
  const pct = Math.min(bsp, 100) / 100
  return `hsl(${Math.round(pct * 120)} 72% 51%)`
}

function n(v: number, d = 0) {
  return v.toLocaleString('th-TH', { maximumFractionDigits: d })
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="text-center" style={{ minWidth: 52 }}>
      <div className="text-[10px] text-muted-foreground leading-none mb-1">{label}</div>
      <div className="text-xs font-medium leading-none" style={color ? { color } : undefined}>
        {value}
      </div>
    </div>
  )
}

export function CampaignRow({ campaign }: { campaign: any }) {
  const dailyBudget = Number(campaign.dailyBudgetTon)

  const metrics =
    campaign.entries.length > 0
      ? calcAggregateMetrics(
          campaign.entries.map((e: any) => ({
            spendTon: Number(e.spendTon),
            dailyBudgetTon: Number(e.dailyBudgetTon) || dailyBudget,
            tonPriceUsd: Number(e.tonPriceUsd),
            usdThbRate: Number(e.usdThbRate),
            impressions: e.impressions,
            views: e.views,
            clicks: e.clicks,
            joins: e.joins,
          }))
        )
      : null

  const joinsLabel = campaign.targetType === 'BOT' ? 'Startbot' : 'Joins'
  const cpsThb = metrics && metrics.totalJoins > 0 ? metrics.spendThb / metrics.totalJoins : null
  const cpmThb =
    metrics && metrics.totalViews > 0 ? (metrics.spendThb / metrics.totalViews) * 1000 : null

  const placementLabel =
    campaign.placementType === 'CHANNEL'
      ? 'Channels'
      : campaign.placementType === 'BOT'
      ? 'Bots'
      : campaign.placementType === 'SEARCH'
      ? 'Search'
      : null

  return (
    <div className="flex items-center rounded-lg border border-border hover:bg-muted/30 transition-colors group">
      {/* Content area → campaign detail */}
      <Link
        href={`/campaigns/${campaign.id}`}
        className="flex items-center gap-4 px-4 py-3 flex-1 min-w-0"
      >
        {/* Left: name + meta */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm truncate">{campaign.name}</span>
            <Badge className={`${STATUS_CLASS[campaign.status] ?? ''} text-[10px] px-1.5 py-0 h-4 shrink-0`}>
              {campaign.status}
            </Badge>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <span className="text-[11px] text-muted-foreground truncate">
              {campaign.targetType} · {campaign.targetName}
              {placementLabel && ` · ${placementLabel}`}
              {campaign.entries.length > 0 && ` · ${campaign.entries.length} วัน`}
            </span>
            {campaign.bidCpmTon != null && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                Bid {Number(campaign.bidCpmTon).toFixed(2)} TON
              </span>
            )}
          </div>
        </div>

        {/* Right: metrics */}
        <div className="flex items-center gap-3 shrink-0">
          <Stat label="Views" value={metrics ? n(metrics.totalViews) : '—'} />
          <Stat label="Clicks" value={metrics ? n(metrics.totalClicks) : '—'} />
          <Stat label={joinsLabel} value={metrics ? n(metrics.totalJoins) : '—'} />
          <Stat label="CPM ฿" value={cpmThb !== null ? `฿${n(cpmThb, 1)}` : '—'} />
          <Stat label="CTR" value={metrics ? `${n(metrics.ctr, 2)}%` : '—'} />
          <Stat label="CPS ฿" value={cpsThb !== null ? `฿${n(cpsThb, 0)}` : '—'} />
          <Stat label="Spend ฿" value={metrics ? `฿${n(metrics.spendThb, 0)}` : '—'} />
          {metrics ? (
            <div className="text-center" style={{ minWidth: 52 }}>
              <div className="text-[10px] text-muted-foreground leading-none mb-1">BSP</div>
              <div
                className="text-xs font-medium leading-none"
                style={{ color: bspColor(metrics.bsp) }}
              >
                {n(metrics.bsp, 1)}%
              </div>
            </div>
          ) : (
            <Stat label="BSP" value="—" />
          )}
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </Link>

      {/* Edit button → campaign edit page */}
      <Link
        href={`/campaigns/${campaign.id}/edit`}
        className="flex items-center justify-center w-8 h-8 mr-2 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
        aria-label="แก้ไข campaign"
      >
        <Pencil className="w-3.5 h-3.5" />
      </Link>
    </div>
  )
}
```

**สิ่งที่เปลี่ยน:**
- outer container: `<Link>` → `<div>` (รับ `rounded-lg border hover:bg-muted/30 group`)
- content area: `<Link flex-1>` ครอบ name+meta+metrics+chevron
- เพิ่ม `<Link>` ปุ่ม pencil ท้าย row (outside content link)
- import เพิ่ม `Pencil` จาก lucide-react

- [ ] **Step 3: รัน tests**

```bash
npm test
```

Expected output: ผ่านทุก test (ไม่มี unit test สำหรับ UI component นี้ — 44 tests pass)

```
Test Files  4 passed (4)
Tests       44 passed (44)
```

- [ ] **Step 4: ตรวจสอบใน browser**

```bash
npm run dev
```

เปิด http://localhost:3000/campaigns แล้วตรวจ:
1. คลิกที่ชื่อ/metrics ของ campaign row → ไปหน้า detail (`/campaigns/[id]`) ✅
2. คลิกปุ่ม pencil icon ท้ายแถว → ไปหน้า edit (`/campaigns/[id]/edit`) ✅
3. ปุ่ม pencil แสดงทุก campaign รวม CANCELLED ✅
4. hover บน row → พื้นหลัง muted/30 เปลี่ยนสีทั้งแถว ✅
5. sort buttons (▲▼) ยังทำงานได้ปกติ ✅

- [ ] **Step 5: Commit**

```bash
git add src/components/campaign-row.tsx
git commit -m "feat: add edit button to campaign row on campaigns list"
```
