import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { TabsClient } from './tabs-client'

export default async function NewEntryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const campaign = await prisma.campaign.findUnique({ where: { id } })
  if (!campaign) notFound()

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
      />
    </div>
  )
}
