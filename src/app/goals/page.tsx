import { prisma } from '@/lib/prisma'
import { GoalsClient } from './goals-client'

export const dynamic = 'force-dynamic'

export default async function GoalsPage() {
  const [globalGoal, campaigns] = await Promise.all([
    prisma.globalGoal.findUnique({ where: { id: 1 } }),
    prisma.campaign.findMany({
      where: { status: { notIn: ['CANCELLED', 'DONE'] } },
      include: { entries: true },
      orderBy: [{ status: 'asc' }, { startDate: 'desc' }],
    }),
  ])

  return (
    <GoalsClient
      globalNote={globalGoal?.note ?? null}
      campaigns={campaigns.map(c => ({
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
        totalJoins: c.entries.reduce((s: number, e: any) => s + e.joins, 0),
      }))}
    />
  )
}
