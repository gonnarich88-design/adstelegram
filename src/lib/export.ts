import { prisma } from './prisma'

export interface ExportData {
  version: number
  exportedAt: string
  globalGoal?: { note: string | null } | null
  globalGoalEntries?: any[]
  walletDeposits?: any[]
  campaignAllocations?: any[]
  walletBalanceTon?: string
  campaigns: any[]
  placements?: any[]
  campaignPlacements?: any[]
  dailyConversions?: any[]
  dailyConversionBreakdowns?: any[]
  campaignChangeLogs?: any[]
}

export async function exportData(): Promise<ExportData> {
  const [campaigns, walletDeposits, campaignAllocations, dailyConversions, dailyConversionBreakdowns, campaignChangeLogs, globalGoal, globalGoalEntries, placements, campaignPlacements] = await Promise.all([
    prisma.campaign.findMany({
      include: { entries: { orderBy: { date: 'asc' } } },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.walletDeposit.findMany({ orderBy: { depositedAt: 'asc' } }),
    prisma.campaignAllocation.findMany(),
    prisma.dailyConversion.findMany({ orderBy: { date: 'asc' } }),
    prisma.dailyConversionBreakdown.findMany({ orderBy: { createdAt: 'asc' } }),
    prisma.campaignChangeLog.findMany({ orderBy: { changedAt: 'asc' } }),
    prisma.globalGoal.findUnique({ where: { id: 1 } }),
    prisma.globalGoalEntry.findMany({ orderBy: { date: 'asc' } }),
    prisma.placement.findMany({ orderBy: { name: 'asc' } }),
    prisma.campaignPlacement.findMany(),
  ])

  return {
    version: 2,
    exportedAt: new Date().toISOString(),
    globalGoal: globalGoal ? { note: globalGoal.note } : null,
    globalGoalEntries: globalGoalEntries.map(e => ({
      id: e.id,
      date: e.date.toISOString().slice(0, 10),
      baseline: e.baseline ?? null,
      goalText: e.goalText ?? null,
      successCriteria: e.successCriteria ?? null,
      constraints: e.constraints ?? null,
      planText: e.planText ?? null,
      risks: e.risks ?? null,
      doneCriteria: e.doneCriteria ?? null,
      targetText: e.targetText ?? null,
      deadline: e.deadline?.toISOString() ?? null,
      createdAt: e.createdAt.toISOString(),
    })),
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
      placementType: c.placementType ?? null,
      note: c.note,
      goalText: c.goalText ?? null,
      planText: c.planText ?? null,
      targetJoins: c.targetJoins ?? null,
      targetDate: c.targetDate?.toISOString() ?? null,
      sortOrder: c.sortOrder,
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
    placements: placements.map(p => ({
      id: p.id,
      name: p.name,
      type: p.type ?? null,
      note: p.note ?? null,
      createdAt: p.createdAt.toISOString(),
    })),
    campaignPlacements: campaignPlacements.map(cp => ({
      campaignId: cp.campaignId,
      placementId: cp.placementId,
    })),
    dailyConversions: dailyConversions.map(r => ({
      id: r.id,
      date: r.date.toISOString().slice(0, 10),
      registrations: r.registrations,
      depositCount: r.depositCount,
      depositTxCount: r.depositTxCount,
      depositAmountThb: r.depositAmountThb.toString(),
      note: r.note,
      createdAt: r.createdAt.toISOString(),
    })),
    dailyConversionBreakdowns: dailyConversionBreakdowns.map(b => ({
      id: b.id,
      conversionId: b.conversionId,
      channelName: b.channelName,
      campaignId: b.campaignId ?? null,
      registrations: b.registrations,
      depositCount: b.depositCount,
      depositTxCount: b.depositTxCount,
      depositAmountThb: b.depositAmountThb.toString(),
      createdAt: b.createdAt.toISOString(),
    })),
    campaignChangeLogs: campaignChangeLogs.map(l => ({
      id: l.id,
      campaignId: l.campaignId,
      changedAt: l.changedAt.toISOString(),
      field: l.field ?? null,
      oldValue: l.oldValue ?? null,
      newValue: l.newValue ?? null,
      note: l.note ?? null,
    })),
  }
}

export async function importData(data: ExportData): Promise<void> {
  await prisma.$transaction(async tx => {
    await tx.campaignChangeLog.deleteMany()
    await tx.campaignAllocation.deleteMany()
    await tx.campaignPlacement.deleteMany()
    await tx.performanceEntry.deleteMany()
    await tx.dailyConversionBreakdown.deleteMany()
    await tx.campaign.deleteMany()
    await tx.walletDeposit.deleteMany()
    await tx.dailyConversion.deleteMany()
    await tx.globalGoal.deleteMany()
    await tx.globalGoalEntry.deleteMany()
    await tx.placement.deleteMany()

    for (const p of data.placements ?? []) {
      await tx.placement.create({
        data: {
          id: p.id,
          name: p.name,
          type: p.type ?? null,
          note: p.note ?? null,
        },
      })
    }

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
          placementType: c.placementType ?? null,
          note: c.note,
          goalText: c.goalText ?? null,
          planText: c.planText ?? null,
          targetJoins: c.targetJoins ?? null,
          targetDate: c.targetDate ? new Date(c.targetDate) : null,
          sortOrder: c.sortOrder ?? 0,
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

    if (data.globalGoal) {
      await tx.globalGoal.upsert({
        where: { id: 1 },
        create: { id: 1, note: data.globalGoal.note ?? null },
        update: { note: data.globalGoal.note ?? null },
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

    for (const cp of data.campaignPlacements ?? []) {
      await tx.campaignPlacement.create({
        data: { campaignId: cp.campaignId, placementId: cp.placementId },
      })
    }

    for (const r of data.dailyConversions ?? []) {
      await tx.dailyConversion.create({
        data: {
          id: r.id,
          date: new Date(r.date),
          registrations: r.registrations ?? 0,
          depositCount: r.depositCount ?? 0,
          depositTxCount: r.depositTxCount ?? 0,
          depositAmountThb: r.depositAmountThb ?? 0,
          note: r.note ?? null,
        },
      })
    }

    for (const b of data.dailyConversionBreakdowns ?? []) {
      await tx.dailyConversionBreakdown.create({
        data: {
          id: b.id,
          conversionId: b.conversionId,
          channelName: b.channelName ?? b.campaignId ?? 'unknown',
          campaignId: b.campaignId ?? null,
          registrations: b.registrations ?? 0,
          depositCount: b.depositCount ?? 0,
          depositTxCount: b.depositTxCount ?? 0,
          depositAmountThb: b.depositAmountThb ?? 0,
        },
      })
    }

    for (const l of data.campaignChangeLogs ?? []) {
      await tx.campaignChangeLog.create({
        data: {
          id: l.id,
          campaignId: l.campaignId,
          changedAt: new Date(l.changedAt),
          field: l.field ?? null,
          oldValue: l.oldValue ?? null,
          newValue: l.newValue ?? null,
          note: l.note ?? null,
        },
      })
    }

    for (const e of data.globalGoalEntries ?? []) {
      await tx.globalGoalEntry.create({
        data: {
          id: e.id,
          date: new Date(e.date),
          baseline: e.baseline ?? null,
          goalText: e.goalText ?? null,
          successCriteria: e.successCriteria ?? null,
          constraints: e.constraints ?? null,
          planText: e.planText ?? null,
          risks: e.risks ?? null,
          doneCriteria: e.doneCriteria ?? null,
          targetText: e.targetText ?? null,
          deadline: e.deadline ? new Date(e.deadline) : null,
        },
      })
    }
  })
}
