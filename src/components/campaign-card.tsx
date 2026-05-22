import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { calcAggregateMetrics } from '@/lib/metrics'

const STATUS_COLORS = {
  ACTIVE: 'default',
  PAUSED: 'secondary',
  DONE: 'outline',
} as const

function fmt(n: number, digits = 2) {
  return n.toFixed(digits)
}

export function CampaignCard({ campaign }: { campaign: any }) {
  const metrics = campaign.entries.length > 0
    ? calcAggregateMetrics(campaign.entries.map((e: any) => ({
        spendTon: Number(e.spendTon),
        dailyBudgetTon: Number(e.dailyBudgetTon),
        tonPriceUsd: Number(e.tonPriceUsd),
        usdThbRate: Number(e.usdThbRate),
        impressions: e.impressions,
        views: e.views,
        clicks: e.clicks,
        joins: e.joins,
      })))
    : null

  const dailyBudget = Number(campaign.dailyBudgetTon)
  const avgBsp = metrics?.bsp ?? 0
  const bspPct = Math.min(avgBsp, 100)

  return (
    <Link href={`/campaigns/${campaign.id}`}>
      <Card className="hover:border-foreground/30 transition-colors cursor-pointer">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-base">{campaign.name}</CardTitle>
            <Badge variant={STATUS_COLORS[campaign.status as keyof typeof STATUS_COLORS]}>
              {campaign.status}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            โปรโมต: {campaign.targetType} · {campaign.targetName}
          </p>
          {campaign.placementName && (
            <p className="text-xs text-muted-foreground">ปลายทาง: {campaign.placementName}</p>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>Daily Budget</span>
              <span>{fmt(dailyBudget, 2)} TON/วัน</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${bspPct}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">Avg BSP {fmt(avgBsp, 1)}%</p>
          </div>
          {metrics && (
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <p className="text-muted-foreground">CTR</p>
                <p className="font-medium">{fmt(metrics.ctr, 2)}%</p>
              </div>
              <div>
                <p className="text-muted-foreground">CPS</p>
                <p className="font-medium">฿{metrics.totalJoins > 0 ? fmt(metrics.spendThb / metrics.totalJoins, 2) : '—'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">{campaign.targetType === 'BOT' ? 'Startbot' : 'Joins'}</p>
                <p className="font-medium">{metrics.totalJoins.toLocaleString()}</p>
              </div>
            </div>
          )}
          {!metrics && (
            <p className="text-xs text-muted-foreground">ยังไม่มีข้อมูล</p>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}
