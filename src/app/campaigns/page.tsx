import { prisma } from '@/lib/prisma'
import { CampaignCard } from '@/components/campaign-card'
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

  // Auto-stop campaigns whose allocated budget is fully spent
  const depletedIds = campaigns
    .filter(c => {
      if (c.status !== 'ACTIVE') return false
      const allocated = c.allocations.reduce((s, a) => s + Number(a.amountTon), 0)
      if (allocated === 0) return false
      const spent = c.entries.reduce((s, e) => s + Number(e.spendTon), 0)
      return spent >= allocated
    })
    .map(c => c.id)
  if (depletedIds.length > 0) {
    await prisma.campaign.updateMany({ where: { id: { in: depletedIds } }, data: { status: 'STOPPED' } })
    campaigns.forEach(c => { if (depletedIds.includes(c.id)) (c as { status: string }).status = 'STOPPED' })
  }

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
              <div className="flex items-center gap-2 mb-4">
                <h2 className="text-lg font-semibold">CHANNEL</h2>
                <span className="text-sm text-muted-foreground">· {channelCampaigns.length}</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {channelCampaigns.map(c => (
                  <CampaignCard key={c.id} campaign={c} />
                ))}
              </div>
            </div>
          )}
          {botCampaigns.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <h2 className="text-lg font-semibold">BOT</h2>
                <span className="text-sm text-muted-foreground">· {botCampaigns.length}</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {botCampaigns.map(c => (
                  <CampaignCard key={c.id} campaign={c} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
