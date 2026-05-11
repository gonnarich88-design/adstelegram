import { prisma } from './prisma'

export interface ExportData {
  version: number
  exportedAt: string
  campaigns: any[]
}

export async function exportData(): Promise<ExportData> {
  const campaigns = await prisma.campaign.findMany({
    include: { entries: { orderBy: { date: 'asc' } } },
    orderBy: { createdAt: 'asc' },
  })

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    campaigns: campaigns.map(c => ({
      ...c,
      budgetTon: c.budgetTon.toString(),
      startDate: c.startDate.toISOString(),
      endDate: c.endDate?.toISOString() ?? null,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
      entries: (c.entries as any[]).map((e: any) => ({
        ...e,
        spendTon: e.spendTon.toString(),
        dailyBudgetTon: e.dailyBudgetTon.toString(),
        tonPriceUsd: e.tonPriceUsd.toString(),
        usdThbRate: e.usdThbRate.toString(),
        date: e.date.toISOString(),
        createdAt: e.createdAt.toISOString(),
      })),
    })),
  }
}

export async function importData(data: ExportData): Promise<void> {
  await prisma.$transaction(async tx => {
    await tx.performanceEntry.deleteMany()
    await tx.campaign.deleteMany()

    for (const c of data.campaigns) {
      await tx.campaign.create({
        data: {
          id: c.id,
          name: c.name,
          targetType: c.targetType,
          targetName: c.targetName,
          startDate: new Date(c.startDate),
          endDate: c.endDate ? new Date(c.endDate) : null,
          budgetTon: c.budgetTon,
          status: c.status,
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
  })
}
