import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { CampaignForm } from '@/components/campaign-form'

export const dynamic = 'force-dynamic'

export default async function EditCampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [campaign, allPlacements] = await Promise.all([
    prisma.campaign.findUnique({
      where: { id },
      include: { placements: { include: { placement: true } } },
    }),
    prisma.placement.findMany({ orderBy: { name: 'asc' } }),
  ])
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
          bidCpmTon: campaign.bidCpmTon?.toString() ?? '',
          budgetTon: campaign.budgetTon?.toString() ?? '',
          status: campaign.status,
          note: campaign.note,
          placementName: campaign.placementName ?? '',
          placementType: campaign.placementType ?? null,
          placements: campaign.placements.map(cp => ({
            placementId: cp.placementId,
            placement: { id: cp.placement.id, name: cp.placement.name, type: cp.placement.type ?? null },
          })),
        }}
        allPlacements={allPlacements.map(p => ({ id: p.id, name: p.name, type: p.type ?? null }))}
      />
    </div>
  )
}
