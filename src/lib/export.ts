import { prisma } from './prisma'

export interface ExportData {
  version: number
  exportedAt: string
  walletDeposits?: any[]
  campaignAllocations?: any[]
  walletBalanceTon?: string
  campaigns: any[]
  dailyConversions?: any[]
}

export async function exportData(): Promise<ExportData> {
  const [campaigns, walletDeposits, campaignAllocations, dailyConversions] = await Promise.all([
    prisma.campaign.findMany({
      include: { entries: { orderBy: { date: 'asc' } } },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.walletDeposit.findMany({ orderBy: { depositedAt: 'asc' } }),
    prisma.campaignAllocation.findMany(),
    prisma.dailyConversion.findMany({ orderBy: { date: 'asc' } }),
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
      type: d.type,
      refundCampaignId: d.refundCampaignId ?? null,
      createdAt: d.createdAt.toISOString(),
    })),
    campaignAllocations: campaignAllocations.map(a => ({
      id: a.id,
      depositId: a.depositId,
      campaignId: a.campaignId,
      amountTon: a.amountTon.toString(),
      allocatedAt: a.allocatedAt.toISOString(),
      createdAt: a.createdAt.toISOString(),
    })),
    campaigns: campaigns.map(c => ({
      id: c.id,
      name: c.name,
      targetType: c.targetType,
      targetName: c.targetName,
      budgetTon: c.budgetTon?.toString() ?? null,
      dailyBudgetTon: c.dailyBudgetTon.toString(),
      bidCpmTon: c.bidCpmTon?.toString() ?? null,
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
    dailyConversions: dailyConversions.map(r => ({
      id: r.id,
      date: r.date.toISOString().slice(0, 10),
      registrations: r.registrations,
      depositCount: r.depositCount,
      depositAmountThb: r.depositAmountThb.toString(),
      note: r.note,
      createdAt: r.createdAt.toISOString(),
    })),
  }
}

export async function importData(data: ExportData): Promise<void> {
  await prisma.$transaction(async tx => {
    await tx.campaignAllocation.deleteMany()
    await tx.performanceEntry.deleteMany()
    await tx.campaign.deleteMany()
    await tx.walletDeposit.deleteMany()
    await tx.dailyConversion.deleteMany()

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
          bidCpmTon: c.bidCpmTon ?? null,
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
          type: d.type ?? 'DEPOSIT',
          refundCampaignId: d.refundCampaignId ?? null,
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
          ...(a.allocatedAt ? { allocatedAt: new Date(a.allocatedAt) } : {}),
        },
      })
    }

    for (const r of data.dailyConversions ?? []) {
      await tx.dailyConversion.create({
        data: {
          id: r.id,
          date: new Date(r.date),
          registrations: r.registrations ?? 0,
          depositCount: r.depositCount ?? 0,
          depositAmountThb: r.depositAmountThb ?? 0,
          note: r.note ?? null,
        },
      })
    }
  })
}
