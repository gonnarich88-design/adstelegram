import { prisma } from '@/lib/prisma'
import { CampaignRow } from '@/components/campaign-row'
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'

export const dynamic = 'force-dynamic'

export default async function CampaignsPage() {
  const campaigns = await prisma.campaign.findMany({
    include: {
      entries: { orderBy: { date: 'asc' } },
      allocations: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  const active = campaigns.filter(c => c.status !== 'CANCELLED')
  const channelCampaigns = active.filter(c => c.placementType === 'CHANNEL')
  const botCampaigns = active.filter(c => c.placementType === 'BOT')
  const searchCampaigns = active.filter(c => c.placementType === 'SEARCH')
  const unknownCampaigns = active.filter(c => !c.placementType)
  const cancelledCampaigns = campaigns.filter(c => c.status === 'CANCELLED')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Campaigns</h1>
        <Link href="/campaigns/new" className={buttonVariants({ size: 'sm' })}>
          + Campaign
        </Link>
      </div>

      {campaigns.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="mb-4">ยังไม่มี campaign</p>
          <Link href="/campaigns/new" className={buttonVariants()}>
            สร้าง campaign แรก
          </Link>
        </div>
      ) : (
        <div className="space-y-8">
          {[
            { label: 'Channels', items: channelCampaigns },
            { label: 'Bots', items: botCampaigns },
            { label: 'Search', items: searchCampaigns },
            { label: 'ไม่ระบุ', items: unknownCampaigns },
            { label: 'Cancelled', items: cancelledCampaigns },
          ].map(({ label, items }) =>
            items.length > 0 ? (
              <div key={label}>
                <div className="flex items-center gap-2 mb-3">
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{label}</h2>
                  <span className="text-xs text-muted-foreground">· {items.length}</span>
                </div>
                <div className="space-y-1.5">
                  {items.map(c => (
                    <CampaignRow key={c.id} campaign={c} />
                  ))}
                </div>
              </div>
            ) : null
          )}
        </div>
      )}
    </div>
  )
}
