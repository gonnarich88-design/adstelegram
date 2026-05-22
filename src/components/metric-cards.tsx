import { AggregateMetrics } from '@/lib/metrics'

function MetricCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border p-4 text-center">
      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{label}</p>
      <p className="text-xl font-bold">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  )
}

export function MetricCards({ metrics }: { metrics: AggregateMetrics }) {
  const cpcThb = metrics.totalClicks > 0 ? metrics.spendThb / metrics.totalClicks : 0
  const cpsThb = metrics.totalJoins > 0 ? metrics.spendThb / metrics.totalJoins : 0
  const cpmThb = metrics.totalViews > 0 ? (metrics.spendThb / metrics.totalViews) * 1000 : 0

  return (
    <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
      <MetricCard label="CTR" value={`${metrics.ctr.toFixed(2)}%`} />
      <MetricCard label="CR" value={`${metrics.cr.toFixed(2)}%`} />
      <MetricCard label="CPC" value={`฿${cpcThb.toFixed(2)}`} />
      <MetricCard label="CPS" value={`฿${cpsThb.toFixed(2)}`} />
      <MetricCard label="CPM" value={`฿${cpmThb.toFixed(2)}`} />
      <MetricCard label="BSP" value={`${metrics.bsp.toFixed(1)}%`} />
    </div>
  )
}
