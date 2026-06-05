import { prisma } from '@/lib/prisma'
import { calcEntryMetrics } from '@/lib/metrics'
import { GoalsClient } from './goals-client'

export const dynamic = 'force-dynamic'

export default async function GoalsPage() {
  const [globalGoal, campaigns, goalEntries] = await Promise.all([
    prisma.globalGoal.findUnique({ where: { id: 1 } }),
    prisma.campaign.findMany({
      where: { status: { notIn: ['CANCELLED', 'DONE'] } },
      include: { entries: { orderBy: { date: 'desc' } } },
      orderBy: [{ status: 'asc' }, { startDate: 'desc' }],
    }),
    prisma.globalGoalEntry.findMany({
      orderBy: { date: 'desc' },
      include: { campaigns: true },
    }),
  ])

  return (
    <GoalsClient
      globalNote={globalGoal?.note ?? null}
      campaigns={campaigns.map(c => {
        const last = c.entries[0]
        const lastMetrics = last ? calcEntryMetrics({
          spendTon: Number(last.spendTon),
          dailyBudgetTon: Number(last.dailyBudgetTon),
          tonPriceUsd: Number(last.tonPriceUsd),
          usdThbRate: Number(last.usdThbRate),
          impressions: last.impressions,
          views: last.views,
          clicks: last.clicks,
          joins: last.joins,
        }) : null
        return {
          id: c.id,
          name: c.name,
          status: c.status,
          targetType: c.targetType,
          startDate: c.startDate.toISOString(),
          endDate: c.endDate?.toISOString() ?? null,
          targetDate: c.targetDate?.toISOString() ?? null,
          targetJoins: c.targetJoins ?? null,
          goalText: c.goalText ?? null,
          planText: c.planText ?? null,
          budgetTon: c.budgetTon ? Number(c.budgetTon) : null,
          dailyBudgetTon: Number(c.dailyBudgetTon),
          totalJoins: c.entries.reduce((s, e) => s + e.joins, 0),
          bidCpmTon: c.bidCpmTon ? Number(c.bidCpmTon) : null,
          lastBsp: lastMetrics?.bsp ?? null,
          lastCps: lastMetrics?.cps ?? null,
        }
      })}
      goalEntries={goalEntries.map(e => ({
        id: e.id,
        date: e.date.toISOString(),
        baseline: e.baseline ?? null,
        goalText: e.goalText ?? null,
        successCriteria: e.successCriteria ?? null,
        constraints: e.constraints ?? null,
        planText: e.planText ?? null,
        risks: e.risks ?? null,
        doneCriteria: e.doneCriteria ?? null,
        targetText: e.targetText ?? null,
        deadline: e.deadline?.toISOString() ?? null,
        campaignIds: e.campaigns.map(c => c.campaignId),
        createdAt: e.createdAt.toISOString(),
      }))}
    />
  )
}
