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

  const channelCampaigns = campaigns.filter(c => c.targetType === 'CHANNEL')
  const botCampaigns = campaigns.filter(c => c.targetType === 'BOT')

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
          {channelCampaigns.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Channel</h2>
                <span className="text-xs text-muted-foreground">· {channelCampaigns.length}</span>
              </div>
              <div className="space-y-1.5">
                {channelCampaigns.map(c => (
                  <CampaignRow key={c.id} campaign={c} />
                ))}
              </div>
            </div>
          )}
          {botCampaigns.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Bot</h2>
                <span className="text-xs text-muted-foreground">· {botCampaigns.length}</span>
              </div>
              <div className="space-y-1.5">
                {botCampaigns.map(c => (
                  <CampaignRow key={c.id} campaign={c} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
