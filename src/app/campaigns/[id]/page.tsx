import { notFound } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { calcAggregateMetrics } from '@/lib/metrics'
import { MetricCards } from '@/components/metric-cards'
import { PerformanceTable } from '@/components/performance-table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export const dynamic = 'force-dynamic'

const STATUS_COLORS = { ACTIVE: 'default', PAUSED: 'secondary', DONE: 'outline' } as const

export default async function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: { entries: { orderBy: { date: 'desc' } } },
  })

  if (!campaign) notFound()

  const entriesForCalc = campaign.entries.map(e => ({
    spendTon: Number(e.spendTon),
    dailyBudgetTon: Number(e.dailyBudgetTon),
    tonPriceUsd: Number(e.tonPriceUsd),
    usdThbRate: Number(e.usdThbRate),
    impressions: e.impressions,
    views: e.views,
    clicks: e.clicks,
    joins: e.joins,
  }))

  const metrics = entriesForCalc.length > 0 ? calcAggregateMetrics(entriesForCalc) : null

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold">{campaign.name}</h1>
            <Badge variant={STATUS_COLORS[campaign.status as keyof typeof STATUS_COLORS]}>
              {campaign.status}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {campaign.targetType} · {campaign.targetName} ·{' '}
            เริ่ม {new Date(campaign.startDate).toLocaleDateString('th-TH')}
            {campaign.endDate && ` — ${new Date(campaign.endDate).toLocaleDateString('th-TH')}`}
          </p>
          <p className="text-sm text-muted-foreground">Budget: {Number(campaign.budgetTon).toFixed(2)} TON</p>
          {campaign.note && <p className="text-sm text-muted-foreground mt-1">{campaign.note}</p>}
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/campaigns/${id}/edit`}>แก้ไข</Link>
          </Button>
          <Button asChild size="sm">
            <Link href={`/campaigns/${id}/entries/new`}>+ บันทึกวันนี้</Link>
          </Button>
        </div>
      </div>

      {metrics ? (
        <MetricCards metrics={metrics} />
      ) : (
        <p className="text-sm text-muted-foreground">ยังไม่มีข้อมูล performance</p>
      )}

      <div>
        <h2 className="text-lg font-semibold mb-3">Performance Log</h2>
        <PerformanceTable entries={campaign.entries} />
      </div>
    </div>
  )
}
