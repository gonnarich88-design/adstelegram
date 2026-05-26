import { prisma } from '@/lib/prisma'
import { computeWalletBalance, findCurrentRate } from '@/lib/wallet'
import { WalletClient } from './wallet-client'

export const dynamic = 'force-dynamic'

export default async function WalletPage() {
  const [deposits, allCampaigns, campaignSpends] = await Promise.all([
    prisma.walletDeposit.findMany({
      include: {
        allocations: {
          include: { campaign: { select: { id: true, name: true } } },
        },
        refundCampaign: { select: { name: true } },
      },
      orderBy: { depositedAt: 'desc' },
    }),
    prisma.campaign.findMany({
      select: { id: true, name: true, status: true, allocations: { select: { amountTon: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.performanceEntry.groupBy({
      by: ['campaignId'],
      _sum: { spendTon: true },
    }),
  ])

  const spendMap = new Map(
    campaignSpends.map(s => [s.campaignId, Number(s._sum.spendTon ?? 0)])
  )

  const allAllocations = deposits.flatMap(d =>
    d.allocations.map(a => ({ depositId: a.depositId, amountTon: Number(a.amountTon) }))
  )

  const depositsNormalized = deposits.map(d => ({
    id: d.id,
    amountTon: Number(d.amountTon),
    depositedAt: d.depositedAt,
    tonPriceUsd: Number(d.tonPriceUsd),
    usdThbRate: Number(d.usdThbRate),
  }))

  const balance = computeWalletBalance(depositsNormalized, allAllocations)
  const currentRate = findCurrentRate(depositsNormalized, allAllocations)

  const depositsForClient = deposits.map(d => {
    const allocated = d.allocations.reduce((s, a) => s + Number(a.amountTon), 0)
    return {
      id: d.id,
      amountTon: Number(d.amountTon),
      tonPriceUsd: Number(d.tonPriceUsd),
      usdThbRate: Number(d.usdThbRate),
      depositedAt: d.depositedAt.toISOString(),
      createdAt: d.createdAt.toISOString(),
      note: d.note,
      type: d.type,
      refundCampaignName: d.refundCampaign?.name ?? null,
      remaining: Number(d.amountTon) - allocated,
      allocations: d.allocations.map(a => ({
        id: a.id,
        campaignId: a.campaignId,
        campaignName: a.campaign.name,
        amountTon: Number(a.amountTon),
        allocatedAt: a.allocatedAt.toISOString(),
        createdAt: a.createdAt.toISOString(),
        totalSpendTon: spendMap.get(a.campaignId) ?? 0,
        tonPriceUsd: Number(d.tonPriceUsd),
        usdThbRate: Number(d.usdThbRate),
      })),
    }
  })

  const balanceThb = depositsForClient.reduce(
    (s, d) => s + d.remaining * d.tonPriceUsd * d.usdThbRate, 0
  )

  return (
    <WalletClient
      balance={balance}
      balanceThb={balanceThb}
      currentRate={currentRate}
      deposits={depositsForClient}
      availableCampaigns={allCampaigns
        .filter(c => c.status === 'ACTIVE' || c.status === 'PAUSED')
        .map(c => ({
          id: c.id,
          name: c.name,
          status: c.status,
          currentAllocationTon: c.allocations.length > 0
            ? c.allocations.reduce((s, a) => s + Number(a.amountTon), 0)
            : undefined,
        }))}
    />
  )
}
