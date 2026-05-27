import { prisma } from '@/lib/prisma'
import { CampaignCard } from '@/components/campaign-card'
import { calcAggregateMetrics } from '@/lib/metrics'
import { computeWalletBalance, findCurrentRate } from '@/lib/wallet'
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'

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
  const channelCampaigns = campaigns.filter(c => c.targetType === 'CHANNEL')
  const botCampaigns = campaigns.filter(c => c.targetType === 'BOT')

  const depositsNum = deposits.map(d => ({ ...d, amountTon: Number(d.amountTon), tonPriceUsd: Number(d.tonPriceUsd), usdThbRate: Number(d.usdThbRate) }))
  const allocationsNum = deposits.flatMap(d => d.allocations).map(a => ({ depositId: a.depositId, amountTon: Number(a.amountTon) }))
  const walletBalance = computeWalletBalance(depositsNum, allocationsNum)
  const currentRate = findCurrentRate(depositsNum, allocationsNum)

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const recentSpend = campaigns
    .flatMap(c => c.entries)
    .filter(e => new Date(e.date) >= sevenDaysAgo)
    .reduce((sum, e) => sum + Number(e.spendTon), 0)
  const burnRate7d = recentSpend / 7
  const daysLeft = burnRate7d > 0 ? Math.floor(walletBalance / burnRate7d) : null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <Link href="/campaigns/new" className={buttonVariants({ size: 'sm' })}>+ Campaign</Link>
      </div>

      {walletBalance > 0 && (
        <div className="rounded-lg border p-4 bg-muted/20">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground mb-0.5">
                TON Wallet · <Link href="/wallet" className="text-blue-400 hover:underline">ดูรายละเอียด</Link>
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
              {daysLeft !== null && (
                <p className="text-sm text-muted-foreground mt-0.5">
                  คงเหลือประมาณ{' '}
                  <span className={`font-medium ${daysLeft <= 7 ? 'text-destructive' : daysLeft <= 14 ? 'text-yellow-400' : 'text-green-400'}`}>
                    {daysLeft} วัน
                  </span>
                </p>
              )}
              {daysLeft === null && (
                <p className="text-sm text-muted-foreground mt-0.5">ไม่มีข้อมูล 7 วันล่าสุด</p>
              )}
            </div>
          </div>
        </div>
      )}

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
            <p className="text-sm text-muted-foreground">{summary.totalViews.toLocaleString()} views</p>
          </div>
        </div>
      )}

      {campaigns.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="mb-4">ยังไม่มี campaign</p>
          <Link href="/campaigns/new" className={buttonVariants()}>สร้าง campaign แรก</Link>
        </div>
      ) : (
        <div className="space-y-8">
          {channelCampaigns.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <h2 className="text-lg font-semibold">CHANNEL</h2>
                <span className="text-sm text-muted-foreground">· {channelCampaigns.length}</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {channelCampaigns.map(c => (
                  <CampaignCard key={c.id} campaign={c} />
                ))}
              </div>
            </div>
          )}
          {botCampaigns.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <h2 className="text-lg font-semibold">BOT</h2>
                <span className="text-sm text-muted-foreground">· {botCampaigns.length}</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {botCampaigns.map(c => (
                  <CampaignCard key={c.id} campaign={c} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
