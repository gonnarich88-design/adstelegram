import { prisma } from '@/lib/prisma'
import { CampaignList } from '@/components/campaign-list'
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'

export const dynamic = 'force-dynamic'

export default async function CampaignsPage() {
  const campaigns = await prisma.campaign.findMany({
    include: {
      entries: { orderBy: { date: 'asc' } },
      allocations: true,
      placements: { include: { placement: true } },
    },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
  })

  const serialized = campaigns.map(c => ({
    id: c.id,
    name: c.name,
    targetType: c.targetType,
    targetName: c.targetName,
    startDate: c.startDate.toISOString(),
    endDate: c.endDate?.toISOString() ?? null,
    budgetTon: c.budgetTon?.toString() ?? null,
    dailyBudgetTon: c.dailyBudgetTon.toString(),
    bidCpmTon: c.bidCpmTon?.toString() ?? null,
    status: c.status,
    placementName: c.placementName ?? null,
    placementType: c.placementType ?? null,
    placements: c.placements.map(cp => ({
      placementId: cp.placementId,
      placement: { id: cp.placement.id, name: cp.placement.name, type: cp.placement.type ?? null },
    })),
    note: c.note ?? null,
    goalText: c.goalText ?? null,
    planText: c.planText ?? null,
    targetJoins: c.targetJoins ?? null,
    targetDate: c.targetDate?.toISOString() ?? null,
    sortOrder: c.sortOrder,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
    entries: c.entries.map(e => ({
      id: e.id,
      campaignId: e.campaignId,
      date: e.date.toISOString(),
      spendTon: e.spendTon.toString(),
      dailyBudgetTon: e.dailyBudgetTon.toString(),
      tonPriceUsd: e.tonPriceUsd.toString(),
      usdThbRate: e.usdThbRate.toString(),
      impressions: e.impressions,
      views: e.views,
      clicks: e.clicks,
      joins: e.joins,
      note: e.note ?? null,
    })),
    allocations: c.allocations.map(a => ({
      id: a.id,
      depositId: a.depositId,
      campaignId: a.campaignId,
      amountTon: a.amountTon.toString(),
    })),
  }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Campaigns</h1>
        <Link href="/campaigns/new" className={buttonVariants({ size: 'sm' })}>
          + Campaign
        </Link>
      </div>

      {campaigns.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="mb-4">ยังไม่มี campaign</p>
          <Link href="/campaigns/new" className={buttonVariants()}>
            สร้าง campaign แรก
          </Link>
        </div>
      ) : (
        <CampaignList campaigns={serialized} />
      )}
    </div>
  )
}
