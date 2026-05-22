import { prisma } from '@/lib/prisma'
import { CampaignCard } from '@/components/campaign-card'
import { calcAggregateMetrics } from '@/lib/metrics'
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'

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
        <Link href="/campaigns/new" className={buttonVariants({ size: 'sm' })}>+ Campaign</Link>
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {campaigns.map(c => (
            <CampaignCard key={c.id} campaign={c} />
          ))}
        </div>
      )}
    </div>
  )
}
