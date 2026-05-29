import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { calcAggregateMetrics } from '@/lib/metrics'

const STATUS_CLASS: Record<string, string> = {
  ACTIVE: 'bg-green-600 text-white hover:bg-green-600',
  PAUSED: 'bg-secondary text-secondary-foreground hover:bg-secondary',
  STOPPED: 'bg-yellow-500 text-black hover:bg-yellow-500',
  DONE: 'border border-border bg-transparent text-foreground',
  CANCELLED: 'bg-destructive text-white hover:bg-destructive',
}

function fmt(n: number, digits = 2) {
  return n.toFixed(digits)
}

export function CampaignCard({ campaign }: { campaign: any }) {
  const campaignDailyBudget = Number(campaign.dailyBudgetTon)
  const bidCpmTon = campaign.bidCpmTon ? Number(campaign.bidCpmTon) : null
  const estimatedImpressions = bidCpmTon && bidCpmTon > 0
    ? Math.round((campaignDailyBudget / bidCpmTon) * 1000)
    : null

  const metrics = campaign.entries.length > 0
    ? calcAggregateMetrics(campaign.entries.map((e: any) => ({
        spendTon: Number(e.spendTon),
        dailyBudgetTon: Number(e.dailyBudgetTon) || campaignDailyBudget,
        tonPriceUsd: Number(e.tonPriceUsd),
        usdThbRate: Number(e.usdThbRate),
        impressions: e.impressions,
        views: e.views,
        clicks: e.clicks,
        joins: e.joins,
      })))
    : null

  const avgBsp = metrics?.bsp ?? 0
  const bspPct = Math.min(avgBsp, 100)

  const budgetTon = campaign.budgetTon ? Number(campaign.budgetTon) : null
  const totalSpentTon = metrics?.totalSpendTon ?? 0
  const budgetUsedPct = budgetTon && budgetTon > 0 ? Math.min((totalSpentTon / budgetTon) * 100, 100) : null

  return (
    <Link href={`/campaigns/${campaign.id}`}>
      <Card className="hover:border-foreground/30 transition-colors cursor-pointer">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-base">{campaign.name}</CardTitle>
            <Badge className={STATUS_CLASS[campaign.status] ?? ''}>
              {campaign.status}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            โปรโมต: {campaign.targetType} · {campaign.targetName}
            {campaign.placementType && (
              <span className="ml-1 px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">
                {campaign.placementType === 'CHANNEL' ? 'Channels' : campaign.placementType === 'BOT' ? 'Bots' : 'Search'}
              </span>
            )}
          </p>
          {campaign.placementName && (
            <p className="text-xs text-muted-foreground">ปลายทาง: {campaign.placementName}</p>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          <div className={bidCpmTon !== null ? 'grid grid-cols-2 gap-3' : undefined}>
            <div>
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>Daily Budget</span>
                <span>{fmt(campaignDailyBudget, 2)} TON/วัน</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${bspPct}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">Avg BSP {fmt(avgBsp, 1)}%</p>
            </div>
            {bidCpmTon !== null && (
              <div>
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>CPM Bid</span>
                  <span>{bidCpmTon.toFixed(4)} TON</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden" />
                {estimatedImpressions !== null && (
                  <p className="text-xs text-muted-foreground mt-1">
                    ~{estimatedImpressions.toLocaleString('th-TH')} imp/วัน
                  </p>
                )}
              </div>
            )}
          </div>
          {budgetTon !== null && (
            <div>
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>Total Budget</span>
                <span>{totalSpentTon.toFixed(2)} / {budgetTon.toFixed(2)} TON</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${budgetUsedPct ?? 0}%`,
                    backgroundColor: (budgetUsedPct ?? 0) >= 90 ? 'hsl(0 72% 51%)' : (budgetUsedPct ?? 0) >= 70 ? 'hsl(45 93% 47%)' : 'hsl(142 71% 45%)',
                  }}
                />
              </div>
            </div>
          )}
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
          {campaign.allocations && campaign.allocations.length > 0 && (
            <p className="text-xs text-blue-400">
              จัดสรร {campaign.allocations.reduce((s: number, a: { amountTon: unknown }) => s + Number(a.amountTon), 0).toFixed(2)} TON จาก Wallet
            </p>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}
