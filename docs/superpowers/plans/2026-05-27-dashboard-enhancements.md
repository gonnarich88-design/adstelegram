# Dashboard Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เพิ่ม 3 sections ใน Dashboard — delta indicators บน KPI cards, Budget Alerts, และ Top Performers 7d

**Architecture:** คำนวณทั้งหมด server-side ใน `page.tsx` จาก data ที่ fetch ครั้งเดียวอยู่แล้ว ไม่มีไฟล์ใหม่ ไม่มี API ใหม่ ไม่มี schema change

**Tech Stack:** Next.js 16 App Router (Server Component), Prisma, Tailwind CSS v4, TypeScript strict

---

## File Map

| File | Action | รายละเอียด |
|------|--------|-----------|
| `src/app/page.tsx` | Modify | เพิ่ม computation 3 blocks + render 3 sections ใหม่ใน JSX |

---

## Task 1: Delta Indicators บน KPI Cards

**Files:**
- Modify: `src/app/page.tsx`

เพิ่ม delta "วันนี้" ใต้ KPI card 3 ใบ: Total Spend (informational), Total Startbot/Joins (▲ count), Avg CPS (yesterday→today comparison)

- [ ] **Step 1: เพิ่ม allRawEntries + today/yesterday computation หลัง `cpsThb`**

เปิด `src/app/page.tsx` หา block `const cpsThb = ...` (ประมาณบรรทัด 96) แล้วเพิ่มด้านล่าง:

```typescript
  const allRawEntries = campaigns.flatMap(c => c.entries)
  const todayStr = new Date().toISOString().slice(0, 10)
  const yesterdayStr = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
  const todayEntries = allRawEntries.filter(e => e.date.toISOString().slice(0, 10) === todayStr)
  const yesterdayEntries = allRawEntries.filter(e => e.date.toISOString().slice(0, 10) === yesterdayStr)

  const todaySpend = todayEntries.reduce((s, e) => s + Number(e.spendTon), 0)
  const todayJoins = todayEntries.reduce((s, e) => s + e.joins, 0)
  const todayHasData = todayEntries.length > 0

  const todayCpsThb = (() => {
    const thb = todayEntries.reduce((s, e) => s + Number(e.spendTon) * Number(e.tonPriceUsd) * Number(e.usdThbRate), 0)
    const j = todayEntries.reduce((s, e) => s + e.joins, 0)
    return j > 0 ? thb / j : null
  })()
  const yesterdayCpsThb = (() => {
    const thb = yesterdayEntries.reduce((s, e) => s + Number(e.spendTon) * Number(e.tonPriceUsd) * Number(e.usdThbRate), 0)
    const j = yesterdayEntries.reduce((s, e) => s + e.joins, 0)
    return j > 0 ? thb / j : null
  })()
```

- [ ] **Step 2: อัปเดต Total Spend card ใน JSX**

หา block `<div className="rounded-lg border p-4">` ที่มี `Total Spend` แล้วแทนด้วย:

```tsx
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Total Spend</p>
          <p className="text-2xl font-bold">
            {summary ? summary.totalSpendTon.toFixed(2) : '0.00'} TON
          </p>
          <p className="text-sm text-muted-foreground">
            ≈ ฿{summary ? summary.spendThb.toLocaleString('th-TH', { maximumFractionDigits: 0 }) : '0'}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {todayHasData ? `วันนี้ ${todaySpend.toFixed(2)} TON` : '—'}
          </p>
        </div>
```

- [ ] **Step 3: อัปเดต Total Startbot/Joins card**

หา block ที่มี `Total {joinsLabel}` แล้วแทนด้วย:

```tsx
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Total {joinsLabel}</p>
          <p className="text-2xl font-bold">
            {summary ? summary.totalJoins.toLocaleString() : '0'}
          </p>
          {targetTypes.size > 1 && (
            <p className="text-sm text-muted-foreground">รวม CHANNEL + BOT</p>
          )}
          <p className={`text-xs mt-1 ${
            !todayHasData ? 'text-muted-foreground'
            : todayJoins > 0 ? 'text-green-400'
            : 'text-muted-foreground'
          }`}>
            {todayHasData ? (todayJoins > 0 ? `▲ +${todayJoins} วันนี้` : `0 วันนี้`) : '—'}
          </p>
        </div>
```

- [ ] **Step 4: อัปเดต Avg CPS card**

หา block ที่มี `Avg CPS` แล้วแทนด้วย:

```tsx
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Avg CPS</p>
          <p className="text-2xl font-bold">
            {cpsThb !== null ? `฿${cpsThb.toFixed(2)}` : '—'}
          </p>
          <p className="text-sm text-muted-foreground">cost per {joinsLabel.toLowerCase()}</p>
          {todayCpsThb !== null && yesterdayCpsThb !== null ? (
            <p className={`text-xs mt-1 font-medium ${
              todayCpsThb < yesterdayCpsThb ? 'text-green-400'
              : todayCpsThb > yesterdayCpsThb ? 'text-red-400'
              : 'text-muted-foreground'
            }`}>
              ฿{yesterdayCpsThb.toFixed(0)} → ฿{todayCpsThb.toFixed(0)}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground mt-1">—</p>
          )}
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

Expected: 51 passed (ไม่มี test ใหม่ เพราะ logic อยู่ใน Server Component)

- [ ] **Step 7: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: add today delta indicators to KPI cards"
```

---

## Task 2: Budget Alerts

**Files:**
- Modify: `src/app/page.tsx`

เพิ่ม section แสดง ACTIVE campaigns เรียงตาม urgency ของ budget ที่เหลือ

- [ ] **Step 1: เพิ่ม CampaignAlert type + computation หลัง yesterday delta block**

เพิ่มต่อจากโค้ด Task 1 ทันที (หลัง `yesterdayCpsThb`):

```typescript
  type AlertLevel = 'critical' | 'warning' | 'ok'
  interface CampaignAlert {
    id: string
    name: string
    targetName: string
    totalAllocatedTon: number
    totalSpentTon: number
    remainingTon: number
    daysLeft: number | null
    level: AlertLevel
  }

  const campaignAlerts: CampaignAlert[] = campaigns
    .filter(c => c.status === 'ACTIVE')
    .map(c => {
      const totalAllocatedTon = c.allocations.reduce((s, a) => s + Number(a.amountTon), 0)
      if (totalAllocatedTon === 0) return null
      const totalSpentTon = c.entries.reduce((s, e) => s + Number(e.spendTon), 0)
      const remainingTon = totalAllocatedTon - totalSpentTon
      const spend7d = c.entries
        .filter(e => new Date(e.date) >= sevenDaysAgo)
        .reduce((s, e) => s + Number(e.spendTon), 0)
      const burnRate7d = spend7d / 7
      const daysLeft = burnRate7d > 0 ? remainingTon / burnRate7d : null
      const level: AlertLevel =
        daysLeft !== null && daysLeft <= 3 ? 'critical'
        : daysLeft !== null && daysLeft <= 7 ? 'warning'
        : 'ok'
      return { id: c.id, name: c.name, targetName: c.targetName, totalAllocatedTon, totalSpentTon, remainingTon, daysLeft, level }
    })
    .filter((a): a is CampaignAlert => a !== null)
    .sort((a, b) => ({ critical: 0, warning: 1, ok: 2 }[a.level] - { critical: 0, warning: 1, ok: 2 }[b.level]))
```

- [ ] **Step 2: เพิ่ม Budget Alerts section ใน JSX ระหว่าง KPI cards กับ Trend Chart**

หา comment `{/* Trend Chart */}` ใน JSX แล้วแทรก block นี้ก่อน:

```tsx
      {/* Budget Alerts */}
      {campaignAlerts.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Budget Alerts</p>
          {campaignAlerts.map(alert => (
            <div
              key={alert.id}
              className={`flex items-center justify-between rounded-lg border px-4 py-3 ${
                alert.level === 'critical' ? 'border-red-900/50 bg-red-950/20'
                : alert.level === 'warning' ? 'border-amber-900/50 bg-amber-950/20'
                : 'border-green-900/50 bg-green-950/20'
              }`}
            >
              <div>
                <p className={`text-sm font-medium ${
                  alert.level === 'critical' ? 'text-red-300'
                  : alert.level === 'warning' ? 'text-amber-300'
                  : 'text-green-300'
                }`}>
                  {alert.name}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  ใช้ไป {alert.totalSpentTon.toFixed(2)}/{alert.totalAllocatedTon.toFixed(2)} TON
                  {alert.daysLeft !== null
                    ? ` · เหลือ ~${Math.ceil(alert.daysLeft)} วัน`
                    : ` · เหลือ ${alert.remainingTon.toFixed(2)} TON`}
                </p>
              </div>
              <span className={`text-xs font-semibold px-2 py-1 rounded ${
                alert.level === 'critical' ? 'bg-red-900 text-red-200'
                : alert.level === 'warning' ? 'bg-amber-900 text-amber-200'
                : 'bg-green-900 text-green-200'
              }`}>
                {alert.level === 'critical'
                  ? `Critical · ${Math.ceil(alert.daysLeft!)}d`
                  : alert.level === 'warning'
                  ? `Low · ${Math.ceil(alert.daysLeft!)}d`
                  : alert.daysLeft !== null ? `OK · ${Math.ceil(alert.daysLeft)}d` : 'OK'}
              </span>
            </div>
          ))}
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
git commit -m "feat: add budget alerts section to dashboard"
```

---

## Task 3: Top Performers (7d)

**Files:**
- Modify: `src/app/page.tsx`

เพิ่ม 3 cards แสดง campaign ที่ดีสุดใน 7 วันล่าสุด: Best CPS, Most Startbot/Joins, Best CTR

- [ ] **Step 1: เพิ่ม CampaignStat computation หลัง campaignAlerts block**

เพิ่มต่อจาก `campaignAlerts` computation:

```typescript
  interface CampaignStat {
    id: string
    name: string
    targetName: string
    joins: number
    cpsThb: number | null
    ctr: number | null
  }

  const campaignStats: CampaignStat[] = campaigns
    .filter(c => c.status === 'ACTIVE' || c.status === 'PAUSED')
    .map(c => {
      const entries7d = c.entries.filter(e => new Date(e.date) >= sevenDaysAgo)
      const spendThb7d = entries7d.reduce((s, e) => s + Number(e.spendTon) * Number(e.tonPriceUsd) * Number(e.usdThbRate), 0)
      const joins = entries7d.reduce((s, e) => s + e.joins, 0)
      const views = entries7d.reduce((s, e) => s + e.views, 0)
      const clicks = entries7d.reduce((s, e) => s + e.clicks, 0)
      return {
        id: c.id,
        name: c.name,
        targetName: c.targetName,
        joins,
        cpsThb: joins > 0 ? spendThb7d / joins : null,
        ctr: views > 0 ? (clicks / views) * 100 : null,
      }
    })
    .filter(c => c.joins > 0 || c.ctr !== null)

  const bestCps = campaignStats.filter(c => c.cpsThb !== null).sort((a, b) => a.cpsThb! - b.cpsThb!)[0] ?? null
  const mostJoins = campaignStats.length > 0 ? [...campaignStats].sort((a, b) => b.joins - a.joins)[0] : null
  const bestCtr = campaignStats.filter(c => c.ctr !== null).sort((a, b) => b.ctr! - a.ctr!)[0] ?? null
```

- [ ] **Step 2: เพิ่ม Top Performers section ใน JSX ระหว่าง Budget Alerts กับ Trend Chart**

หา comment `{/* Trend Chart */}` แล้วแทรกก่อน (หลัง Budget Alerts block):

```tsx
      {/* Top Performers */}
      {campaignStats.length > 0 && (
        <div>
          <p className="text-sm font-medium text-muted-foreground mb-3">Top Performers (7 วันล่าสุด)</p>
          <div className="grid grid-cols-3 gap-4">
            {bestCps && (
              <div className="rounded-lg border border-t-2 border-t-amber-500 p-4 bg-muted/10">
                <p className="text-base mb-1">🏆</p>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Best CPS</p>
                <p className="text-sm font-semibold mt-1 truncate">{bestCps.name}</p>
                <p className="text-xl font-bold text-amber-400 mt-1">฿{bestCps.cpsThb!.toFixed(0)}</p>
                <p className="text-xs text-muted-foreground">{bestCps.joins.toLocaleString()} {joinsLabel.toLowerCase()}</p>
              </div>
            )}
            {mostJoins && (
              <div className="rounded-lg border border-t-2 border-t-blue-500 p-4 bg-muted/10">
                <p className="text-base mb-1">📈</p>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Most {joinsLabel}</p>
                <p className="text-sm font-semibold mt-1 truncate">{mostJoins.name}</p>
                <p className="text-xl font-bold text-blue-400 mt-1">{mostJoins.joins.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">ใน 7 วันล่าสุด</p>
              </div>
            )}
            {bestCtr && (
              <div className="rounded-lg border border-t-2 border-t-purple-500 p-4 bg-muted/10">
                <p className="text-base mb-1">🎯</p>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Best CTR</p>
                <p className="text-sm font-semibold mt-1 truncate">{bestCtr.name}</p>
                <p className="text-xl font-bold text-purple-400 mt-1">{bestCtr.ctr!.toFixed(2)}%</p>
                <p className="text-xs text-muted-foreground">{bestCtr.targetName}</p>
              </div>
            )}
          </div>
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
git commit -m "feat: add top performers 7d section to dashboard"
```

---

## Task 4: Smoke Test + Push

- [ ] **Step 1: รัน dev server**

```bash
npm run dev
```

- [ ] **Step 2: เปิด http://localhost:3000 แล้วตรวจสอบ**

| จุดตรวจ | ผลที่ควรได้ |
|---------|-----------|
| Delta ใต้ Total Spend | แสดง `วันนี้ X.XX TON` หรือ `—` ถ้าไม่มี entry วันนี้ |
| Delta ใต้ Total Startbot | `▲ +X วันนี้` (เขียว) หรือ `—` |
| Delta ใต้ Avg CPS | `฿X → ฿X` พร้อมสีหรือ `—` |
| Budget Alerts section | แสดงเฉพาะ ACTIVE campaigns ที่มี allocation เรียง critical ก่อน |
| Top Performers | แสดง 3 cards หรือน้อยกว่าถ้าข้อมูลไม่พอ |
| ไม่มี ACTIVE campaigns | Alerts section ซ่อน |
| Layout | Wallet → KPI → Alerts → Top Performers → Chart |

- [ ] **Step 3: อัปเดต PROGRESS.md**

เพิ่มใน "เสร็จแล้ว":
```
- [x] **Dashboard Enhancements** — delta indicators บน KPI cards (วันนี้ vs เมื่อวาน), Budget Alerts (critical/warning/ok เรียง urgency), Top Performers 7d (Best CPS, Most Startbot/Joins, Best CTR) — browser verified ✅ (session 17)
```

- [ ] **Step 4: Push**

```bash
git push
```
