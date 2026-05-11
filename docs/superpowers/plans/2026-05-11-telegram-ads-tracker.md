# Telegram Ads Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** สร้าง personal web app บันทึกและติดตาม Telegram Ads campaigns พร้อม metrics อัตโนมัติ และ deploy บน EasyPanel

**Architecture:** Next.js 14 App Router monolith ที่รวม frontend และ API routes ไว้ในที่เดียว ใช้ Prisma ORM คุย PostgreSQL และดึง TON/USD + USD/THB rates จาก external APIs อัตโนมัติ ป้องกันด้วย single-password session ผ่าน JWT cookie

**Tech Stack:** Next.js 14 (App Router), TypeScript, TailwindCSS, shadcn/ui, Prisma, PostgreSQL, jose (JWT), Vitest, Docker Compose, EasyPanel

---

## File Structure

```
adstelegram/
├── Dockerfile
├── docker-compose.yml
├── .env.example
├── .gitignore
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── vitest.config.ts
├── prisma/
│   └── schema.prisma
├── src/
│   ├── middleware.ts                          # JWT auth guard ทุก route ยกเว้น /login
│   ├── app/
│   │   ├── layout.tsx                         # Root layout + nav
│   │   ├── page.tsx                           # Dashboard
│   │   ├── login/
│   │   │   └── page.tsx                       # Login form
│   │   ├── campaigns/
│   │   │   ├── new/page.tsx                   # Add campaign form
│   │   │   └── [id]/
│   │   │       ├── page.tsx                   # Campaign detail
│   │   │       ├── edit/page.tsx              # Edit campaign form
│   │   │       └── entries/new/page.tsx       # Add performance entry
│   │   ├── settings/
│   │   │   └── page.tsx                       # Export / Import JSON
│   │   └── api/
│   │       ├── auth/
│   │       │   ├── login/route.ts             # POST: check password, set cookie
│   │       │   └── logout/route.ts            # POST: clear cookie
│   │       ├── campaigns/
│   │       │   ├── route.ts                   # GET list, POST create
│   │       │   └── [id]/
│   │       │       ├── route.ts               # GET, PUT, DELETE
│   │       │       └── entries/route.ts       # GET list, POST create
│   │       ├── rates/route.ts                 # GET: fetch TON/USD + USD/THB
│   │       └── export/route.ts                # GET: export JSON, POST: import JSON
│   ├── components/
│   │   ├── nav.tsx                            # Top navigation bar
│   │   ├── campaign-card.tsx                  # Card บน dashboard
│   │   ├── metric-cards.tsx                   # 6 metric cards บน detail
│   │   ├── performance-table.tsx              # Log table
│   │   ├── campaign-form.tsx                  # Add/Edit campaign form
│   │   └── entry-form.tsx                     # Add entry form + rate fetch
│   └── lib/
│       ├── prisma.ts                          # Prisma client singleton
│       ├── metrics.ts                         # คำนวณ CTR, CR, CPC, CPS, CPM, BSP
│       ├── rates.ts                           # ดึง TON/USD + USD/THB
│       ├── auth.ts                            # createSession / verifySession
│       └── export.ts                          # exportData / importData
└── tests/
    ├── metrics.test.ts
    ├── rates.test.ts
    └── export.test.ts
```

---

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`, `next.config.ts`, `tailwind.config.ts`, `tsconfig.json`, `vitest.config.ts`
- Create: `.gitignore`, `.env.example`

- [ ] **Step 1: สร้างโปรเจค Next.js**

```bash
cd /Users/wolfy/works/adstelegram
npx create-next-app@latest . \
  --typescript \
  --tailwind \
  --app \
  --no-src-dir \
  --import-alias "@/*" \
  --no-eslint
```

เมื่อถามให้กด Enter ทั้งหมด

- [ ] **Step 2: ย้าย code เข้า src/ และติดตั้ง dependencies**

```bash
mkdir -p src/app src/components src/lib tests
mv app src/app 2>/dev/null || true
```

```bash
npm install prisma @prisma/client jose
npm install -D vitest @vitejs/plugin-react @vitest/coverage-v8
```

- [ ] **Step 3: ติดตั้ง shadcn/ui**

```bash
npx shadcn@latest init -d
```

เมื่อถามให้เลือก: Default style, Zinc color, yes to CSS variables

```bash
npx shadcn@latest add button input label card badge table form select textarea
```

- [ ] **Step 4: สร้าง vitest.config.ts**

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    globals: true,
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
})
```

- [ ] **Step 5: เพิ่ม test script ใน package.json**

เปิด `package.json` หา `"scripts"` แล้วเพิ่ม:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 6: สร้าง .env.example**

```bash
cat > .env.example << 'EOF'
DATABASE_URL="postgresql://adstelegram:password@db:5432/adstelegram"
POSTGRES_USER=adstelegram
POSTGRES_PASSWORD=change_me
POSTGRES_DB=adstelegram

APP_PASSWORD=change_me_app_password
JWT_SECRET=change_me_random_32_char_string

EXCHANGE_RATE_API_KEY=your_key_from_exchangerate-api.com
NEXT_PUBLIC_APP_URL=https://ads.yourdomain.com
EOF
```

- [ ] **Step 7: สร้าง .gitignore**

```bash
cat > .gitignore << 'EOF'
node_modules/
.next/
.env
.env.local
.superpowers/
dist/
EOF
```

- [ ] **Step 8: สร้าง .env จาก .env.example สำหรับ dev**

```bash
cp .env.example .env
# แก้ค่าใน .env ให้ตรงกับ local dev ของคุณ
# DATABASE_URL="postgresql://postgres:postgres@localhost:5432/adstelegram"
```

- [ ] **Step 9: Commit**

```bash
git init
git add -A
git commit -m "chore: scaffold Next.js project with shadcn/ui and Vitest"
```

---

## Task 2: Prisma Schema + Database

**Files:**
- Create: `prisma/schema.prisma`
- Create: `src/lib/prisma.ts`

- [ ] **Step 1: Init Prisma**

```bash
npx prisma init --datasource-provider postgresql
```

- [ ] **Step 2: เขียน schema**

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Campaign {
  id         String         @id @default(uuid())
  name       String
  targetType TargetType
  targetName String
  startDate  DateTime
  endDate    DateTime?
  budgetTon  Decimal        @db.Decimal(18, 8)
  status     CampaignStatus @default(ACTIVE)
  note       String?
  entries    PerformanceEntry[]
  createdAt  DateTime       @default(now())
  updatedAt  DateTime       @updatedAt
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

- [ ] **Step 3: สร้าง Prisma client singleton**

```typescript
// src/lib/prisma.ts
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

- [ ] **Step 4: Run migration (ต้อง PostgreSQL รันอยู่)**

```bash
npx prisma migrate dev --name init
```

Expected output: `✔ Generated Prisma Client`

- [ ] **Step 5: Commit**

```bash
git add prisma/ src/lib/prisma.ts
git commit -m "feat: add Prisma schema with Campaign and PerformanceEntry models"
```

---

## Task 3: Auth System

**Files:**
- Create: `src/lib/auth.ts`
- Create: `src/middleware.ts`
- Create: `src/app/api/auth/login/route.ts`
- Create: `src/app/api/auth/logout/route.ts`
- Create: `src/app/login/page.tsx`

- [ ] **Step 1: เขียน failing test**

```typescript
// tests/auth.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({
    set: vi.fn(),
    delete: vi.fn(),
    get: vi.fn(),
  })),
}))

describe('verifyPassword', () => {
  beforeEach(() => {
    process.env.APP_PASSWORD = 'test-password'
    process.env.JWT_SECRET = 'test-secret-32-chars-minimum-ok!'
  })

  it('returns true for correct password', async () => {
    const { verifyPassword } = await import('@/lib/auth')
    expect(verifyPassword('test-password')).toBe(true)
  })

  it('returns false for wrong password', async () => {
    const { verifyPassword } = await import('@/lib/auth')
    expect(verifyPassword('wrong')).toBe(false)
  })
})
```

- [ ] **Step 2: รัน test เพื่อยืนยันว่า fail**

```bash
npm test tests/auth.test.ts
```

Expected: FAIL — "Cannot find module '@/lib/auth'"

- [ ] **Step 3: เขียน auth.ts**

```typescript
// src/lib/auth.ts
import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

function getSecret() {
  return new TextEncoder().encode(process.env.JWT_SECRET!)
}

export function verifyPassword(input: string): boolean {
  return input === process.env.APP_PASSWORD
}

export async function createSession(): Promise<void> {
  const token = await new SignJWT({ auth: true })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('30d')
    .sign(getSecret())

  const jar = await cookies()
  jar.set('session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  })
}

export async function verifySession(token: string): Promise<boolean> {
  try {
    await jwtVerify(token, getSecret())
    return true
  } catch {
    return false
  }
}

export async function destroySession(): Promise<void> {
  const jar = await cookies()
  jar.delete('session')
}
```

- [ ] **Step 4: รัน test เพื่อยืนยันว่าผ่าน**

```bash
npm test tests/auth.test.ts
```

Expected: PASS — 2 tests

- [ ] **Step 5: สร้าง middleware.ts**

```typescript
// src/middleware.ts
import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

const PUBLIC_PATHS = ['/login', '/api/auth/login']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  const secret = new TextEncoder().encode(process.env.JWT_SECRET!)
  const token = request.cookies.get('session')?.value

  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  try {
    await jwtVerify(token, secret)
    return NextResponse.next()
  } catch {
    return NextResponse.redirect(new URL('/login', request.url))
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

- [ ] **Step 6: สร้าง Login API**

```typescript
// src/app/api/auth/login/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { verifyPassword, createSession } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const { password } = await req.json()

  if (!verifyPassword(password)) {
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 })
  }

  await createSession()
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 7: สร้าง Logout API**

```typescript
// src/app/api/auth/logout/route.ts
import { NextResponse } from 'next/server'
import { destroySession } from '@/lib/auth'

export async function POST() {
  await destroySession()
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 8: สร้าง Login page**

```tsx
// src/app/login/page.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function LoginPage() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })

    if (res.ok) {
      router.push('/')
      router.refresh()
    } else {
      setError('รหัสผ่านไม่ถูกต้อง')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-center">Telegram Ads Tracker</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">รหัสผ่าน</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="กรอกรหัสผ่าน"
                autoFocus
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 9: Commit**

```bash
git add src/middleware.ts src/lib/auth.ts src/app/api/auth/ src/app/login/ tests/auth.test.ts
git commit -m "feat: add single-password auth with JWT session cookie"
```

---

## Task 4: Metrics Library

**Files:**
- Create: `src/lib/metrics.ts`
- Create: `tests/metrics.test.ts`

- [ ] **Step 1: เขียน failing tests**

```typescript
// tests/metrics.test.ts
import { describe, it, expect } from 'vitest'
import { calcEntryMetrics, calcAggregateMetrics } from '@/lib/metrics'

const sampleEntry = {
  spendTon: 8.5,
  dailyBudgetTon: 10,
  tonPriceUsd: 3.18,
  usdThbRate: 32.45,
  impressions: 12400,
  views: 9800,
  clicks: 384,
  joins: 69,
}

describe('calcEntryMetrics', () => {
  it('calculates spendUsd correctly', () => {
    const m = calcEntryMetrics(sampleEntry)
    expect(m.spendUsd).toBeCloseTo(8.5 * 3.18, 4)
  })

  it('calculates spendThb correctly', () => {
    const m = calcEntryMetrics(sampleEntry)
    expect(m.spendThb).toBeCloseTo(8.5 * 3.18 * 32.45, 2)
  })

  it('calculates CTR', () => {
    const m = calcEntryMetrics(sampleEntry)
    expect(m.ctr).toBeCloseTo((384 / 12400) * 100, 4)
  })

  it('calculates CR', () => {
    const m = calcEntryMetrics(sampleEntry)
    expect(m.cr).toBeCloseTo((69 / 384) * 100, 4)
  })

  it('calculates CPC', () => {
    const m = calcEntryMetrics(sampleEntry)
    const spendUsd = 8.5 * 3.18
    expect(m.cpc).toBeCloseTo(spendUsd / 384, 4)
  })

  it('calculates CPS', () => {
    const m = calcEntryMetrics(sampleEntry)
    const spendUsd = 8.5 * 3.18
    expect(m.cps).toBeCloseTo(spendUsd / 69, 4)
  })

  it('calculates CPM', () => {
    const m = calcEntryMetrics(sampleEntry)
    const spendUsd = 8.5 * 3.18
    expect(m.cpm).toBeCloseTo((spendUsd / 12400) * 1000, 4)
  })

  it('calculates BSP', () => {
    const m = calcEntryMetrics(sampleEntry)
    expect(m.bsp).toBeCloseTo((8.5 / 10) * 100, 4)
  })

  it('returns 0 for CTR when impressions = 0', () => {
    const m = calcEntryMetrics({ ...sampleEntry, impressions: 0 })
    expect(m.ctr).toBe(0)
    expect(m.cpm).toBe(0)
  })

  it('returns 0 for CR when clicks = 0', () => {
    const m = calcEntryMetrics({ ...sampleEntry, clicks: 0 })
    expect(m.cr).toBe(0)
    expect(m.cpc).toBe(0)
  })

  it('returns 0 for CPS when joins = 0', () => {
    const m = calcEntryMetrics({ ...sampleEntry, joins: 0 })
    expect(m.cps).toBe(0)
  })
})

describe('calcAggregateMetrics', () => {
  it('aggregates two entries correctly', () => {
    const entries = [sampleEntry, sampleEntry]
    const agg = calcAggregateMetrics(entries)
    expect(agg.totalSpendTon).toBeCloseTo(17, 4)
    expect(agg.totalImpressions).toBe(24800)
    expect(agg.totalClicks).toBe(768)
    expect(agg.totalJoins).toBe(138)
  })
})
```

- [ ] **Step 2: รัน test เพื่อยืนยันว่า fail**

```bash
npm test tests/metrics.test.ts
```

Expected: FAIL — "Cannot find module '@/lib/metrics'"

- [ ] **Step 3: เขียน metrics.ts**

```typescript
// src/lib/metrics.ts

export interface EntryInput {
  spendTon: number
  dailyBudgetTon: number
  tonPriceUsd: number
  usdThbRate: number
  impressions: number
  views?: number
  clicks: number
  joins: number
}

export interface EntryMetrics {
  spendUsd: number
  spendThb: number
  ctr: number
  cr: number
  cpc: number
  cps: number
  cpm: number
  bsp: number
}

export interface AggregateMetrics extends EntryMetrics {
  totalSpendTon: number
  totalImpressions: number
  totalClicks: number
  totalJoins: number
}

export function calcEntryMetrics(e: EntryInput): EntryMetrics {
  const spendUsd = Number(e.spendTon) * Number(e.tonPriceUsd)
  const spendThb = spendUsd * Number(e.usdThbRate)
  const imp = Number(e.impressions)
  const clk = Number(e.clicks)
  const jns = Number(e.joins)
  const ton = Number(e.spendTon)
  const budget = Number(e.dailyBudgetTon)

  return {
    spendUsd,
    spendThb,
    ctr: imp > 0 ? (clk / imp) * 100 : 0,
    cr: clk > 0 ? (jns / clk) * 100 : 0,
    cpc: clk > 0 ? spendUsd / clk : 0,
    cps: jns > 0 ? spendUsd / jns : 0,
    cpm: imp > 0 ? (spendUsd / imp) * 1000 : 0,
    bsp: budget > 0 ? (ton / budget) * 100 : 0,
  }
}

export function calcAggregateMetrics(entries: EntryInput[]): AggregateMetrics {
  const totals = entries.reduce(
    (acc, e) => {
      const spendUsd = Number(e.spendTon) * Number(e.tonPriceUsd)
      return {
        spendTon: acc.spendTon + Number(e.spendTon),
        spendUsd: acc.spendUsd + spendUsd,
        spendThb: acc.spendThb + spendUsd * Number(e.usdThbRate),
        dailyBudgetTon: acc.dailyBudgetTon + Number(e.dailyBudgetTon),
        impressions: acc.impressions + Number(e.impressions),
        clicks: acc.clicks + Number(e.clicks),
        joins: acc.joins + Number(e.joins),
      }
    },
    { spendTon: 0, spendUsd: 0, spendThb: 0, dailyBudgetTon: 0, impressions: 0, clicks: 0, joins: 0 }
  )

  const { spendTon, spendUsd, spendThb, dailyBudgetTon, impressions, clicks, joins } = totals

  return {
    spendUsd,
    spendThb,
    ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
    cr: clicks > 0 ? (joins / clicks) * 100 : 0,
    cpc: clicks > 0 ? spendUsd / clicks : 0,
    cps: joins > 0 ? spendUsd / joins : 0,
    cpm: impressions > 0 ? (spendUsd / impressions) * 1000 : 0,
    bsp: dailyBudgetTon > 0 ? (spendTon / dailyBudgetTon) * 100 : 0,
    totalSpendTon: spendTon,
    totalImpressions: impressions,
    totalClicks: clicks,
    totalJoins: joins,
  }
}
```

- [ ] **Step 4: รัน test เพื่อยืนยันว่าผ่าน**

```bash
npm test tests/metrics.test.ts
```

Expected: PASS — 12 tests

- [ ] **Step 5: Commit**

```bash
git add src/lib/metrics.ts tests/metrics.test.ts
git commit -m "feat: add metrics calculation library with full test coverage"
```

---

## Task 5: Rate Fetching API

**Files:**
- Create: `src/lib/rates.ts`
- Create: `src/app/api/rates/route.ts`
- Create: `tests/rates.test.ts`

- [ ] **Step 1: เขียน failing test**

```typescript
// tests/rates.test.ts
import { describe, it, expect, vi } from 'vitest'

global.fetch = vi.fn()

describe('fetchRates', () => {
  it('returns tonUsd and usdThb from APIs', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ 'the-open-network': { usd: 3.18 } }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ conversion_rate: 32.45 }),
      } as Response)

    process.env.EXCHANGE_RATE_API_KEY = 'test-key'

    const { fetchRates } = await import('@/lib/rates')
    const rates = await fetchRates()

    expect(rates.tonUsd).toBe(3.18)
    expect(rates.usdThb).toBe(32.45)
    expect(rates.fetchedAt).toBeTruthy()
  })

  it('throws when API fails', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: false } as Response)

    process.env.EXCHANGE_RATE_API_KEY = 'test-key'

    const { fetchRates } = await import('@/lib/rates')
    await expect(fetchRates()).rejects.toThrow('Failed to fetch rates')
  })
})
```

- [ ] **Step 2: รัน test เพื่อยืนยันว่า fail**

```bash
npm test tests/rates.test.ts
```

Expected: FAIL — "Cannot find module '@/lib/rates'"

- [ ] **Step 3: เขียน rates.ts**

```typescript
// src/lib/rates.ts

export interface Rates {
  tonUsd: number
  usdThb: number
  fetchedAt: string
}

export async function fetchRates(): Promise<Rates> {
  const [tonRes, thbRes] = await Promise.all([
    fetch('https://api.coingecko.com/api/v3/simple/price?ids=the-open-network&vs_currencies=usd', {
      next: { revalidate: 0 },
    }),
    fetch(
      `https://v6.exchangerate-api.com/v6/${process.env.EXCHANGE_RATE_API_KEY}/pair/USD/THB`,
      { next: { revalidate: 0 } }
    ),
  ])

  if (!tonRes.ok || !thbRes.ok) {
    throw new Error('Failed to fetch rates')
  }

  const tonData = await tonRes.json()
  const thbData = await thbRes.json()

  return {
    tonUsd: tonData['the-open-network'].usd as number,
    usdThb: thbData.conversion_rate as number,
    fetchedAt: new Date().toISOString(),
  }
}
```

- [ ] **Step 4: สร้าง API route**

```typescript
// src/app/api/rates/route.ts
import { NextResponse } from 'next/server'
import { fetchRates } from '@/lib/rates'

export async function GET() {
  try {
    const rates = await fetchRates()
    return NextResponse.json(rates)
  } catch {
    return NextResponse.json({ error: 'Failed to fetch rates' }, { status: 502 })
  }
}
```

- [ ] **Step 5: รัน test เพื่อยืนยันว่าผ่าน**

```bash
npm test tests/rates.test.ts
```

Expected: PASS — 2 tests

- [ ] **Step 6: Commit**

```bash
git add src/lib/rates.ts src/app/api/rates/ tests/rates.test.ts
git commit -m "feat: add rate fetching from CoinGecko and ExchangeRate-API"
```

---

## Task 6: Campaign CRUD API

**Files:**
- Create: `src/app/api/campaigns/route.ts`
- Create: `src/app/api/campaigns/[id]/route.ts`

- [ ] **Step 1: สร้าง GET + POST campaigns**

```typescript
// src/app/api/campaigns/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const campaigns = await prisma.campaign.findMany({
    include: {
      entries: {
        orderBy: { date: 'asc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(campaigns)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const campaign = await prisma.campaign.create({
    data: {
      name: body.name,
      targetType: body.targetType,
      targetName: body.targetName,
      startDate: new Date(body.startDate),
      endDate: body.endDate ? new Date(body.endDate) : null,
      budgetTon: body.budgetTon,
      status: body.status ?? 'ACTIVE',
      note: body.note ?? null,
    },
  })
  return NextResponse.json(campaign, { status: 201 })
}
```

- [ ] **Step 2: สร้าง GET + PUT + DELETE campaign by id**

```typescript
// src/app/api/campaigns/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: { entries: { orderBy: { date: 'desc' } } },
  })
  if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(campaign)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const campaign = await prisma.campaign.update({
    where: { id },
    data: {
      name: body.name,
      targetType: body.targetType,
      targetName: body.targetName,
      startDate: new Date(body.startDate),
      endDate: body.endDate ? new Date(body.endDate) : null,
      budgetTon: body.budgetTon,
      status: body.status,
      note: body.note ?? null,
    },
  })
  return NextResponse.json(campaign)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await prisma.campaign.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/campaigns/
git commit -m "feat: add Campaign CRUD API routes"
```

---

## Task 7: PerformanceEntry API

**Files:**
- Create: `src/app/api/campaigns/[id]/entries/route.ts`

- [ ] **Step 1: สร้าง GET + POST entries**

```typescript
// src/app/api/campaigns/[id]/entries/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const entries = await prisma.performanceEntry.findMany({
    where: { campaignId: id },
    orderBy: { date: 'desc' },
  })
  return NextResponse.json(entries)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()

  const entry = await prisma.performanceEntry.create({
    data: {
      campaignId: id,
      date: new Date(body.date),
      spendTon: body.spendTon,
      dailyBudgetTon: body.dailyBudgetTon,
      tonPriceUsd: body.tonPriceUsd,
      usdThbRate: body.usdThbRate,
      impressions: Number(body.impressions),
      views: Number(body.views),
      clicks: Number(body.clicks),
      joins: Number(body.joins),
      note: body.note ?? null,
    },
  })
  return NextResponse.json(entry, { status: 201 })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/campaigns/
git commit -m "feat: add PerformanceEntry API routes"
```

---

## Task 8: Export / Import

**Files:**
- Create: `src/lib/export.ts`
- Create: `src/app/api/export/route.ts`
- Create: `tests/export.test.ts`

- [ ] **Step 1: เขียน failing test**

```typescript
// tests/export.test.ts
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    campaign: {
      findMany: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    performanceEntry: {
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn(async (fn: (tx: any) => Promise<void>) => fn({
      campaign: { create: vi.fn(), deleteMany: vi.fn() },
      performanceEntry: { deleteMany: vi.fn() },
    })),
  },
}))

describe('exportData', () => {
  it('returns version 1 and exportedAt', async () => {
    const { prisma } = await import('@/lib/prisma')
    vi.mocked(prisma.campaign.findMany).mockResolvedValueOnce([])

    const { exportData } = await import('@/lib/export')
    const result = await exportData()

    expect(result.version).toBe(1)
    expect(result.exportedAt).toBeTruthy()
    expect(result.campaigns).toEqual([])
  })
})
```

- [ ] **Step 2: รัน test เพื่อยืนยันว่า fail**

```bash
npm test tests/export.test.ts
```

Expected: FAIL — "Cannot find module '@/lib/export'"

- [ ] **Step 3: เขียน export.ts**

```typescript
// src/lib/export.ts
import { prisma } from './prisma'

export interface ExportData {
  version: number
  exportedAt: string
  campaigns: any[]
}

export async function exportData(): Promise<ExportData> {
  const campaigns = await prisma.campaign.findMany({
    include: { entries: { orderBy: { date: 'asc' } } },
    orderBy: { createdAt: 'asc' },
  })

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    campaigns: campaigns.map(c => ({
      ...c,
      budgetTon: c.budgetTon.toString(),
      startDate: c.startDate.toISOString(),
      endDate: c.endDate?.toISOString() ?? null,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
      entries: c.entries.map((e: any) => ({
        ...e,
        spendTon: e.spendTon.toString(),
        dailyBudgetTon: e.dailyBudgetTon.toString(),
        tonPriceUsd: e.tonPriceUsd.toString(),
        usdThbRate: e.usdThbRate.toString(),
        date: e.date.toISOString(),
        createdAt: e.createdAt.toISOString(),
      })),
    })),
  }
}

export async function importData(data: ExportData): Promise<void> {
  await prisma.$transaction(async tx => {
    await tx.performanceEntry.deleteMany()
    await tx.campaign.deleteMany()

    for (const c of data.campaigns) {
      await tx.campaign.create({
        data: {
          id: c.id,
          name: c.name,
          targetType: c.targetType,
          targetName: c.targetName,
          startDate: new Date(c.startDate),
          endDate: c.endDate ? new Date(c.endDate) : null,
          budgetTon: c.budgetTon,
          status: c.status,
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
  })
}
```

- [ ] **Step 4: สร้าง API route**

```typescript
// src/app/api/export/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { exportData, importData } from '@/lib/export'

export async function GET() {
  const data = await exportData()
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="ads-backup-${new Date().toISOString().split('T')[0]}.json"`,
    },
  })
}

export async function POST(req: NextRequest) {
  const data = await req.json()
  if (data.version !== 1) {
    return NextResponse.json({ error: 'Unsupported version' }, { status: 400 })
  }
  await importData(data)
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 5: รัน test เพื่อยืนยันว่าผ่าน**

```bash
npm test tests/export.test.ts
```

Expected: PASS — 1 test

- [ ] **Step 6: Commit**

```bash
git add src/lib/export.ts src/app/api/export/ tests/export.test.ts
git commit -m "feat: add export/import JSON backup system"
```

---

## Task 9: Layout + Navigation

**Files:**
- Modify: `src/app/layout.tsx`
- Create: `src/components/nav.tsx`

- [ ] **Step 1: สร้าง Nav component**

```tsx
// src/components/nav.tsx
'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

export function Nav() {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  const links = [
    { href: '/', label: 'Dashboard' },
    { href: '/campaigns/new', label: '+ Campaign' },
    { href: '/settings', label: 'Settings' },
  ]

  return (
    <nav className="border-b px-6 py-3 flex items-center gap-6">
      <span className="font-semibold text-sm">Ads Tracker</span>
      <div className="flex items-center gap-4 flex-1">
        {links.map(l => (
          <Link
            key={l.href}
            href={l.href}
            className={`text-sm ${pathname === l.href ? 'text-foreground font-medium' : 'text-muted-foreground hover:text-foreground'}`}
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

- [ ] **Step 2: อัปเดต layout.tsx**

```tsx
// src/app/layout.tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Nav } from '@/components/nav'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Telegram Ads Tracker',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" className="dark">
      <body className={inter.className}>
        <Nav />
        <main className="container mx-auto px-6 py-8 max-w-6xl">
          {children}
        </main>
      </body>
    </html>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/layout.tsx src/components/nav.tsx
git commit -m "feat: add root layout with navigation bar"
```

---

## Task 10: Dashboard Page

**Files:**
- Create: `src/components/campaign-card.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: สร้าง CampaignCard component**

```tsx
// src/components/campaign-card.tsx
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { calcAggregateMetrics } from '@/lib/metrics'

const STATUS_COLORS = {
  ACTIVE: 'default',
  PAUSED: 'secondary',
  DONE: 'outline',
} as const

function fmt(n: number, digits = 2) {
  return n.toFixed(digits)
}

export function CampaignCard({ campaign }: { campaign: any }) {
  const metrics = campaign.entries.length > 0
    ? calcAggregateMetrics(campaign.entries.map((e: any) => ({
        spendTon: Number(e.spendTon),
        dailyBudgetTon: Number(e.dailyBudgetTon),
        tonPriceUsd: Number(e.tonPriceUsd),
        usdThbRate: Number(e.usdThbRate),
        impressions: e.impressions,
        views: e.views,
        clicks: e.clicks,
        joins: e.joins,
      })))
    : null

  const budgetTon = Number(campaign.budgetTon)
  const totalSpendTon = metrics?.totalSpendTon ?? 0
  const budgetPct = budgetTon > 0 ? Math.min((totalSpendTon / budgetTon) * 100, 100) : 0

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
            {campaign.targetType} · {campaign.targetName}
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>Budget spent</span>
              <span>{fmt(totalSpendTon, 2)} / {fmt(budgetTon, 2)} TON</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${budgetPct}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">BSP {fmt(budgetPct, 1)}%</p>
          </div>
          {metrics && (
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <p className="text-muted-foreground">CTR</p>
                <p className="font-medium">{fmt(metrics.ctr, 2)}%</p>
              </div>
              <div>
                <p className="text-muted-foreground">CPS (USD)</p>
                <p className="font-medium">${fmt(metrics.cps, 3)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Joins</p>
                <p className="font-medium">{metrics.totalJoins.toLocaleString()}</p>
              </div>
            </div>
          )}
          {!metrics && (
            <p className="text-xs text-muted-foreground">ยังไม่มีข้อมูล</p>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}
```

- [ ] **Step 2: สร้าง Dashboard page**

```tsx
// src/app/page.tsx
import { prisma } from '@/lib/prisma'
import { CampaignCard } from '@/components/campaign-card'
import { calcAggregateMetrics } from '@/lib/metrics'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const campaigns = await prisma.campaign.findMany({
    include: { entries: { orderBy: { date: 'asc' } } },
    orderBy: { createdAt: 'desc' },
  })

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <Button asChild size="sm">
          <Link href="/campaigns/new">+ Campaign</Link>
        </Button>
      </div>

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
            <p className="text-sm text-muted-foreground">{summary.totalImpressions.toLocaleString()} impressions</p>
          </div>
        </div>
      )}

      {campaigns.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="mb-4">ยังไม่มี campaign</p>
          <Button asChild>
            <Link href="/campaigns/new">สร้าง campaign แรก</Link>
          </Button>
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

- [ ] **Step 3: Commit**

```bash
git add src/components/campaign-card.tsx src/app/page.tsx
git commit -m "feat: add dashboard page with campaign overview cards"
```

---

## Task 11: Campaign Detail Page

**Files:**
- Create: `src/components/metric-cards.tsx`
- Create: `src/components/performance-table.tsx`
- Create: `src/app/campaigns/[id]/page.tsx`

- [ ] **Step 1: สร้าง MetricCards component**

```tsx
// src/components/metric-cards.tsx
import { AggregateMetrics } from '@/lib/metrics'

function MetricCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border p-4 text-center">
      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{label}</p>
      <p className="text-xl font-bold">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  )
}

export function MetricCards({ metrics }: { metrics: AggregateMetrics }) {
  return (
    <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
      <MetricCard label="CTR" value={`${metrics.ctr.toFixed(2)}%`} />
      <MetricCard label="CR" value={`${metrics.cr.toFixed(2)}%`} />
      <MetricCard label="CPC" value={`$${metrics.cpc.toFixed(4)}`} />
      <MetricCard label="CPS" value={`$${metrics.cps.toFixed(4)}`} />
      <MetricCard label="CPM" value={`$${metrics.cpm.toFixed(3)}`} />
      <MetricCard label="BSP" value={`${metrics.bsp.toFixed(1)}%`} />
    </div>
  )
}
```

- [ ] **Step 2: สร้าง PerformanceTable component**

```tsx
// src/components/performance-table.tsx
import { calcEntryMetrics } from '@/lib/metrics'

function fmt(n: number, d = 2) { return n.toFixed(d) }

export function PerformanceTable({ entries }: { entries: any[] }) {
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground py-4">ยังไม่มี entry</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-muted-foreground text-xs">
            <th className="text-left py-2 px-3">วันที่</th>
            <th className="text-right py-2 px-3">Spend (TON)</th>
            <th className="text-right py-2 px-3">BSP</th>
            <th className="text-right py-2 px-3">Imp</th>
            <th className="text-right py-2 px-3">Views</th>
            <th className="text-right py-2 px-3">Clicks</th>
            <th className="text-right py-2 px-3">Joins</th>
            <th className="text-right py-2 px-3">CTR</th>
            <th className="text-right py-2 px-3">TON/USD</th>
            <th className="text-right py-2 px-3">มูลค่า (฿)</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e: any) => {
            const m = calcEntryMetrics({
              spendTon: Number(e.spendTon),
              dailyBudgetTon: Number(e.dailyBudgetTon),
              tonPriceUsd: Number(e.tonPriceUsd),
              usdThbRate: Number(e.usdThbRate),
              impressions: e.impressions,
              clicks: e.clicks,
              joins: e.joins,
            })
            return (
              <tr key={e.id} className="border-b hover:bg-muted/30">
                <td className="py-2 px-3">
                  {new Date(e.date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}
                </td>
                <td className="text-right py-2 px-3">{fmt(Number(e.spendTon), 2)}</td>
                <td className="text-right py-2 px-3">{fmt(m.bsp, 1)}%</td>
                <td className="text-right py-2 px-3">{e.impressions.toLocaleString()}</td>
                <td className="text-right py-2 px-3">{e.views.toLocaleString()}</td>
                <td className="text-right py-2 px-3">{e.clicks.toLocaleString()}</td>
                <td className="text-right py-2 px-3">{e.joins.toLocaleString()}</td>
                <td className="text-right py-2 px-3">{fmt(m.ctr, 2)}%</td>
                <td className="text-right py-2 px-3">${fmt(Number(e.tonPriceUsd), 2)}</td>
                <td className="text-right py-2 px-3">฿{m.spendThb.toLocaleString('th-TH', { maximumFractionDigits: 0 })}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 3: สร้าง Campaign Detail page**

```tsx
// src/app/campaigns/[id]/page.tsx
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { calcAggregateMetrics } from '@/lib/metrics'
import { MetricCards } from '@/components/metric-cards'
import { PerformanceTable } from '@/components/performance-table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export const dynamic = 'force-dynamic'

const STATUS_COLORS = { ACTIVE: 'default', PAUSED: 'secondary', DONE: 'outline' } as const

export default async function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: { entries: { orderBy: { date: 'desc' } } },
  })

  if (!campaign) notFound()

  const entriesForCalc = campaign.entries.map(e => ({
    spendTon: Number(e.spendTon),
    dailyBudgetTon: Number(e.dailyBudgetTon),
    tonPriceUsd: Number(e.tonPriceUsd),
    usdThbRate: Number(e.usdThbRate),
    impressions: e.impressions,
    views: e.views,
    clicks: e.clicks,
    joins: e.joins,
  }))

  const metrics = entriesForCalc.length > 0 ? calcAggregateMetrics(entriesForCalc) : null

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
            {campaign.targetType} · {campaign.targetName} ·{' '}
            เริ่ม {new Date(campaign.startDate).toLocaleDateString('th-TH')}
            {campaign.endDate && ` — ${new Date(campaign.endDate).toLocaleDateString('th-TH')}`}
          </p>
          <p className="text-sm text-muted-foreground">Budget: {Number(campaign.budgetTon).toFixed(2)} TON</p>
          {campaign.note && <p className="text-sm text-muted-foreground mt-1">{campaign.note}</p>}
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/campaigns/${id}/edit`}>แก้ไข</Link>
          </Button>
          <Button asChild size="sm">
            <Link href={`/campaigns/${id}/entries/new`}>+ บันทึกวันนี้</Link>
          </Button>
        </div>
      </div>

      {metrics ? (
        <MetricCards metrics={metrics} />
      ) : (
        <p className="text-sm text-muted-foreground">ยังไม่มีข้อมูล performance</p>
      )}

      <div>
        <h2 className="text-lg font-semibold mb-3">Performance Log</h2>
        <PerformanceTable entries={campaign.entries} />
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/metric-cards.tsx src/components/performance-table.tsx src/app/campaigns/
git commit -m "feat: add campaign detail page with metrics and performance log"
```

---

## Task 12: Campaign Form (Add / Edit)

**Files:**
- Create: `src/components/campaign-form.tsx`
- Create: `src/app/campaigns/new/page.tsx`
- Create: `src/app/campaigns/[id]/edit/page.tsx`

- [ ] **Step 1: สร้าง CampaignForm component**

```tsx
// src/components/campaign-form.tsx
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
    budgetTon: string
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
    startDate: initialData?.startDate?.split('T')[0] ?? new Date().toISOString().split('T')[0],
    endDate: initialData?.endDate?.split('T')[0] ?? '',
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
      note: form.note || null,
      budgetTon: parseFloat(form.budgetTon),
    }

    const url = isEdit ? `/api/campaigns/${initialData!.id}` : '/api/campaigns'
    const method = isEdit ? 'PUT' : 'POST'

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
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-xl">
      <div className="space-y-2">
        <Label>ชื่อ Campaign</Label>
        <Input value={form.name} onChange={e => set('name', e.target.value)} required />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Target Type</Label>
          <Select value={form.targetType} onValueChange={v => set('targetType', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="CHANNEL">CHANNEL</SelectItem>
              <SelectItem value="BOT">BOT</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Target Name</Label>
          <Input value={form.targetName} onChange={e => set('targetName', e.target.value)} placeholder="@username" required />
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
        <Label>Budget รวม (TON)</Label>
        <Input
          type="number"
          step="0.001"
          value={form.budgetTon}
          onChange={e => set('budgetTon', e.target.value)}
          placeholder="100"
          required
        />
      </div>

      {isEdit && (
        <div className="space-y-2">
          <Label>Status</Label>
          <Select value={form.status} onValueChange={v => set('status', v)}>
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
        <Textarea value={form.note} onChange={e => set('note', e.target.value)} rows={3} />
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

- [ ] **Step 2: สร้าง Add Campaign page**

```tsx
// src/app/campaigns/new/page.tsx
import { CampaignForm } from '@/components/campaign-form'

export default function NewCampaignPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">สร้าง Campaign ใหม่</h1>
      <CampaignForm />
    </div>
  )
}
```

- [ ] **Step 3: สร้าง Edit Campaign page**

```tsx
// src/app/campaigns/[id]/edit/page.tsx
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { CampaignForm } from '@/components/campaign-form'

export const dynamic = 'force-dynamic'

export default async function EditCampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const campaign = await prisma.campaign.findUnique({ where: { id } })
  if (!campaign) notFound()

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">แก้ไข Campaign</h1>
      <CampaignForm
        initialData={{
          id: campaign.id,
          name: campaign.name,
          targetType: campaign.targetType,
          targetName: campaign.targetName,
          startDate: campaign.startDate.toISOString(),
          endDate: campaign.endDate?.toISOString() ?? null,
          budgetTon: campaign.budgetTon.toString(),
          status: campaign.status,
          note: campaign.note,
        }}
      />
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/campaign-form.tsx src/app/campaigns/new/ src/app/campaigns/
git commit -m "feat: add add/edit campaign forms"
```

---

## Task 13: Add Entry Form

**Files:**
- Create: `src/components/entry-form.tsx`
- Create: `src/app/campaigns/[id]/entries/new/page.tsx`

- [ ] **Step 1: สร้าง EntryForm component**

```tsx
// src/components/entry-form.tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { calcEntryMetrics } from '@/lib/metrics'

export function EntryForm({ campaignId }: { campaignId: string }) {
  const router = useRouter()
  const today = new Date().toISOString().split('T')[0]

  const [form, setForm] = useState({
    date: today,
    dailyBudgetTon: '',
    spendTon: '',
    tonPriceUsd: '',
    usdThbRate: '',
    impressions: '',
    views: '',
    clicks: '',
    joins: '',
    note: '',
  })
  const [fetchedAt, setFetchedAt] = useState('')
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(false)
  const [error, setError] = useState('')

  const fetchRates = useCallback(async () => {
    setFetching(true)
    try {
      const res = await fetch('/api/rates')
      if (res.ok) {
        const data = await res.json()
        setForm(f => ({
          ...f,
          tonPriceUsd: data.tonUsd.toFixed(4),
          usdThbRate: data.usdThb.toFixed(4),
        }))
        setFetchedAt(new Date(data.fetchedAt).toLocaleTimeString('th-TH'))
      }
    } finally {
      setFetching(false)
    }
  }, [])

  useEffect(() => { fetchRates() }, [fetchRates])

  function set(key: string, value: string) {
    setForm(f => ({ ...f, [key]: value }))
  }

  const preview = form.spendTon && form.dailyBudgetTon && form.tonPriceUsd && form.usdThbRate && form.impressions && form.clicks && form.joins
    ? calcEntryMetrics({
        spendTon: parseFloat(form.spendTon),
        dailyBudgetTon: parseFloat(form.dailyBudgetTon),
        tonPriceUsd: parseFloat(form.tonPriceUsd),
        usdThbRate: parseFloat(form.usdThbRate),
        impressions: parseInt(form.impressions),
        clicks: parseInt(form.clicks),
        joins: parseInt(form.joins),
      })
    : null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await fetch(`/api/campaigns/${campaignId}/entries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: form.date,
        dailyBudgetTon: parseFloat(form.dailyBudgetTon),
        spendTon: parseFloat(form.spendTon),
        tonPriceUsd: parseFloat(form.tonPriceUsd),
        usdThbRate: parseFloat(form.usdThbRate),
        impressions: parseInt(form.impressions),
        views: parseInt(form.views),
        clicks: parseInt(form.clicks),
        joins: parseInt(form.joins),
        note: form.note || null,
      }),
    })

    if (res.ok) {
      router.push(`/campaigns/${campaignId}`)
      router.refresh()
    } else {
      setError('เกิดข้อผิดพลาด ลองใหม่อีกครั้ง')
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-xl">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>วันที่</Label>
          <Input type="date" value={form.date} onChange={e => set('date', e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label>งบวันนี้ (TON)</Label>
          <Input type="number" step="0.001" value={form.dailyBudgetTon} onChange={e => set('dailyBudgetTon', e.target.value)} placeholder="10" required />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Spend จริง (TON)</Label>
        <Input type="number" step="0.001" value={form.spendTon} onChange={e => set('spendTon', e.target.value)} placeholder="8.5" required />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <Label>ราคา TON/USD</Label>
            <button type="button" onClick={fetchRates} disabled={fetching} className="text-xs text-blue-400 hover:underline">
              {fetching ? 'กำลังดึง...' : '↻ ดึงอัตโนมัติ'}
            </button>
          </div>
          <div className="relative">
            <Input type="number" step="0.0001" value={form.tonPriceUsd} onChange={e => set('tonPriceUsd', e.target.value)} placeholder="3.18" required />
            {fetchedAt && <span className="absolute right-3 top-2.5 text-xs text-green-500">{fetchedAt}</span>}
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <Label>อัตรา USD/THB</Label>
          </div>
          <Input type="number" step="0.0001" value={form.usdThbRate} onChange={e => set('usdThbRate', e.target.value)} placeholder="32.45" required />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Impressions</Label>
          <Input type="number" value={form.impressions} onChange={e => set('impressions', e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label>Views</Label>
          <Input type="number" value={form.views} onChange={e => set('views', e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label>Clicks</Label>
          <Input type="number" value={form.clicks} onChange={e => set('clicks', e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label>Joins</Label>
          <Input type="number" value={form.joins} onChange={e => set('joins', e.target.value)} required />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Note (optional)</Label>
        <Textarea value={form.note} onChange={e => set('note', e.target.value)} rows={2} />
      </div>

      {preview && (
        <div className="rounded-lg border border-green-800 bg-green-950/20 p-3 text-sm">
          <p className="text-xs text-muted-foreground mb-2">Preview</p>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <span>BSP: <strong>{preview.bsp.toFixed(1)}%</strong></span>
            <span>CTR: <strong>{preview.ctr.toFixed(2)}%</strong></span>
            <span>CR: <strong>{preview.cr.toFixed(2)}%</strong></span>
            <span>CPC: <strong>${preview.cpc.toFixed(4)}</strong></span>
            <span>CPS: <strong>${preview.cps.toFixed(4)}</strong></span>
            <span>CPM: <strong>${preview.cpm.toFixed(3)}</strong></span>
            <span className="col-span-3">มูลค่า: <strong>฿{preview.spendThb.toLocaleString('th-TH', { maximumFractionDigits: 0 })}</strong></span>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-3">
        <Button type="submit" disabled={loading}>
          {loading ? 'กำลังบันทึก...' : 'บันทึก Entry'}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          ยกเลิก
        </Button>
      </div>
    </form>
  )
}
```

- [ ] **Step 2: สร้าง Add Entry page**

```tsx
// src/app/campaigns/[id]/entries/new/page.tsx
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { EntryForm } from '@/components/entry-form'

export default async function NewEntryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const campaign = await prisma.campaign.findUnique({ where: { id } })
  if (!campaign) notFound()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">บันทึก Performance</h1>
        <p className="text-sm text-muted-foreground mt-1">{campaign.name} · {campaign.targetType} · {campaign.targetName}</p>
      </div>
      <EntryForm campaignId={id} />
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/entry-form.tsx src/app/campaigns/
git commit -m "feat: add entry form with auto rate fetching and metric preview"
```

---

## Task 14: Settings (Export / Import)

**Files:**
- Create: `src/app/settings/page.tsx`

- [ ] **Step 1: สร้าง Settings page**

```tsx
// src/app/settings/page.tsx
'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function SettingsPage() {
  const [importStatus, setImportStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle')
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleExport() {
    const res = await fetch('/api/export')
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ads-backup-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
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
              asChild
              variant="outline"
              disabled={importStatus === 'loading'}
            >
              <label htmlFor="import-file" className="cursor-pointer">
                {importStatus === 'loading' ? 'กำลัง import...' : 'Import JSON'}
              </label>
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

- [ ] **Step 2: Commit**

```bash
git add src/app/settings/
git commit -m "feat: add settings page with export/import JSON backup"
```

---

## Task 15: Docker + EasyPanel Config

**Files:**
- Create: `Dockerfile`
- Create: `docker-compose.yml`
- Create: `scripts/start.sh`

- [ ] **Step 1: สร้าง Dockerfile**

```dockerfile
# Dockerfile
FROM node:20-alpine AS base

FROM base AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/prisma ./prisma
COPY scripts/start.sh ./start.sh

RUN chmod +x start.sh
USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["./start.sh"]
```

- [ ] **Step 2: เปิดใช้ standalone output ใน next.config.ts**

```typescript
// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
}

export default nextConfig
```

- [ ] **Step 3: สร้าง startup script**

```bash
mkdir -p scripts
cat > scripts/start.sh << 'EOF'
#!/bin/sh
set -e
npx prisma migrate deploy
node server.js
EOF
chmod +x scripts/start.sh
```

- [ ] **Step 4: สร้าง docker-compose.yml**

```yaml
# docker-compose.yml
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB}
      APP_PASSWORD: ${APP_PASSWORD}
      JWT_SECRET: ${JWT_SECRET}
      EXCHANGE_RATE_API_KEY: ${EXCHANGE_RATE_API_KEY}
      NEXT_PUBLIC_APP_URL: ${NEXT_PUBLIC_APP_URL}
    depends_on:
      db:
        condition: service_healthy
    restart: unless-stopped

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      interval: 5s
      timeout: 5s
      retries: 5
    restart: unless-stopped

volumes:
  postgres_data:
```

- [ ] **Step 5: ทดสอบ build**

```bash
docker compose build
```

Expected: BUILD เสร็จโดยไม่มี error

- [ ] **Step 6: ทดสอบ run local**

```bash
# สร้าง .env จาก example ก่อน (ถ้ายังไม่มี)
cp .env.example .env
# แก้ค่า APP_PASSWORD และ JWT_SECRET ใน .env
docker compose up
```

เปิด http://localhost:3000 และทดสอบ login

- [ ] **Step 7: Commit**

```bash
git add Dockerfile docker-compose.yml next.config.ts scripts/
git commit -m "feat: add Docker and EasyPanel deployment configuration"
```

---

## Task 16: Run All Tests + Final Check

- [ ] **Step 1: รัน test ทั้งหมด**

```bash
npm test
```

Expected: PASS ทุก test (metrics, auth, rates, export)

- [ ] **Step 2: ตรวจสอบ TypeScript**

```bash
npx tsc --noEmit
```

Expected: ไม่มี error

- [ ] **Step 3: ทดสอบ flow หลักใน browser**

เปิด http://localhost:3000 และทดสอบ:
- Login ด้วย password ที่ตั้งไว้ใน .env
- สร้าง campaign ใหม่ (CHANNEL type)
- เพิ่ม performance entry (กดดึง rate อัตโนมัติ)
- ตรวจสอบว่า metric cards แสดงถูกต้อง
- Export JSON → ดาวน์โหลดได้
- Import JSON กลับมา

- [ ] **Step 4: Commit สุดท้าย**

```bash
git add -A
git commit -m "chore: final cleanup and all tests passing"
```

- [ ] **Step 5: Push ขึ้น Git**

```bash
git remote add origin <your-repo-url>
git push -u origin main
```

---

## EasyPanel Deployment Steps

หลัง push ขึ้น Git:

1. เข้า EasyPanel → Create Project → App
2. เลือก Docker Compose → ชี้ไปที่ repo
3. ตั้งค่า Environment Variables ทุกตัวใน .env.example
4. กด Deploy
5. รอ build เสร็จ → เปิด domain ที่ EasyPanel กำหนดให้
