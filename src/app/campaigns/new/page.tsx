import { prisma } from '@/lib/prisma'
import { CampaignForm } from '@/components/campaign-form'

export const dynamic = 'force-dynamic'

export default async function NewCampaignPage() {
  const allPlacements = await prisma.placement.findMany({ orderBy: { name: 'asc' } })
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">สร้าง Campaign ใหม่</h1>
      <CampaignForm
        allPlacements={allPlacements.map(p => ({ id: p.id, name: p.name, type: p.type ?? null }))}
      />
    </div>
  )
}
