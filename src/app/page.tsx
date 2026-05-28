import { prisma } from '@/lib/prisma'
import { calcAggregateMetrics } from '@/lib/metrics'
import { computeWalletBalance, findCurrentRate } from '@/lib/wallet'
import { groupEntriesByDate } from '@/lib/chart'
import { DashboardChart } from '@/components/dashboard-chart'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const [campaigns, deposits, last30Conversions] = await Promise.all([
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
    prisma.dailyConversion.findMany({
      where: { date: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
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

  // Chart data — date serialized to string (ISO YYYY-MM-DD) before passing to Client Component
  const chartData = groupEntriesByDate(
    campaigns.flatMap(c =>
      c.entries.map(e => ({
        date: e.date,
        spendTon: Number(e.spendTon),
        joins: e.joins,
        targetType: c.targetType,
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

  const targetTypes = new Set(campaigns.map(c => c.targetType))
  const joinsLabel =
    targetTypes.size === 0 ? 'Joins'
    : targetTypes.size === 1 && targetTypes.has('BOT') ? 'Startbot'
    : targetTypes.size === 1 ? 'Joins'
    : 'Joins / Startbot'

  const cpsThb =
    summary && summary.totalJoins > 0
      ? summary.spendThb / summary.totalJoins
      : null

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

  // WoW computation
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

  // Leaderboard computation
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

  // Conversion strip (30d)
  const hasConversionData = last30Conversions.length > 0
  const conversionStrip = hasConversionData ? (() => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const totalRegistrations = last30Conversions.reduce((s, r) => s + r.registrations, 0)
    const totalDepositCount = last30Conversions.reduce((s, r) => s + r.depositCount, 0)
    const totalDepositAmountThb = last30Conversions.reduce((s, r) => s + Number(r.depositAmountThb), 0)
    const last30SpendThb = allRawEntries
      .filter(e => new Date(e.date) >= thirtyDaysAgo)
      .reduce((s, e) => s + Number(e.spendTon) * Number(e.tonPriceUsd) * Number(e.usdThbRate), 0)
    return {
      totalRegistrations,
      totalDepositCount,
      totalDepositAmountThb,
      cpr: totalRegistrations > 0 ? last30SpendThb / totalRegistrations : null,
      cpd: totalDepositCount > 0 ? last30SpendThb / totalDepositCount : null,
    }
  })() : null

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

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
                <Link href="/wallet" className="hover:text-blue-400">Wallet</Link>
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

      {/* Conversion Strip */}
      {conversionStrip && (
        <div className="rounded-lg border bg-muted/5 px-6 py-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
            Conversions — 30 วันล่าสุด
          </p>
          <div className="grid grid-cols-2 gap-0 divide-x divide-border sm:grid-cols-4">
            <div className="pr-6">
              <p className="text-xs text-muted-foreground">สมัครสมาชิก</p>
              <p className="text-2xl font-bold text-green-400 mt-0.5">
                {conversionStrip.totalRegistrations.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">คน</p>
            </div>
            <div className="px-6">
              <p className="text-xs text-muted-foreground">ฝากเงิน</p>
              <p className="text-2xl font-bold text-blue-400 mt-0.5">
                {conversionStrip.totalDepositCount.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">
                คน · ฿{Math.round(conversionStrip.totalDepositAmountThb).toLocaleString('th-TH')}
              </p>
            </div>
            <div className="px-6">
              <p className="text-xs text-muted-foreground">CPR</p>
              <p className="text-2xl font-bold text-amber-400 mt-0.5">
                {conversionStrip.cpr !== null ? `฿${Math.round(conversionStrip.cpr).toLocaleString('th-TH')}` : '—'}
              </p>
              <p className="text-xs text-muted-foreground">/สมัคร</p>
            </div>
            <div className="pl-6">
              <p className="text-xs text-muted-foreground">CPD</p>
              <p className="text-2xl font-bold text-amber-400 mt-0.5">
                {conversionStrip.cpd !== null ? `฿${Math.round(conversionStrip.cpd).toLocaleString('th-TH')}` : '—'}
              </p>
              <p className="text-xs text-muted-foreground">/ฝาก</p>
            </div>
          </div>
        </div>
      )}

      {/* 2-column body */}
      {(hasWowData || hasLeaderboard) && (
        <div className="grid grid-cols-3 gap-4">
          {/* WoW Strip — col-span-1 */}
          {hasWowData && (
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
          )}

          {/* Leaderboard — col-span-2 */}
          {hasLeaderboard && (
            <div className={hasWowData ? 'col-span-2' : 'col-span-3'}>
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
        </div>
      )}

      {/* Trend Chart */}
      <DashboardChart chartData={chartData} />
    </div>
  )
}
