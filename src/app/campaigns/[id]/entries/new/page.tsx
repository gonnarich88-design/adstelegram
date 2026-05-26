import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { computeFifoRate } from '@/lib/wallet'
import { TabsClient } from './tabs-client'

export const dynamic = 'force-dynamic'

export default async function NewEntryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: {
      allocations: { include: { deposit: true }, orderBy: { allocatedAt: 'asc' } },
      entries: { select: { spendTon: true } },
    },
  })
  if (!campaign) notFound()

  const totalSpentTon = campaign.entries.reduce((s, e) => s + Number(e.spendTon), 0)

  const fifoResult = computeFifoRate(
    campaign.allocations.map(a => ({
      amountTon: Number(a.amountTon),
      allocatedAt: a.allocatedAt,
      deposit: {
        tonPriceUsd: Number(a.deposit.tonPriceUsd),
        usdThbRate:  Number(a.deposit.usdThbRate),
        depositedAt: a.deposit.depositedAt,
      },
    })),
    totalSpentTon
  )

  const allocationRate = fifoResult ? {
    tonPriceUsd:  fifoResult.tonPriceUsd,
    usdThbRate:   fifoResult.usdThbRate,
    depositedAt:  fifoResult.depositedAt.toISOString(),
    remainingTon: fifoResult.remainingTon,
  } : undefined

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">บันทึก Performance</h1>
        <p className="text-sm text-muted-foreground mt-1">{campaign.name} · {campaign.targetType} · {campaign.targetName}</p>
      </div>
      <TabsClient
        campaignId={id}
        targetType={campaign.targetType}
        defaultDailyBudget={campaign.dailyBudgetTon ? campaign.dailyBudgetTon.toString() : undefined}
        allocationRate={allocationRate}
      />
    </div>
  )
}
