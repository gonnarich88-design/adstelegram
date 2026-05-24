import { prisma } from './prisma'

export interface ExportData {
  version: number
  exportedAt: string
  walletDeposits?: any[]
  campaignAllocations?: any[]
  walletBalanceTon?: string
  campaigns: any[]
}

export async function exportData(): Promise<ExportData> {
  const [campaigns, walletDeposits, campaignAllocations] = await Promise.all([
    prisma.campaign.findMany({
      include: { entries: { orderBy: { date: 'asc' } } },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.walletDeposit.findMany({ orderBy: { depositedAt: 'asc' } }),
    prisma.campaignAllocation.findMany(),
  ])

  return {
    version: 2,
    exportedAt: new Date().toISOString(),
    walletDeposits: walletDeposits.map(d => ({
      id: d.id,
      amountTon: d.amountTon.toString(),
      tonPriceUsd: d.tonPriceUsd.toString(),
      usdThbRate: d.usdThbRate.toString(),
      depositedAt: d.depositedAt.toISOString(),
      note: d.note,
      createdAt: d.createdAt.toISOString(),
    })),
    campaignAllocations: campaignAllocations.map(a => ({
      id: a.id,
      depositId: a.depositId,
      campaignId: a.campaignId,
      amountTon: a.amountTon.toString(),
      createdAt: a.createdAt.toISOString(),
    })),
    campaigns: campaigns.map(c => ({
      id: c.id,
      name: c.name,
      targetType: c.targetType,
      targetName: c.targetName,
      budgetTon: c.budgetTon?.toString() ?? null,
      dailyBudgetTon: c.dailyBudgetTon.toString(),
      startDate: c.startDate.toISOString(),
      endDate: c.endDate?.toISOString() ?? null,
      status: c.status,
      placementName: c.placementName,
      note: c.note,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
      entries: (c.entries as any[]).map((e: any) => ({
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
        note: e.note,
        createdAt: e.createdAt.toISOString(),
      })),
    })),
  }
}

export async function importData(data: ExportData): Promise<void> {
  await prisma.$transaction(async tx => {
    await tx.campaignAllocation.deleteMany()
    await tx.performanceEntry.deleteMany()
    await tx.campaign.deleteMany()
    await tx.walletDeposit.deleteMany()

    for (const c of data.campaigns) {
      await tx.campaign.create({
        data: {
          id: c.id,
          name: c.name,
          targetType: c.targetType,
          targetName: c.targetName,
          startDate: new Date(c.startDate),
          endDate: c.endDate ? new Date(c.endDate) : null,
          dailyBudgetTon: c.dailyBudgetTon ?? 0,
          budgetTon: c.budgetTon ?? null,
          status: c.status,
          placementName: c.placementName ?? null,
          note: c.note,
          entries: {
            create: c.entries.map((e: any) => ({
              id: e.id,
              date: new Date(e.date),
              spendTon: e.spendTon,
              dailyBudgetTon: e.dailyBudgetTon,
              tonPriceUsd: e.tonPriceUsd,
              usdThbRate: e.usdThbRate,
              impressions: e.impressions,
              views: e.views,
              clicks: e.clicks,
              joins: e.joins,
              note: e.note,
            })),
          },
        },
      })
    }

    for (const d of data.walletDeposits ?? []) {
      await tx.walletDeposit.create({
        data: {
          id: d.id,
          amountTon: d.amountTon,
          tonPriceUsd: d.tonPriceUsd,
          usdThbRate: d.usdThbRate,
          depositedAt: new Date(d.depositedAt),
          note: d.note ?? null,
        },
      })
    }

    for (const a of data.campaignAllocations ?? []) {
      await tx.campaignAllocation.create({
        data: {
          id: a.id,
          depositId: a.depositId,
          campaignId: a.campaignId,
          amountTon: a.amountTon,
        },
      })
    }
  })
}
