'use client'

import { useState } from 'react'
import { bspColor } from '@/lib/bsp-color'

export interface DailyTotal {
  date: string
  views: number
  clicks: number
  joins: number
  spendTon: number
  spendThb: number
  dailyBudgetTon: number
}

function fmtThb(n: number) {
  return '฿' + n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtThbInt(n: number) {
  return '฿' + n.toLocaleString('th-TH', { maximumFractionDigits: 0 })
}

function monthLabel(dateStr: string) {
  return new Date(dateStr + 'T00:00:00Z').toLocaleDateString('th-TH', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

function groupByMonth(rows: DailyTotal[]) {
  const map = new Map<string, DailyTotal[]>()
  for (const r of rows) {
    const key = r.date.slice(0, 7)
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(r)
  }
  return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]))
}

function rowMetrics(r: DailyTotal) {
  return {
    ctr: r.views > 0 ? (r.clicks / r.views) * 100 : 0,
    cr: r.clicks > 0 ? (r.joins / r.clicks) * 100 : 0,
    cpc: r.clicks > 0 ? r.spendThb / r.clicks : 0,
    cps: r.joins > 0 ? r.spendThb / r.joins : 0,
    cpm: r.views > 0 ? (r.spendThb / r.views) * 1000 : 0,
    bsp: r.dailyBudgetTon > 0 ? (r.spendTon / r.dailyBudgetTon) * 100 : 0,
  }
}

function monthAgg(rows: DailyTotal[]) {
  const views = rows.reduce((s, r) => s + r.views, 0)
  const clicks = rows.reduce((s, r) => s + r.clicks, 0)
  const joins = rows.reduce((s, r) => s + r.joins, 0)
  const spendTon = rows.reduce((s, r) => s + r.spendTon, 0)
  const spendThb = rows.reduce((s, r) => s + r.spendThb, 0)
  const dailyBudgetTon = rows.reduce((s, r) => s + r.dailyBudgetTon, 0)
  return {
    views, clicks, joins, spendTon, spendThb, dailyBudgetTon,
    ctr: views > 0 ? (clicks / views) * 100 : 0,
    cr: clicks > 0 ? (joins / clicks) * 100 : 0,
    cpc: clicks > 0 ? spendThb / clicks : 0,
    cps: joins > 0 ? spendThb / joins : 0,
    cpm: views > 0 ? (spendThb / views) * 1000 : 0,
    bsp: dailyBudgetTon > 0 ? (spendTon / dailyBudgetTon) * 100 : 0,
  }
}

export function DailyTotalTable({ dailyTotals, joinsLabel = 'Joins' }: {
  dailyTotals: DailyTotal[]
  joinsLabel?: string
}) {
  const months = groupByMonth(dailyTotals)
  const latestKey = months[0]?.[0] ?? ''
  const [openMonths, setOpenMonths] = useState<Set<string>>(new Set([latestKey]))

  if (dailyTotals.length === 0) return null

  function toggle(key: string) {
    setOpenMonths(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  return (
    <div className="space-y-2">
      {months.map(([monthKey, rows]) => {
        const isOpen = openMonths.has(monthKey)
        const sorted = [...rows].sort((a, b) => b.date.localeCompare(a.date))
        const agg = monthAgg(sorted)

        return (
          <div key={monthKey} className="border border-border rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => toggle(monthKey)}
              className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <span className="font-semibold text-sm">{monthLabel(monthKey + '-01')}</span>
                <span className="text-xs text-muted-foreground">{sorted.length} วัน</span>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <span className="text-muted-foreground hidden sm:inline">Views <span className="text-foreground font-medium">{agg.views.toLocaleString()}</span></span>
                <span className="text-muted-foreground hidden sm:inline">Clicks <span className="text-foreground font-medium">{agg.clicks.toLocaleString()}</span></span>
                <span className="text-muted-foreground hidden sm:inline">{joinsLabel} <span className="text-foreground font-medium">{agg.joins.toLocaleString()}</span></span>
                <span className="text-border hidden sm:inline">|</span>
                <span className="text-green-400 font-medium">{fmtThbInt(agg.spendThb)}</span>
                <span className="font-semibold" style={{ color: bspColor(agg.bsp) }}>
                  BSP {agg.bsp.toFixed(1)}%
                </span>
                <span className="text-muted-foreground text-base leading-none">{isOpen ? '▲' : '▼'}</span>
              </div>
            </button>

            {isOpen && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="text-left py-2 px-2 pl-4">วันที่</th>
                      <th className="text-right py-2 px-2">Views</th>
                      <th className="text-right py-2 px-2">Clicks</th>
                      <th className="text-right py-2 px-2">{joinsLabel}</th>
                      <th className="text-right py-2 px-2">Spend (TON)</th>
                      <th className="text-right py-2 px-2 text-green-400">มูลค่า (฿)</th>
                      <th className="text-right py-2 px-2">CTR</th>
                      <th className="text-right py-2 px-2">CR</th>
                      <th className="text-right py-2 px-2">CPC</th>
                      <th className="text-right py-2 px-2">CPS</th>
                      <th className="text-right py-2 px-2 pr-4">BSP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map(r => {
                      const m = rowMetrics(r)
                      return (
                        <tr key={r.date} className="border-b border-muted/40 hover:bg-muted/20">
                          <td className="py-1.5 px-2 pl-4 whitespace-nowrap text-muted-foreground">
                            {new Date(r.date + 'T00:00:00Z').toLocaleDateString('th-TH', { day: 'numeric', month: 'short', timeZone: 'UTC' })}
                          </td>
                          <td className="text-right py-1.5 px-2">{r.views.toLocaleString()}</td>
                          <td className="text-right py-1.5 px-2">{r.clicks.toLocaleString()}</td>
                          <td className="text-right py-1.5 px-2">{r.joins.toLocaleString()}</td>
                          <td className="text-right py-1.5 px-2 text-muted-foreground">{r.spendTon.toFixed(2)}</td>
                          <td className="text-right py-1.5 px-2 text-green-400">{fmtThbInt(r.spendThb)}</td>
                          <td className="text-right py-1.5 px-2">{m.ctr.toFixed(2)}%</td>
                          <td className="text-right py-1.5 px-2">{m.cr.toFixed(2)}%</td>
                          <td className="text-right py-1.5 px-2">{fmtThb(m.cpc)}</td>
                          <td className="text-right py-1.5 px-2">{r.joins > 0 ? fmtThb(m.cps) : '—'}</td>
                          <td className="text-right py-1.5 px-2 pr-4 font-medium" style={{ color: bspColor(m.bsp) }}>{m.bsp.toFixed(1)}%</td>
                        </tr>
                      )
                    })}

                    <tr className="border-t-2 border-border bg-muted/30 font-semibold">
                      <td className="py-2 px-2 pl-4 text-muted-foreground">รวมเดือน</td>
                      <td className="text-right py-2 px-2">{agg.views.toLocaleString()}</td>
                      <td className="text-right py-2 px-2">{agg.clicks.toLocaleString()}</td>
                      <td className="text-right py-2 px-2">{agg.joins.toLocaleString()}</td>
                      <td className="text-right py-2 px-2 text-muted-foreground">{agg.spendTon.toFixed(2)}</td>
                      <td className="text-right py-2 px-2 text-green-400 font-bold">{fmtThbInt(agg.spendThb)}</td>
                      <td className="text-right py-2 px-2">{agg.ctr.toFixed(2)}%</td>
                      <td className="text-right py-2 px-2">{agg.cr.toFixed(2)}%</td>
                      <td className="text-right py-2 px-2">{fmtThb(agg.cpc)}</td>
                      <td className="text-right py-2 px-2">{agg.joins > 0 ? fmtThb(agg.cps) : '—'}</td>
                      <td className="text-right py-2 px-2 pr-4" style={{ color: bspColor(agg.bsp) }}>{agg.bsp.toFixed(1)}%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
