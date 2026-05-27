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
          <p className="text-xs text-muted-foreground mt-1">
            {todayHasData ? `วันนี้ ${todaySpend.toFixed(2)} TON` : '—'}
          </p>
        </div>
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
      </div>

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

      {/* Trend Chart */}
      <DashboardChart chartData={chartData} />
    </div>
  )
}
