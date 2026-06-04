# AI Analysis Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เพิ่มหน้า `/analysis` ให้ผู้ใช้กดปุ่มเพื่อให้ GPT-4o วิเคราะห์ประสิทธิภาพแคมเปญและสร้างแผนปฏิบัติ 3 ระดับ

**Architecture:** หน้า Server Component ดึง analysis ล่าสุดจาก DB → ส่งไป Client Component ที่มีปุ่มกด trigger `POST /api/analysis` → route handler ดึงข้อมูลจาก DB, สร้าง prompt, เรียก OpenAI fetch, parse JSON, persist ลง `AiAnalysis` table, return ผล → Client อัปเดต UI inline โดยไม่ reload

**Tech Stack:** Next.js 16 App Router, Prisma 6, OpenAI API (fetch ตรง, ไม่ใช้ SDK), Tailwind CSS, shadcn/ui, lucide-react, Vitest

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `prisma/schema.prisma` | Modify | เพิ่ม `AnalysisType` enum + `AiAnalysis` model + `analyses` relation บน Campaign |
| `prisma/migrations/` | Create | migration `add_ai_analysis` |
| `src/lib/analysis.ts` | Create | Types + pure functions: `buildOverviewPrompt`, `buildCampaignPrompt`, `parseAnalysisResult` |
| `tests/analysis.test.ts` | Create | Unit tests สำหรับ lib/analysis.ts (10 tests) |
| `src/app/api/analysis/route.ts` | Create | POST handler: ดึง DB, สร้าง prompt, เรียก OpenAI, persist, return |
| `src/app/analysis/page.tsx` | Create | Server Component: ดึง overview + campaigns + latest analyses |
| `src/app/analysis/analysis-client.tsx` | Create | Client Component: ปุ่ม trigger, loading state, inline expand |
| `src/components/nav.tsx` | Modify | เพิ่ม "วิเคราะห์" link |
| `.env.example` | Modify | เพิ่ม `OPENAI_API_KEY` |

---

## Task 1: Prisma Schema Migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/` (auto-generated)

- [ ] **Step 1: เพิ่ม AnalysisType enum, AiAnalysis model และ analyses relation ใน schema.prisma**

เปิด `prisma/schema.prisma` แล้วแก้ไข:

**เพิ่ม `analyses AiAnalysis[]` ต่อท้าย Campaign model** (หลัง `sortOrder` บรรทัดสุดท้ายก่อน `}`)

```prisma
  sortOrder      Int                  @default(0)
  analyses       AiAnalysis[]
```

**เพิ่มต่อท้ายไฟล์ ต่อจาก DailyConversion:**

```prisma
enum AnalysisType {
  OVERVIEW
  CAMPAIGN
}

model AiAnalysis {
  id         String       @id @default(cuid())
  type       AnalysisType
  campaignId String?
  campaign   Campaign?    @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  result     String
  model      String
  createdAt  DateTime     @default(now())

  @@index([type, campaignId])
}
```

- [ ] **Step 2: Run migration**

```bash
npx prisma migrate dev --name add_ai_analysis
```

Expected output: `Your database is now in sync with your schema.`

- [ ] **Step 3: Regenerate Prisma client**

```bash
npx prisma generate
```

Expected output: `✔ Generated Prisma Client (v6.x.x)`

- [ ] **Step 4: Verify existing tests still pass**

```bash
npm test
```

Expected: ≥44 tests pass, 0 fail

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add AiAnalysis schema for AI analysis feature"
```

---

## Task 2: lib/analysis.ts + Unit Tests

**Files:**
- Create: `src/lib/analysis.ts`
- Create: `tests/analysis.test.ts`

- [ ] **Step 1: Write failing tests first**

Create `tests/analysis.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { buildOverviewPrompt, buildCampaignPrompt, parseAnalysisResult } from '@/lib/analysis'
import type { CampaignSummary, EntryRow } from '@/lib/analysis'

const baseCampaign: CampaignSummary = {
  id: 'c1',
  name: 'Test Bot',
  status: 'ACTIVE',
  targetType: 'BOT',
  dailyBudgetTon: 5,
  totalAllocated: 50,
  totalSpent: 20,
  budgetUsedPct: 40,
  totalJoins: 100,
  avgCPS: 0.0027,
  ctr: 1.5,
  goalText: null,
  planText: null,
  targetJoins: null,
  targetDate: null,
}

describe('buildOverviewPrompt', () => {
  it('includes today date in system message', () => {
    const { system } = buildOverviewPrompt([baseCampaign], null, '2026-06-04')
    expect(system).toContain('2026-06-04')
  })

  it('includes globalNote when provided', () => {
    const { system } = buildOverviewPrompt([baseCampaign], 'เน้น CPS < $0.005', '2026-06-04')
    expect(system).toContain('เน้น CPS < $0.005')
  })

  it('omits globalNote when null', () => {
    const { system } = buildOverviewPrompt([baseCampaign], null, '2026-06-04')
    expect(system).not.toContain('กลยุทธ์ภาพรวม')
  })

  it('includes campaign name and joins in user message', () => {
    const { user } = buildOverviewPrompt([baseCampaign], null, '2026-06-04')
    expect(user).toContain('Test Bot')
    expect(user).toContain('Joins: 100')
  })

  it('includes perCampaign schema hint', () => {
    const { user } = buildOverviewPrompt([baseCampaign], null, '2026-06-04')
    expect(user).toContain('perCampaign')
  })

  it('includes goalText and targetJoins when provided', () => {
    const c = { ...baseCampaign, goalText: 'ได้ 500 joins', targetJoins: 500 }
    const { user } = buildOverviewPrompt([c], null, '2026-06-04')
    expect(user).toContain('ได้ 500 joins')
    expect(user).toContain('500')
  })
})

describe('buildCampaignPrompt', () => {
  const entries: EntryRow[] = [
    { date: '2026-06-01', spendTon: 4.5, views: 9000, clicks: 200, joins: 40 },
    { date: '2026-06-02', spendTon: 5.0, views: 10000, clicks: 220, joins: 45 },
  ]

  it('includes entry dates and joins in user message', () => {
    const { user } = buildCampaignPrompt(baseCampaign, entries, null, '2026-06-04')
    expect(user).toContain('2026-06-01')
    expect(user).toContain('joins=40')
  })

  it('shows ไม่มีข้อมูล when entries empty', () => {
    const { user } = buildCampaignPrompt(baseCampaign, [], null, '2026-06-04')
    expect(user).toContain('ไม่มีข้อมูล')
  })

  it('does not include perCampaign schema hint', () => {
    const { user } = buildCampaignPrompt(baseCampaign, [], null, '2026-06-04')
    expect(user).not.toContain('perCampaign')
  })

  it('includes planText when provided', () => {
    const c = { ...baseCampaign, planText: 'ลด bid ถ้า CTR < 1%' }
    const { user } = buildCampaignPrompt(c, [], null, '2026-06-04')
    expect(user).toContain('ลด bid ถ้า CTR < 1%')
  })
})

describe('parseAnalysisResult', () => {
  it('parses valid result correctly', () => {
    const json = JSON.stringify({
      status: 'ดี',
      immediate: ['ทำ X'],
      weekly: ['ทำ Y'],
      monthly: ['ทำ Z'],
      assumptions: [],
    })
    const result = parseAnalysisResult(json)
    expect(result.status).toBe('ดี')
    expect(result.immediate).toEqual(['ทำ X'])
    expect(result.monthly).toEqual(['ทำ Z'])
  })

  it('throws on invalid JSON', () => {
    expect(() => parseAnalysisResult('not-json')).toThrow()
  })

  it('throws on missing required fields', () => {
    const json = JSON.stringify({ status: 'ดี' })
    expect(() => parseAnalysisResult(json)).toThrow('Invalid analysis result structure')
  })

  it('preserves optional perCampaign array', () => {
    const json = JSON.stringify({
      status: 'ดี',
      immediate: [],
      weekly: [],
      monthly: [],
      assumptions: [],
      perCampaign: [{ campaignId: 'c1', name: 'Bot', status: 'ดีมาก', highlight: 'CTR ดี' }],
    })
    const result = parseAnalysisResult(json)
    expect(result.perCampaign).toHaveLength(1)
    expect(result.perCampaign![0].status).toBe('ดีมาก')
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test tests/analysis.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/analysis'`

- [ ] **Step 3: Implement lib/analysis.ts**

Create `src/lib/analysis.ts`:

```typescript
export interface CampaignSummary {
  id: string
  name: string
  status: string
  targetType: string
  dailyBudgetTon: number
  totalAllocated: number
  totalSpent: number
  budgetUsedPct: number
  totalJoins: number
  avgCPS: number
  ctr: number
  goalText: string | null
  planText: string | null
  targetJoins: number | null
  targetDate: string | null
}

export interface EntryRow {
  date: string
  spendTon: number
  views: number
  clicks: number
  joins: number
}

export interface AnalysisResult {
  status: string
  immediate: string[]
  weekly: string[]
  monthly: string[]
  assumptions: string[]
  perCampaign?: {
    campaignId: string
    name: string
    status: string
    highlight: string
  }[]
}

interface PromptMessages {
  system: string
  user: string
}

export function buildOverviewPrompt(
  campaigns: CampaignSummary[],
  globalNote: string | null,
  today: string,
): PromptMessages {
  const systemLines = [
    'คุณเป็นผู้เชี่ยวชาญด้านโฆษณา Telegram Ads',
    'ตอบเป็นภาษาไทยเท่านั้น',
    'ตอบกลับเป็น JSON object เท่านั้น ไม่มีข้อความอื่น',
    `วันที่ปัจจุบัน: ${today} (Asia/Bangkok)`,
  ]
  if (globalNote) systemLines.push(`กลยุทธ์ภาพรวม: ${globalNote}`)

  const campaignLines = campaigns.map(c => {
    const parts = [
      `ชื่อ: ${c.name}`,
      `สถานะ: ${c.status}`,
      `ประเภท: ${c.targetType}`,
      `งบรายวัน: ${c.dailyBudgetTon.toFixed(2)} TON`,
      `จัดสรร: ${c.totalAllocated.toFixed(2)} TON`,
      `ใช้: ${c.totalSpent.toFixed(2)} TON (${c.budgetUsedPct.toFixed(1)}%)`,
      `Joins: ${c.totalJoins}`,
      `CPS: $${c.avgCPS.toFixed(4)}`,
      `CTR: ${c.ctr.toFixed(2)}%`,
    ]
    if (c.goalText) parts.push(`เป้าหมาย: ${c.goalText}`)
    if (c.targetJoins) parts.push(`เป้า Joins: ${c.targetJoins}`)
    if (c.targetDate) parts.push(`วันเป้าหมาย: ${c.targetDate}`)
    return `[ID:${c.id}] ${parts.join(' | ')}`
  }).join('\n')

  const schemaHint = '{"status":"...","immediate":["..."],"weekly":["..."],"monthly":["..."],"assumptions":["..."],"perCampaign":[{"campaignId":"...","name":"...","status":"ดีมาก|ปกติ|ต้องระวัง|วิกฤต","highlight":"..."}]}'

  const user = [
    'วิเคราะห์ภาพรวมแคมเปญโฆษณาต่อไปนี้:',
    '',
    campaignLines,
    '',
    `ตอบกลับ JSON เท่านั้น schema: ${schemaHint}`,
  ].join('\n')

  return { system: systemLines.join('\n'), user }
}

export function buildCampaignPrompt(
  campaign: CampaignSummary,
  entries: EntryRow[],
  globalNote: string | null,
  today: string,
): PromptMessages {
  const systemLines = [
    'คุณเป็นผู้เชี่ยวชาญด้านโฆษณา Telegram Ads',
    'ตอบเป็นภาษาไทยเท่านั้น',
    'ตอบกลับเป็น JSON object เท่านั้น ไม่มีข้อความอื่น',
    `วันที่ปัจจุบัน: ${today} (Asia/Bangkok)`,
  ]
  if (globalNote) systemLines.push(`กลยุทธ์ภาพรวม: ${globalNote}`)

  const infoLines = [
    `ชื่อ: ${campaign.name}`,
    `สถานะ: ${campaign.status}`,
    `ประเภท: ${campaign.targetType}`,
    `งบรายวัน: ${campaign.dailyBudgetTon.toFixed(2)} TON`,
    `จัดสรร: ${campaign.totalAllocated.toFixed(2)} TON`,
    `ใช้: ${campaign.totalSpent.toFixed(2)} TON (${campaign.budgetUsedPct.toFixed(1)}%)`,
    `Joins: ${campaign.totalJoins}`,
    `CPS: $${campaign.avgCPS.toFixed(4)}`,
    `CTR: ${campaign.ctr.toFixed(2)}%`,
  ]
  if (campaign.goalText) infoLines.push(`เป้าหมาย: ${campaign.goalText}`)
  if (campaign.planText) infoLines.push(`แผน: ${campaign.planText}`)
  if (campaign.targetJoins) infoLines.push(`เป้า Joins: ${campaign.targetJoins}`)
  if (campaign.targetDate) infoLines.push(`วันเป้าหมาย: ${campaign.targetDate}`)

  const entryLines = entries
    .slice(-30)
    .map(e => `${e.date}: spend=${e.spendTon.toFixed(3)}TON views=${e.views} clicks=${e.clicks} joins=${e.joins}`)
    .join('\n')

  const schemaHint = '{"status":"...","immediate":["..."],"weekly":["..."],"monthly":["..."],"assumptions":["..."]}'

  const user = [
    'วิเคราะห์แคมเปญนี้แบบเจาะลึก:',
    '',
    infoLines.join('\n'),
    '',
    'ข้อมูลรายวัน 30 วันล่าสุด:',
    entryLines || 'ไม่มีข้อมูล',
    '',
    `ตอบกลับ JSON เท่านั้น ไม่มี perCampaign field: ${schemaHint}`,
  ].join('\n')

  return { system: systemLines.join('\n'), user }
}

export function parseAnalysisResult(content: string): AnalysisResult {
  const parsed = JSON.parse(content)
  if (
    typeof parsed.status !== 'string' ||
    !Array.isArray(parsed.immediate) ||
    !Array.isArray(parsed.weekly) ||
    !Array.isArray(parsed.monthly) ||
    !Array.isArray(parsed.assumptions)
  ) {
    throw new Error('Invalid analysis result structure')
  }
  return parsed as AnalysisResult
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test tests/analysis.test.ts
```

Expected: 10 tests pass, 0 fail

- [ ] **Step 5: Run full test suite to check no regressions**

```bash
npm test
```

Expected: ≥54 tests pass (44 existing + 10 new), 0 fail

- [ ] **Step 6: Commit**

```bash
git add src/lib/analysis.ts tests/analysis.test.ts
git commit -m "feat: add analysis prompt builders and result parser with tests"
```

---

## Task 3: API Route POST /api/analysis

**Files:**
- Create: `src/app/api/analysis/route.ts`

- [ ] **Step 1: Create the API route**

Create `src/app/api/analysis/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { buildOverviewPrompt, buildCampaignPrompt, parseAnalysisResult } from '@/lib/analysis'
import type { CampaignSummary, EntryRow } from '@/lib/analysis'

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'ยังไม่ได้ตั้งค่า API key' }, { status: 500 })
  }

  let body: { type: string; campaignId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { type, campaignId } = body
  if (type !== 'OVERVIEW' && type !== 'CAMPAIGN') {
    return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
  }
  if (type === 'CAMPAIGN' && !campaignId) {
    return NextResponse.json({ error: 'campaignId required for CAMPAIGN type' }, { status: 400 })
  }

  // Thai timezone date string e.g. "2026-06-04"
  const bangkokOffset = 7 * 60 * 60 * 1000
  const today = new Date(Date.now() + bangkokOffset).toISOString().split('T')[0]

  let prompt: { system: string; user: string }

  if (type === 'OVERVIEW') {
    const [globalGoal, campaigns] = await Promise.all([
      prisma.globalGoal.findUnique({ where: { id: 1 } }),
      prisma.campaign.findMany({
        where: { status: { notIn: ['CANCELLED'] } },
        include: {
          entries: { orderBy: { date: 'asc' } },
          allocations: true,
        },
      }),
    ])

    const summaries: CampaignSummary[] = campaigns.map(c => {
      const totalSpent = c.entries.reduce((s, e) => s + Number(e.spendTon), 0)
      const totalJoins = c.entries.reduce((s, e) => s + e.joins, 0)
      const totalSpentUsd = c.entries.reduce((s, e) => s + Number(e.spendTon) * Number(e.tonPriceUsd), 0)
      const totalViews = c.entries.reduce((s, e) => s + e.views, 0)
      const totalClicks = c.entries.reduce((s, e) => s + e.clicks, 0)
      const totalAllocated = c.allocations.reduce((s, a) => s + Number(a.amountTon), 0)
      return {
        id: c.id,
        name: c.name,
        status: c.status,
        targetType: c.targetType,
        dailyBudgetTon: Number(c.dailyBudgetTon),
        totalAllocated,
        totalSpent,
        budgetUsedPct: totalAllocated > 0 ? (totalSpent / totalAllocated) * 100 : 0,
        totalJoins,
        avgCPS: totalJoins > 0 ? totalSpentUsd / totalJoins : 0,
        ctr: totalViews > 0 ? (totalClicks / totalViews) * 100 : 0,
        goalText: c.goalText ?? null,
        planText: c.planText ?? null,
        targetJoins: c.targetJoins ?? null,
        targetDate: c.targetDate?.toISOString().split('T')[0] ?? null,
      }
    })

    prompt = buildOverviewPrompt(summaries, globalGoal?.note ?? null, today)
  } else {
    const [globalGoal, campaign] = await Promise.all([
      prisma.globalGoal.findUnique({ where: { id: 1 } }),
      prisma.campaign.findUnique({
        where: { id: campaignId },
        include: {
          entries: { orderBy: { date: 'asc' } },
          allocations: true,
        },
      }),
    ])

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    const totalSpent = campaign.entries.reduce((s, e) => s + Number(e.spendTon), 0)
    const totalJoins = campaign.entries.reduce((s, e) => s + e.joins, 0)
    const totalSpentUsd = campaign.entries.reduce((s, e) => s + Number(e.spendTon) * Number(e.tonPriceUsd), 0)
    const totalViews = campaign.entries.reduce((s, e) => s + e.views, 0)
    const totalClicks = campaign.entries.reduce((s, e) => s + e.clicks, 0)
    const totalAllocated = campaign.allocations.reduce((s, a) => s + Number(a.amountTon), 0)

    const summary: CampaignSummary = {
      id: campaign.id,
      name: campaign.name,
      status: campaign.status,
      targetType: campaign.targetType,
      dailyBudgetTon: Number(campaign.dailyBudgetTon),
      totalAllocated,
      totalSpent,
      budgetUsedPct: totalAllocated > 0 ? (totalSpent / totalAllocated) * 100 : 0,
      totalJoins,
      avgCPS: totalJoins > 0 ? totalSpentUsd / totalJoins : 0,
      ctr: totalViews > 0 ? (totalClicks / totalViews) * 100 : 0,
      goalText: campaign.goalText ?? null,
      planText: campaign.planText ?? null,
      targetJoins: campaign.targetJoins ?? null,
      targetDate: campaign.targetDate?.toISOString().split('T')[0] ?? null,
    }

    const entryRows: EntryRow[] = campaign.entries.map(e => ({
      date: e.date.toISOString().split('T')[0],
      spendTon: Number(e.spendTon),
      views: e.views,
      clicks: e.clicks,
      joins: e.joins,
    }))

    prompt = buildCampaignPrompt(summary, entryRows, globalGoal?.note ?? null, today)
  }

  let aiResponse: Response
  try {
    aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: prompt.system },
          { role: 'user', content: prompt.user },
        ],
      }),
      cache: 'no-store',
    })
  } catch {
    return NextResponse.json({ error: 'วิเคราะห์ไม่สำเร็จ ลองใหม่อีกครั้ง' }, { status: 502 })
  }

  if (aiResponse.status === 429) {
    return NextResponse.json({ error: 'กรุณารอสักครู่แล้วลองใหม่' }, { status: 429 })
  }
  if (!aiResponse.ok) {
    return NextResponse.json({ error: 'วิเคราะห์ไม่สำเร็จ ลองใหม่อีกครั้ง' }, { status: 502 })
  }

  const aiData = await aiResponse.json()
  const content: string = aiData.choices?.[0]?.message?.content ?? ''

  let result
  try {
    result = parseAnalysisResult(content)
  } catch {
    return NextResponse.json({ error: 'วิเคราะห์ไม่สำเร็จ — ผลลัพธ์ไม่ถูกต้อง' }, { status: 500 })
  }

  const analysis = await prisma.aiAnalysis.create({
    data: {
      type: type as 'OVERVIEW' | 'CAMPAIGN',
      campaignId: campaignId ?? null,
      result: JSON.stringify(result),
      model: 'gpt-4o',
    },
  })

  return NextResponse.json({ ...analysis, parsedResult: result }, { status: 201 })
}
```

- [ ] **Step 2: Run tests to confirm no regressions**

```bash
npm test
```

Expected: ≥54 tests pass, 0 fail

- [ ] **Step 3: Commit**

```bash
git add src/app/api/analysis/route.ts
git commit -m "feat: add POST /api/analysis route handler with OpenAI integration"
```

---

## Task 4: Analysis Page (Server + Client Components)

**Files:**
- Create: `src/app/analysis/page.tsx`
- Create: `src/app/analysis/analysis-client.tsx`

- [ ] **Step 1: Create Server Component**

Create `src/app/analysis/page.tsx`:

```typescript
import { prisma } from '@/lib/prisma'
import { AnalysisClient } from './analysis-client'

export const dynamic = 'force-dynamic'

export default async function AnalysisPage() {
  const [overviewAnalysis, campaigns] = await Promise.all([
    prisma.aiAnalysis.findFirst({
      where: { type: 'OVERVIEW' },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.campaign.findMany({
      where: { status: { notIn: ['CANCELLED'] } },
      orderBy: [{ status: 'asc' }, { startDate: 'desc' }],
      include: {
        analyses: {
          where: { type: 'CAMPAIGN' },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    }),
  ])

  return (
    <AnalysisClient
      initialOverview={overviewAnalysis ? {
        id: overviewAnalysis.id,
        createdAt: overviewAnalysis.createdAt.toISOString(),
        result: overviewAnalysis.result,
        model: overviewAnalysis.model,
      } : null}
      campaigns={campaigns.map(c => ({
        id: c.id,
        name: c.name,
        status: c.status,
        targetType: c.targetType,
        latestAnalysis: c.analyses[0] ? {
          id: c.analyses[0].id,
          createdAt: c.analyses[0].createdAt.toISOString(),
          result: c.analyses[0].result,
          model: c.analyses[0].model,
        } : null,
      }))}
    />
  )
}
```

- [ ] **Step 2: Create Client Component**

Create `src/app/analysis/analysis-client.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { RefreshCw, Bot, ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { AnalysisResult } from '@/lib/analysis'

interface StoredAnalysis {
  id: string
  createdAt: string
  result: string
  model: string
}

interface CampaignItem {
  id: string
  name: string
  status: string
  targetType: string
  latestAnalysis: StoredAnalysis | null
}

interface Props {
  initialOverview: StoredAnalysis | null
  campaigns: CampaignItem[]
}

function formatThaiDate(iso: string) {
  return new Intl.DateTimeFormat('th-TH', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Bangkok',
  }).format(new Date(iso))
}

function ResultDisplay({ result }: { result: AnalysisResult }) {
  return (
    <div className="space-y-3 mt-3">
      <p className="text-sm">{result.status}</p>
      {[
        { label: 'ทำเลย', items: result.immediate },
        { label: 'อาทิตย์นี้', items: result.weekly },
        { label: 'เดือนนี้', items: result.monthly },
      ].filter(s => s.items.length > 0).map(s => (
        <div key={s.label}>
          <p className="text-xs font-medium text-muted-foreground mb-1">{s.label}</p>
          <ul className="space-y-1">
            {s.items.map((item, i) => (
              <li key={i} className="text-sm flex gap-2">
                <span className="text-muted-foreground">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
      {result.assumptions.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">สมมติฐาน</p>
          <ul className="space-y-1">
            {result.assumptions.map((item, i) => (
              <li key={i} className="text-xs text-muted-foreground flex gap-2">
                <span>•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export function AnalysisClient({ initialOverview, campaigns }: Props) {
  const [overviewAnalysis, setOverviewAnalysis] = useState<StoredAnalysis | null>(initialOverview)
  const [overviewLoading, setOverviewLoading] = useState(false)
  const [overviewError, setOverviewError] = useState<string | null>(null)

  const [campaignAnalyses, setCampaignAnalyses] = useState<Record<string, StoredAnalysis>>(
    Object.fromEntries(campaigns.flatMap(c => c.latestAnalysis ? [[c.id, c.latestAnalysis]] : []))
  )
  const [campaignLoading, setCampaignLoading] = useState<Record<string, boolean>>({})
  const [campaignErrors, setCampaignErrors] = useState<Record<string, string>>({})
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  async function triggerOverview() {
    setOverviewLoading(true)
    setOverviewError(null)
    try {
      const res = await fetch('/api/analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'OVERVIEW' }),
      })
      const data = await res.json()
      if (!res.ok) {
        setOverviewError(data.error ?? 'เกิดข้อผิดพลาด')
        return
      }
      setOverviewAnalysis({ id: data.id, createdAt: data.createdAt, result: data.result, model: data.model })
    } catch {
      setOverviewError('เกิดข้อผิดพลาด กรุณาลองใหม่')
    } finally {
      setOverviewLoading(false)
    }
  }

  async function triggerCampaign(campaignId: string) {
    setCampaignLoading(p => ({ ...p, [campaignId]: true }))
    setCampaignErrors(p => ({ ...p, [campaignId]: '' }))
    try {
      const res = await fetch('/api/analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'CAMPAIGN', campaignId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setCampaignErrors(p => ({ ...p, [campaignId]: data.error ?? 'เกิดข้อผิดพลาด' }))
        return
      }
      setCampaignAnalyses(p => ({ ...p, [campaignId]: { id: data.id, createdAt: data.createdAt, result: data.result, model: data.model } }))
      setExpanded(p => new Set([...p, campaignId]))
    } catch {
      setCampaignErrors(p => ({ ...p, [campaignId]: 'เกิดข้อผิดพลาด กรุณาลองใหม่' }))
    } finally {
      setCampaignLoading(p => ({ ...p, [campaignId]: false }))
    }
  }

  function toggleExpand(campaignId: string) {
    setExpanded(p => {
      const next = new Set(p)
      if (next.has(campaignId)) next.delete(campaignId)
      else next.add(campaignId)
      return next
    })
  }

  const overviewResult = overviewAnalysis ? JSON.parse(overviewAnalysis.result) as AnalysisResult : null

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      {/* Overview Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base">ภาพรวมทุกแคมเปญ</CardTitle>
          <div className="flex items-center gap-3">
            {overviewAnalysis && (
              <span className="text-xs text-muted-foreground">
                วิเคราะห์ล่าสุด: {formatThaiDate(overviewAnalysis.createdAt)}
              </span>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={triggerOverview}
              disabled={overviewLoading}
              className="gap-1.5"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${overviewLoading ? 'animate-spin' : ''}`} />
              {overviewLoading ? 'กำลังวิเคราะห์...' : 'วิเคราะห์ใหม่'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {overviewError && <p className="text-sm text-destructive">{overviewError}</p>}
          {!overviewResult && !overviewError && (
            <p className="text-sm text-muted-foreground">ยังไม่มีการวิเคราะห์ กดปุ่มเพื่อเริ่ม</p>
          )}
          {overviewResult && <ResultDisplay result={overviewResult} />}
          {overviewResult?.perCampaign && overviewResult.perCampaign.length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-xs font-medium text-muted-foreground mb-2">สรุปรายแคมเปญ</p>
              <div className="space-y-1.5">
                {overviewResult.perCampaign.map(p => (
                  <div key={p.campaignId} className="flex items-start gap-2 text-sm">
                    <span className={`shrink-0 text-xs px-1.5 py-0.5 rounded font-medium ${
                      p.status === 'ดีมาก' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' :
                      p.status === 'ต้องระวัง' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' :
                      p.status === 'วิกฤต' ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' :
                      'bg-muted text-muted-foreground'
                    }`}>{p.status}</span>
                    <span className="font-medium">{p.name}</span>
                    <span className="text-muted-foreground">{p.highlight}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Per-Campaign Section */}
      <div>
        <h2 className="text-sm font-semibold mb-3">วิเคราะห์รายแคมเปญ</h2>
        <div className="space-y-2">
          {campaigns.map(c => {
            const analysis = campaignAnalyses[c.id]
            const loading = campaignLoading[c.id] ?? false
            const error = campaignErrors[c.id]
            const isExpanded = expanded.has(c.id)
            const parsedResult = analysis ? JSON.parse(analysis.result) as AnalysisResult : null

            return (
              <Card key={c.id}>
                <CardHeader className="flex flex-row items-center justify-between py-3 px-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{c.name}</span>
                    <span className="text-xs text-muted-foreground">[{c.status}]</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {analysis && (
                      <span className="text-xs text-muted-foreground">
                        {formatThaiDate(analysis.createdAt)}
                      </span>
                    )}
                    {analysis && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 gap-1"
                        onClick={() => toggleExpand(c.id)}
                      >
                        {isExpanded
                          ? <ChevronDown className="h-3.5 w-3.5" />
                          : <ChevronRight className="h-3.5 w-3.5" />}
                        ดูผล
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 gap-1"
                      onClick={() => triggerCampaign(c.id)}
                      disabled={loading}
                    >
                      <Bot className={`h-3.5 w-3.5 ${loading ? 'animate-pulse' : ''}`} />
                      {loading ? '...' : analysis ? '🔄' : 'วิเคราะห์'}
                    </Button>
                  </div>
                </CardHeader>
                {isExpanded && parsedResult && (
                  <CardContent className="pt-0 px-4 pb-4">
                    <ResultDisplay result={parsedResult} />
                  </CardContent>
                )}
                {error && (
                  <CardContent className="pt-0 px-4 pb-3">
                    <p className="text-xs text-destructive">{error}</p>
                  </CardContent>
                )}
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Run tests to confirm no regressions**

```bash
npm test
```

Expected: ≥54 tests pass, 0 fail

- [ ] **Step 4: Start dev server and verify page loads**

```bash
npm run dev
```

Navigate to `http://localhost:3000/analysis`

Expected:
- หน้าโหลดได้โดยไม่มี error
- "ภาพรวมทุกแคมเปญ" card แสดง
- "ยังไม่มีการวิเคราะห์ กดปุ่มเพื่อเริ่ม" แสดง (ถ้ายังไม่เคยวิเคราะห์)
- รายการแคมเปญแสดงด้านล่าง

- [ ] **Step 5: Commit**

```bash
git add src/app/analysis/page.tsx src/app/analysis/analysis-client.tsx
git commit -m "feat: add /analysis page with overview and per-campaign analysis UI"
```

---

## Task 5: Nav + .env.example

**Files:**
- Modify: `src/components/nav.tsx`
- Modify: `.env.example`

- [ ] **Step 1: เพิ่ม "วิเคราะห์" ใน nav links**

เปิด `src/components/nav.tsx` แก้ `links` array:

```typescript
const links = [
  { href: '/', label: 'Dashboard' },
  { href: '/campaigns', label: 'Campaigns' },
  { href: '/goals', label: 'เป้าหมาย' },
  { href: '/wallet', label: 'Wallet' },
  { href: '/conversions', label: 'Conversions' },
  { href: '/analysis', label: 'วิเคราะห์' },
  { href: '/settings', label: 'Settings' },
]
```

และเพิ่ม `isActive` rule สำหรับ `/analysis` (ใส่ต่อจาก `/goals`):

```typescript
if (href === '/analysis') return pathname.startsWith('/analysis')
```

- [ ] **Step 2: เพิ่ม OPENAI_API_KEY ใน .env.example**

เปิด `.env.example` เพิ่มต่อจาก `EXCHANGE_RATE_API_KEY`:

```
OPENAI_API_KEY=        # API key จาก platform.openai.com
```

- [ ] **Step 3: Run tests**

```bash
npm test
```

Expected: ≥54 tests pass, 0 fail

- [ ] **Step 4: Verify nav in browser**

Navigate to `http://localhost:3000` (dev server ต้อง running)

Expected:
- "วิเคราะห์" link แสดงใน navbar
- คลิกแล้วนำทางไป `/analysis` ได้
- active highlight ทำงานถูกต้องเมื่ออยู่ที่ `/analysis`

- [ ] **Step 5: ทดสอบ end-to-end (ต้องมี OPENAI_API_KEY ใน .env)**

1. เพิ่ม `OPENAI_API_KEY=sk-...` ใน `.env` local
2. Restart dev server
3. ไปที่ `/analysis`
4. กด "วิเคราะห์ใหม่" → ปุ่มหมุน → ผลปรากฏ
5. กด "วิเคราะห์" ใต้แคมเปญใดแคมเปญหนึ่ง → ผลปรากฏ → กด "ดูผล" toggle

Expected: ผลจาก GPT-4o แสดงเป็นภาษาไทย มี status, immediate, weekly, monthly, assumptions

- [ ] **Step 6: Commit**

```bash
git add src/components/nav.tsx .env.example
git commit -m "feat: add วิเคราะห์ to nav and OPENAI_API_KEY to env example"
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] POST /api/analysis รับ `{ type, campaignId? }` → Task 3
- [x] OVERVIEW prompt ส่ง GlobalGoal.note + campaign metrics → Task 3
- [x] CAMPAIGN prompt ส่ง 30 วันล่าสุด + planText + goalText → Task 3
- [x] บันทึกผลลง AiAnalysis table → Task 3
- [x] ไม่ upsert — เก็บประวัติทุก analysis → Task 3 (prisma.aiAnalysis.create)
- [x] หน้า /analysis Server Component + Client Component → Task 4
- [x] ปุ่ม "วิเคราะห์ใหม่" + loading spinner → Task 4
- [x] ปุ่ม "ดูผล" + inline expand → Task 4
- [x] Error handling ทุก case ตาม spec → Task 3 (429, 502, 500, no API key)
- [x] OPENAI_API_KEY ใน .env.example → Task 5
- [x] Nav "วิเคราะห์" → Task 5
- [x] fetch ตรง ไม่ใช้ openai SDK → Task 3
- [x] response_format json_object → Task 3
- [x] today ใช้ Asia/Bangkok timezone → Task 3

**Placeholder scan:** ไม่มี TBD หรือ "implement later" ในแผน ✓

**Type consistency:**
- `CampaignSummary` ประกาศใน Task 2, ใช้ใน Task 3 ✓
- `EntryRow` ประกาศใน Task 2, ใช้ใน Task 3 ✓
- `AnalysisResult` ประกาศใน Task 2, ใช้ใน Task 3 และ Task 4 ✓
- `StoredAnalysis` interface ประกาศใน Task 4 Client Component ✓
- `analyses` relation (Prisma) เพิ่มใน Task 1, ใช้ใน Task 4 Server Component ✓
