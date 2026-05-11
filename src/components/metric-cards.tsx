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
  return (
    <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
      <MetricCard label="CTR" value={`${metrics.ctr.toFixed(2)}%`} />
      <MetricCard label="CR" value={`${metrics.cr.toFixed(2)}%`} />
      <MetricCard label="CPC" value={`$${metrics.cpc.toFixed(4)}`} />
      <MetricCard label="CPS" value={`$${metrics.cps.toFixed(4)}`} />
      <MetricCard label="CPM" value={`$${metrics.cpm.toFixed(3)}`} />
      <MetricCard label="BSP" value={`${metrics.bsp.toFixed(1)}%`} />
    </div>
  )
}
