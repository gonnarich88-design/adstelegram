import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { CampaignForm } from '@/components/campaign-form'

export const dynamic = 'force-dynamic'

export default async function EditCampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const campaign = await prisma.campaign.findUnique({ where: { id } })
  if (!campaign) notFound()

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">แก้ไข Campaign</h1>
      <CampaignForm
        initialData={{
          id: campaign.id,
          name: campaign.name,
          targetType: campaign.targetType,
          targetName: campaign.targetName,
          startDate: campaign.startDate.toISOString(),
          endDate: campaign.endDate?.toISOString() ?? null,
          dailyBudgetTon: campaign.dailyBudgetTon.toString(),
          budgetTon: campaign.budgetTon?.toString() ?? '',
          status: campaign.status,
          note: campaign.note,
        }}
      />
    </div>
  )
}
