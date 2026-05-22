import { calcEntryMetrics } from '@/lib/metrics'

function fmt(n: number, d = 2) { return n.toFixed(d) }

export function PerformanceTable({ entries, targetType }: { entries: any[]; targetType?: string }) {
  const joinsLabel = targetType === 'BOT' ? 'Startbot' : 'Joins'
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground py-4">ยังไม่มี entry</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-muted-foreground text-xs">
            <th className="text-left py-2 px-3">วันที่</th>
            <th className="text-right py-2 px-3">Spend (TON)</th>
            <th className="text-right py-2 px-3">BSP</th>
            <th className="text-right py-2 px-3">Views</th>
            <th className="text-right py-2 px-3">Clicks</th>
            <th className="text-right py-2 px-3">{joinsLabel}</th>
            <th className="text-right py-2 px-3">CTR</th>
            <th className="text-right py-2 px-3">TON/USD</th>
            <th className="text-right py-2 px-3">มูลค่า (฿)</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e: any) => {
            const m = calcEntryMetrics({
              spendTon: Number(e.spendTon),
              dailyBudgetTon: Number(e.dailyBudgetTon),
              tonPriceUsd: Number(e.tonPriceUsd),
              usdThbRate: Number(e.usdThbRate),
              impressions: e.impressions,
              clicks: e.clicks,
              joins: e.joins,
            })
            return (
              <tr key={e.id} className="border-b hover:bg-muted/30">
                <td className="py-2 px-3">
                  {new Date(e.date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}
                </td>
                <td className="text-right py-2 px-3">{fmt(Number(e.spendTon), 2)}</td>
                <td className="text-right py-2 px-3">{fmt(m.bsp, 1)}%</td>
                <td className="text-right py-2 px-3">{e.views.toLocaleString()}</td>
                <td className="text-right py-2 px-3">{e.clicks.toLocaleString()}</td>
                <td className="text-right py-2 px-3">{e.joins.toLocaleString()}</td>
                <td className="text-right py-2 px-3">{fmt(m.ctr, 2)}%</td>
                <td className="text-right py-2 px-3">${fmt(Number(e.tonPriceUsd), 2)}</td>
                <td className="text-right py-2 px-3">฿{m.spendThb.toLocaleString('th-TH', { maximumFractionDigits: 0 })}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
