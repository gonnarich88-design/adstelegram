import { calcEntryMetrics } from '@/lib/metrics'

function fmtThb(n: number) {
  return '฿' + n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function PerformanceTable({ entries, targetType }: { entries: any[]; targetType?: string }) {
  const joinsLabel = targetType === 'BOT' ? 'Startbot' : 'Joins'
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground py-4">ยังไม่มี entry</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b text-muted-foreground">
            <th className="text-left py-2 px-2">วันที่</th>
            <th className="text-right py-2 px-2">Views</th>
            <th className="text-right py-2 px-2">Clicks</th>
            <th className="text-right py-2 px-2">{joinsLabel}</th>
            <th className="text-right py-2 px-2">Spend (TON)</th>
            <th className="text-right py-2 px-2 text-green-400">มูลค่า (฿)</th>
            <th className="text-right py-2 px-2">CTR</th>
            <th className="text-right py-2 px-2">CR</th>
            <th className="text-right py-2 px-2">CPC</th>
            <th className="text-right py-2 px-2">CPS</th>
            <th className="text-right py-2 px-2">CPM</th>
            <th className="text-right py-2 px-2">BSP</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e: any) => {
            const thb = Number(e.usdThbRate)
            const m = calcEntryMetrics({
              spendTon: Number(e.spendTon),
              dailyBudgetTon: Number(e.dailyBudgetTon),
              tonPriceUsd: Number(e.tonPriceUsd),
              usdThbRate: thb,
              impressions: e.impressions,
              views: e.views,
              clicks: e.clicks,
              joins: e.joins,
            })
            return (
              <tr key={e.id} className="border-b hover:bg-muted/30">
                <td className="py-2 px-2 whitespace-nowrap">
                  {new Date(e.date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}
                </td>
                <td className="text-right py-2 px-2">{e.views.toLocaleString()}</td>
                <td className="text-right py-2 px-2">{e.clicks.toLocaleString()}</td>
                <td className="text-right py-2 px-2">{e.joins.toLocaleString()}</td>
                <td className="text-right py-2 px-2 text-muted-foreground">{Number(e.spendTon).toFixed(2)}</td>
                <td className="text-right py-2 px-2 font-medium text-green-400">
                  ฿{m.spendThb.toLocaleString('th-TH', { maximumFractionDigits: 0 })}
                </td>
                <td className="text-right py-2 px-2">{m.ctr.toFixed(2)}%</td>
                <td className="text-right py-2 px-2">{m.cr.toFixed(2)}%</td>
                <td className="text-right py-2 px-2">{fmtThb(m.cpc * thb)}</td>
                <td className="text-right py-2 px-2">{fmtThb(m.cps * thb)}</td>
                <td className="text-right py-2 px-2">{fmtThb(m.cpm * thb)}</td>
                <td className="text-right py-2 px-2">{m.bsp.toFixed(1)}%</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
