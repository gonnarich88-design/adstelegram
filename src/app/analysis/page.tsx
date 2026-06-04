import { prisma } from '@/lib/prisma'
import { AnalysisClient } from './analysis-client'

export const dynamic = 'force-dynamic'

export default async function AnalysisPage() {
  const [overviewAnalysis, campaigns] = await Promise.all([
    prisma.aiAnalysis.findFirst({
      where: { type: 'OVERVIEW' },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.campaign.findMany({
      where: { status: { notIn: ['CANCELLED'] } },
      orderBy: [{ status: 'asc' }, { startDate: 'desc' }],
      include: {
        analyses: {
          where: { type: 'CAMPAIGN' },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    }),
  ])

  return (
    <AnalysisClient
      initialOverview={overviewAnalysis ? {
        id: overviewAnalysis.id,
        createdAt: overviewAnalysis.createdAt.toISOString(),
        result: overviewAnalysis.result,
        model: overviewAnalysis.model,
      } : null}
      campaigns={campaigns.map(c => ({
        id: c.id,
        name: c.name,
        status: c.status,
        targetType: c.targetType,
        latestAnalysis: c.analyses[0] ? {
          id: c.analyses[0].id,
          createdAt: c.analyses[0].createdAt.toISOString(),
          result: c.analyses[0].result,
          model: c.analyses[0].model,
        } : null,
      }))}
    />
  )
}
