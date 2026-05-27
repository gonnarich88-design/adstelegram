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

  const cpsThb =
    summary && summary.totalJoins > 0
      ? summary.spendThb / summary.totalJoins
      : null

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
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Total Joins</p>
          <p className="text-2xl font-bold">
            {summary ? summary.totalJoins.toLocaleString() : '0'}
          </p>
          <p className="text-sm text-muted-foreground">รวม CHANNEL + BOT</p>
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
          <p className="text-sm text-muted-foreground">cost per join</p>
        </div>
      </div>

      {/* Trend Chart */}
      <DashboardChart chartData={chartData} />
    </div>
  )
}
