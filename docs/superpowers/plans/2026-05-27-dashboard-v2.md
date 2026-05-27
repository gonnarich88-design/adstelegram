# Dashboard V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign dashboard เป็น Layout C — Hero Summary Bar + 2-column body (WoW Strip ซ้าย, Campaign Leaderboard 3×2 ขวา) + Trend Chart

**Architecture:** แก้เพียง `src/app/page.tsx` ไฟล์เดียว ทั้งหมดเป็น Server Component ไม่มี schema/API/component ใหม่ ลบ Budget Alerts + Top Performers + Wallet Card เดิม + KPI Cards grid เดิม แล้วแทนด้วย 3 sections ใหม่

**Tech Stack:** Next.js 16 App Router (Server Component), Prisma, Tailwind CSS v4, TypeScript strict

---

## File Map

| File | Action |
|------|--------|
| `src/app/page.tsx` | Modify — ลบ 4 sections เดิม, เพิ่ม Hero + WoW + Leaderboard |

---

## Task 1: Hero Summary Bar

**Files:**
- Modify: `src/app/page.tsx`

ลบ Wallet Card JSX, KPI Cards grid JSX, Budget Alerts JSX, Top Performers JSX และ computation ที่ไม่ใช้แล้ว แล้วเพิ่ม Hero bar

- [ ] **Step 1: ลบ campaignAlerts computation และ type ออก**

ใน `src/app/page.tsx` ลบบล็อกตั้งแต่ `type AlertLevel = 'critical'...` จนถึง `.sort((a, b) => ({ critical: 0, warning: 1, ok: 2 }[a.level]...))` ออกทั้งหมด

- [ ] **Step 2: ลบ campaignStats / bestCps / mostJoins / bestCtr computation ออก**

ลบบล็อกตั้งแต่ `interface CampaignStat {` จนถึง `const bestCtr = ...` ออกทั้งหมด

- [ ] **Step 3: ลบ JSX sections ที่ไม่ต้องการออก**

ใน return JSX ลบ:
- `{/* Wallet Card */}` block ทั้งหมด (ตั้งแต่ `{walletBalance > 0 && (` จนถึง `</div>)}` ของ wallet)
- `{/* KPI Cards — always show */}` block ทั้งหมด (grid 5 cards)
- `{/* Budget Alerts */}` block ทั้งหมด
- `{/* Top Performers */}` block ทั้งหมด

- [ ] **Step 4: เพิ่ม Hero Summary Bar JSX หลัง `<h1 className="text-2xl font-bold">Dashboard</h1>`**

```tsx
      {/* Hero Summary Bar */}
      <div className="rounded-lg border bg-muted/10 px-6 py-4">
        <div className={`grid gap-0 divide-x divide-border ${walletBalance > 0 ? 'grid-cols-5' : 'grid-cols-4'}`}>
          <div className="pr-6">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Total {joinsLabel}</p>
            <p className="text-3xl font-bold mt-1">{summary ? summary.totalJoins.toLocaleString() : '0'}</p>
            <p className={`text-xs mt-1 ${!todayHasData ? 'text-muted-foreground' : todayJoins > 0 ? 'text-green-400' : 'text-muted-foreground'}`}>
              {todayHasData ? (todayJoins > 0 ? `▲ +${todayJoins} วันนี้` : '0 วันนี้') : '—'}
            </p>
          </div>
          <div className="px-6">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Avg CPS</p>
            <p className="text-3xl font-bold mt-1">{cpsThb !== null ? `฿${cpsThb.toFixed(0)}` : '—'}</p>
            <p className="text-xs text-muted-foreground mt-1">cost per {joinsLabel.toLowerCase()}</p>
            {todayCpsThb !== null && yesterdayCpsThb !== null ? (
              <p className={`text-xs font-medium ${todayCpsThb < yesterdayCpsThb ? 'text-green-400' : todayCpsThb > yesterdayCpsThb ? 'text-red-400' : 'text-muted-foreground'}`}>
                ฿{yesterdayCpsThb.toFixed(0)} → ฿{todayCpsThb.toFixed(0)}
              </p>
            ) : null}
          </div>
          <div className="px-6">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Spend</p>
            <p className="text-3xl font-bold mt-1">{summary ? summary.totalSpendTon.toFixed(2) : '0.00'} <span className="text-lg font-normal text-muted-foreground">TON</span></p>
            <p className="text-xs text-muted-foreground mt-1">≈ ฿{summary ? summary.spendThb.toLocaleString('th-TH', { maximumFractionDigits: 0 }) : '0'}</p>
            <p className="text-xs text-muted-foreground">{todayHasData ? `วันนี้ ${todaySpend.toFixed(2)} TON` : '—'}</p>
          </div>
          <div className={walletBalance > 0 ? 'px-6' : 'pl-6'}>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Avg CTR</p>
            <p className="text-3xl font-bold text-blue-400 mt-1">{summary ? summary.ctr.toFixed(2) : '0.00'}%</p>
            <p className="text-xs text-muted-foreground mt-1">{summary ? summary.totalViews.toLocaleString() : '0'} views</p>
          </div>
          {walletBalance > 0 && (
            <div className="pl-6">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">
                <a href="/wallet" className="hover:text-blue-400">Wallet</a>
              </p>
              <p className="text-3xl font-bold mt-1">{walletBalance.toFixed(2)} <span className="text-lg font-normal text-muted-foreground">TON</span></p>
              {currentRate && <p className="text-xs text-muted-foreground mt-1">1 TON = ฿{currentRate.usdThbRate.toFixed(2)}</p>}
              {daysLeft !== null ? (
                <p className={`text-xs font-medium ${daysLeft <= 7 ? 'text-destructive' : daysLeft <= 14 ? 'text-yellow-400' : 'text-green-400'}`}>
                  ~{daysLeft} วัน · {burnRate7d.toFixed(2)} TON/วัน
                </p>
              ) : <p className="text-xs text-muted-foreground">—</p>}
            </div>
          )}
        </div>
      </div>
```

- [ ] **Step 5: ตรวจ TypeScript**

```bash
npx tsc --noEmit
```

Expected: ไม่มี error

- [ ] **Step 6: ตรวจ tests**

```bash
npm test
```

Expected: 51 passed

- [ ] **Step 7: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: replace wallet+kpi cards with hero summary bar"
```

---

## Task 2: WoW Strip

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: เพิ่ม WoW computation หลัง yesterdayCpsThb block**

```typescript
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
  const thisWeekEntries = allRawEntries.filter(e => new Date(e.date) >= sevenDaysAgo)
  const lastWeekEntries = allRawEntries.filter(e => {
    const d = new Date(e.date)
    return d >= fourteenDaysAgo && d < sevenDaysAgo
  })
  const wowJoinsA = thisWeekEntries.reduce((s, e) => s + e.joins, 0)
  const wowJoinsB = lastWeekEntries.reduce((s, e) => s + e.joins, 0)
  const wowSpendA = thisWeekEntries.reduce((s, e) => s + Number(e.spendTon), 0)
  const wowSpendB = lastWeekEntries.reduce((s, e) => s + Number(e.spendTon), 0)
  const wowCpsA = (() => {
    const thb = thisWeekEntries.reduce((s, e) => s + Number(e.spendTon) * Number(e.tonPriceUsd) * Number(e.usdThbRate), 0)
    return wowJoinsA > 0 ? thb / wowJoinsA : null
  })()
  const wowCpsB = (() => {
    const thb = lastWeekEntries.reduce((s, e) => s + Number(e.spendTon) * Number(e.tonPriceUsd) * Number(e.usdThbRate), 0)
    return wowJoinsB > 0 ? thb / wowJoinsB : null
  })()
  const wowCtrA = (() => {
    const v = thisWeekEntries.reduce((s, e) => s + e.views, 0)
    const c = thisWeekEntries.reduce((s, e) => s + e.clicks, 0)
    return v > 0 ? (c / v) * 100 : null
  })()
  const wowCtrB = (() => {
    const v = lastWeekEntries.reduce((s, e) => s + e.views, 0)
    const c = lastWeekEntries.reduce((s, e) => s + e.clicks, 0)
    return v > 0 ? (c / v) * 100 : null
  })()
  const hasWowData = lastWeekEntries.length > 0
```

- [ ] **Step 2: เพิ่ม WoW JSX และ Leaderboard placeholder หลัง Hero bar**

เพิ่มหลัง Hero Summary Bar block ก่อน `{/* Trend Chart */}`:

```tsx
      {/* 2-column body */}
      {(hasWowData) && (
        <div className="grid grid-cols-3 gap-4">
          {/* WoW Strip — col-span-1 */}
          <div className="rounded-lg border p-4 space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">สัปดาห์นี้ vs ที่แล้ว</p>
            {[
              {
                label: joinsLabel,
                a: wowJoinsA, b: wowJoinsB,
                fmt: (v: number) => v.toLocaleString(),
                goodUp: true,
              },
              {
                label: 'CPS ฿',
                a: wowCpsA, b: wowCpsB,
                fmt: (v: number) => `฿${v.toFixed(0)}`,
                goodUp: false,
              },
              {
                label: 'Spend TON',
                a: wowSpendA, b: wowSpendB,
                fmt: (v: number) => v.toFixed(2),
                goodUp: false,
              },
              {
                label: 'CTR%',
                a: wowCtrA, b: wowCtrB,
                fmt: (v: number) => `${v.toFixed(2)}%`,
                goodUp: true,
              },
            ].map(({ label, a, b, fmt, goodUp }) => {
              if (a === null || b === null) return null
              const pct = b !== 0 ? ((a - b) / b) * 100 : null
              const up = (a as number) > (b as number)
              const good = goodUp ? up : !up
              const color = pct === null || pct === 0 ? 'text-muted-foreground' : good ? 'text-green-400' : 'text-red-400'
              return (
                <div key={label} className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <div className="text-right">
                    <p className={`text-sm font-semibold ${color}`}>
                      {fmt(a as number)} {pct !== null ? `${up ? '↑' : '↓'} ${Math.abs(pct).toFixed(0)}%` : ''}
                    </p>
                    <p className="text-xs text-muted-foreground">vs {fmt(b as number)}</p>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Leaderboard placeholder — col-span-2 */}
          <div className="col-span-2" id="leaderboard-placeholder" />
        </div>
      )}
```

- [ ] **Step 3: ตรวจ TypeScript**

```bash
npx tsc --noEmit
```

Expected: ไม่มี error

- [ ] **Step 4: ตรวจ tests**

```bash
npm test
```

Expected: 51 passed

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: add week-over-week strip to dashboard"
```

---

## Task 3: Campaign Leaderboard 3×2

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: เพิ่ม stats7d computation หลัง hasWowData**

```typescript
  interface CampaignStat7d {
    id: string
    name: string
    joins: number
    spendThb: number
    clicks: number
    views: number
    cpsThb: number | null
    ctr: number | null
  }
  const stats7d: CampaignStat7d[] = campaigns
    .filter(c => c.status === 'ACTIVE' || c.status === 'PAUSED')
    .map(c => {
      const e7d = c.entries.filter(e => new Date(e.date) >= sevenDaysAgo)
      const joins = e7d.reduce((s, e) => s + e.joins, 0)
      const clicks = e7d.reduce((s, e) => s + e.clicks, 0)
      const views = e7d.reduce((s, e) => s + e.views, 0)
      const spendThb = e7d.reduce((s, e) => s + Number(e.spendTon) * Number(e.tonPriceUsd) * Number(e.usdThbRate), 0)
      return {
        id: c.id,
        name: c.name,
        joins,
        spendThb,
        clicks,
        views,
        cpsThb: joins > 0 ? spendThb / joins : null,
        ctr: views > 0 ? (clicks / views) * 100 : null,
      }
    })
    .filter(c => c.joins > 0 || c.views > 0)

  const top3 = <T,>(arr: T[], key: (x: T) => number, asc = false): T[] =>
    [...arr].sort((a, b) => asc ? key(a) - key(b) : key(b) - key(a)).slice(0, 3)

  const lb = {
    joins: top3(stats7d, x => x.joins),
    cps: top3(stats7d.filter(x => x.cpsThb !== null), x => x.cpsThb!, true),
    spend: top3(stats7d, x => x.spendThb),
    ctr: top3(stats7d.filter(x => x.ctr !== null), x => x.ctr!),
    clicks: top3(stats7d, x => x.clicks),
    views: top3(stats7d, x => x.views),
  }
  const hasLeaderboard = stats7d.length > 0
```

- [ ] **Step 2: แทน leaderboard-placeholder div ด้วย Leaderboard JSX**

แทน `<div className="col-span-2" id="leaderboard-placeholder" />` ด้วย:

```tsx
          {/* Leaderboard — col-span-2 */}
          {hasLeaderboard && (
            <div className="col-span-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Campaign Leaderboard — 7 วันล่าสุด</p>
              <div className="grid grid-cols-3 gap-3">
                {([
                  { icon: '👥', label: joinsLabel, data: lb.joins, fmt: (x: CampaignStat7d) => x.joins.toLocaleString(), color: 'text-green-400' },
                  { icon: '🏆', label: 'CPS ฿ (ต่ำ=ดี)', data: lb.cps, fmt: (x: CampaignStat7d) => `฿${x.cpsThb!.toFixed(0)}`, color: 'text-amber-400' },
                  { icon: '💸', label: 'Spend ฿', data: lb.spend, fmt: (x: CampaignStat7d) => `฿${x.spendThb.toLocaleString('th-TH', { maximumFractionDigits: 0 })}`, color: 'text-orange-400' },
                  { icon: '👆', label: 'CTR%', data: lb.ctr, fmt: (x: CampaignStat7d) => `${x.ctr!.toFixed(2)}%`, color: 'text-purple-400' },
                  { icon: '🖱', label: 'Clicks', data: lb.clicks, fmt: (x: CampaignStat7d) => x.clicks.toLocaleString(), color: 'text-sky-400' },
                  { icon: '👁', label: 'Views', data: lb.views, fmt: (x: CampaignStat7d) => x.views.toLocaleString(), color: 'text-blue-400' },
                ] as const).map(({ icon, label, data, fmt, color }) => (
                  data.length > 0 && (
                    <div key={label} className="rounded-lg border p-3">
                      <p className={`text-xs font-semibold uppercase tracking-wide mb-2 ${color}`}>{icon} {label}</p>
                      <div className="space-y-1.5">
                        {data.map((c, i) => (
                          <div key={c.id} className="flex items-center justify-between gap-2">
                            <span className="text-xs text-muted-foreground">{['🥇','🥈','🥉'][i]}</span>
                            <span className="text-xs text-blue-400 truncate flex-1">{c.name}</span>
                            <span className={`text-xs font-medium ${i === 0 ? color : 'text-muted-foreground'}`}>{fmt(c)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                ))}
              </div>
            </div>
          )}
```

- [ ] **Step 3: แก้ 2-column body condition ให้รองรับ leaderboard-only case**

หา `{(hasWowData) && (` แล้วแทนด้วย:

```tsx
      {(hasWowData || hasLeaderboard) && (
```

- [ ] **Step 4: ลบ `activeCampaigns` และ `totalCampaigns` variables ถ้าไม่ได้ใช้แล้ว**

ตรวจว่า `activeCampaigns` และ `totalCampaigns` ยังมีใน JSX มั้ย ถ้าไม่มีแล้ว (เพราะ KPI card เดิมถูกลบ) ให้ลบ:

```typescript
  // ลบบรรทัดนี้ถ้าไม่มีที่ใช้แล้ว
  const activeCampaigns = campaigns.filter(c => c.status === 'ACTIVE').length
  const totalCampaigns = campaigns.length
```

- [ ] **Step 5: ตรวจ TypeScript**

```bash
npx tsc --noEmit
```

Expected: ไม่มี error

- [ ] **Step 6: ตรวจ tests**

```bash
npm test
```

Expected: 51 passed

- [ ] **Step 7: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: add campaign leaderboard 3x2 to dashboard"
```

---

## Task 4: Smoke Test + Push

- [ ] **Step 1: รัน dev server**

```bash
npm run dev
```

- [ ] **Step 2: เปิด http://localhost:3000 ตรวจสอบ**

| จุดตรวจ | ผลที่ควรได้ |
|---------|-----------|
| Hero bar แสดง 5 slots | Joins / CPS / Spend / CTR / Wallet (ถ้า balance > 0) |
| Hero bar แสดง 4 slots | ถ้า wallet balance = 0 |
| WoW strip | แสดงถ้ามีข้อมูล 7 วันที่แล้ว, ซ่อนถ้าไม่มี |
| Leaderboard 6 boxes | แสดง Top 3 ต่อ metric ถ้ามีข้อมูล 7 วัน |
| Leaderboard ซ่อน | ถ้าไม่มี ACTIVE/PAUSED campaign ที่มีข้อมูล 7 วัน |
| Trend Chart | ยังอยู่ด้านล่าง ไม่เปลี่ยนแปลง |
| ไม่มี Budget Alerts | section หายไปแล้ว |
| ไม่มี Top Performers 3 cards | section หายไปแล้ว |

- [ ] **Step 3: อัปเดต PROGRESS.md**

เพิ่มใน "เสร็จแล้ว":
```
- [x] **Dashboard V2** — Hero Summary Bar (5 slots) + WoW Strip + Campaign Leaderboard 3×2 (Joins/CPS/Spend/CTR/Clicks/Views) — layout C, ลบ Budget Alerts + Top Performers + Wallet Card + KPI grid เดิม — browser verified ✅ (session 18)
```

- [ ] **Step 4: Push**

```bash
git push
```
