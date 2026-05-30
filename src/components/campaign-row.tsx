import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { calcAggregateMetrics } from '@/lib/metrics'
import { ChevronRight } from 'lucide-react'

const STATUS_CLASS: Record<string, string> = {
  ACTIVE: 'bg-green-600 text-white hover:bg-green-600',
  PAUSED: 'bg-secondary text-secondary-foreground hover:bg-secondary',
  STOPPED: 'bg-yellow-500 text-black hover:bg-yellow-500',
  DONE: 'border border-border bg-transparent text-foreground',
  CANCELLED: 'bg-destructive text-white hover:bg-destructive',
}

function bspColor(bsp: number): string {
  const pct = Math.min(bsp, 100) / 100
  return `hsl(${Math.round(pct * 120)} 72% 51%)`
}

function n(v: number, d = 0) {
  return v.toLocaleString('th-TH', { maximumFractionDigits: d })
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="text-center" style={{ minWidth: 52 }}>
      <div className="text-[10px] text-muted-foreground leading-none mb-1">{label}</div>
      <div className="text-xs font-medium leading-none" style={color ? { color } : undefined}>
        {value}
      </div>
    </div>
  )
}

export function CampaignRow({ campaign }: { campaign: any }) {
  const dailyBudget = Number(campaign.dailyBudgetTon)

  const metrics =
    campaign.entries.length > 0
      ? calcAggregateMetrics(
          campaign.entries.map((e: any) => ({
            spendTon: Number(e.spendTon),
            dailyBudgetTon: Number(e.dailyBudgetTon) || dailyBudget,
            tonPriceUsd: Number(e.tonPriceUsd),
            usdThbRate: Number(e.usdThbRate),
            impressions: e.impressions,
            views: e.views,
            clicks: e.clicks,
            joins: e.joins,
          }))
        )
      : null

  const joinsLabel = campaign.targetType === 'BOT' ? 'Startbot' : 'Joins'
  const cpsThb = metrics && metrics.totalJoins > 0 ? metrics.spendThb / metrics.totalJoins : null
  const cpmThb =
    metrics && metrics.totalViews > 0 ? (metrics.spendThb / metrics.totalViews) * 1000 : null

  const placementLabel =
    campaign.placementType === 'CHANNEL'
      ? 'Channels'
      : campaign.placementType === 'BOT'
      ? 'Bots'
      : campaign.placementType === 'SEARCH'
      ? 'Search'
      : null

  return (
    <Link
      href={`/campaigns/${campaign.id}`}
      className="flex items-center gap-4 px-4 py-3 rounded-lg border border-border hover:bg-muted/30 transition-colors group"
    >
      {/* Left: name + meta */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm truncate">{campaign.name}</span>
          <Badge className={`${STATUS_CLASS[campaign.status] ?? ''} text-[10px] px-1.5 py-0 h-4 shrink-0`}>
            {campaign.status}
          </Badge>
        </div>
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          <span className="text-[11px] text-muted-foreground truncate">
            {campaign.targetType} · {campaign.targetName}
            {placementLabel && ` · ${placementLabel}`}
            {campaign.entries.length > 0 && ` · ${campaign.entries.length} วัน`}
          </span>
          {campaign.bidCpmTon != null && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
              Bid {Number(campaign.bidCpmTon).toFixed(2)} TON
            </span>
          )}
        </div>
      </div>

      {/* Right: metrics */}
      <div className="flex items-center gap-3 shrink-0">
        <Stat label="Views" value={metrics ? n(metrics.totalViews) : '—'} />
        <Stat label="Clicks" value={metrics ? n(metrics.totalClicks) : '—'} />
        <Stat label={joinsLabel} value={metrics ? n(metrics.totalJoins) : '—'} />
        <Stat
          label="CPM ฿"
          value={cpmThb !== null ? `฿${n(cpmThb, 1)}` : '—'}
        />
        <Stat
          label="CTR"
          value={metrics ? `${n(metrics.ctr, 2)}%` : '—'}
        />
        <Stat
          label="CPS ฿"
          value={cpsThb !== null ? `฿${n(cpsThb, 0)}` : '—'}
        />
        <Stat
          label="Spend ฿"
          value={metrics ? `฿${n(metrics.spendThb, 0)}` : '—'}
        />
        {metrics ? (
          <div className="text-center" style={{ minWidth: 52 }}>
            <div className="text-[10px] text-muted-foreground leading-none mb-1">BSP</div>
            <div
              className="text-xs font-medium leading-none"
              style={{ color: bspColor(metrics.bsp) }}
            >
              {n(metrics.bsp, 1)}%
            </div>
          </div>
        ) : (
          <Stat label="BSP" value="—" />
        )}
        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </Link>
  )
}
