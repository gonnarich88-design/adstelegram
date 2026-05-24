'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Pencil, Trash2 } from 'lucide-react'
import { calcEntryMetrics, calcAggregateMetrics } from '@/lib/metrics'
import { bspColor } from '@/lib/bsp-color'

function fmtThb(n: number) {
  return '฿' + n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtThbInt(n: number) {
  return '฿' + n.toLocaleString('th-TH', { maximumFractionDigits: 0 })
}

function monthLabel(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })
}

function groupByMonth(entries: any[]) {
  const map = new Map<string, any[]>()
  for (const e of entries) {
    const key = new Date(e.date).toISOString().slice(0, 7) // YYYY-MM
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(e)
  }
  // newest month first
  return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]))
}

export function PerformanceTable({ entries, targetType, campaignDailyBudget = 0, campaignId }: {
  entries: any[]
  targetType?: string
  campaignDailyBudget?: number
  campaignId: string
}) {
  const joinsLabel = targetType === 'BOT' ? 'Startbot' : 'Joins'

  const router = useRouter()
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState('')

  async function handleDelete(entryId: string, dateStr: string) {
    const label = new Date(dateStr).toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
    if (!window.confirm(`ลบ entry วันที่ ${label}?`)) return

    setDeletingId(entryId)
    setDeleteError('')
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/entries/${entryId}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        setDeleteError('')
        router.refresh()
      } else {
        setDeleteError('ลบไม่สำเร็จ ลองใหม่อีกครั้ง')
      }
    } catch {
      setDeleteError('ลบไม่สำเร็จ ลองใหม่อีกครั้ง')
    } finally {
      setDeletingId(null)
    }
  }

  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground py-4">ยังไม่มี entry</p>
  }

  const months = groupByMonth(entries)
  const latestKey = months[0]?.[0] ?? ''

  // default: เดือนล่าสุดเปิด
  const [openMonths, setOpenMonths] = useState<Set<string>>(new Set([latestKey]))

  function toggleMonth(key: string) {
    setOpenMonths(prev => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  return (
    <div className="space-y-2">
      {months.map(([monthKey, monthEntries]) => {
        const isOpen = openMonths.has(monthKey)

        const sorted = [...monthEntries].sort((a, b) =>
          new Date(b.date).getTime() - new Date(a.date).getTime()
        )

        const agg = calcAggregateMetrics(sorted.map(e => ({
          spendTon: Number(e.spendTon),
          dailyBudgetTon: Number(e.dailyBudgetTon) || campaignDailyBudget,
          tonPriceUsd: Number(e.tonPriceUsd),
          usdThbRate: Number(e.usdThbRate),
          impressions: e.impressions,
          views: e.views,
          clicks: e.clicks,
          joins: e.joins,
        })))

        const cpcThb = agg.totalClicks > 0 ? agg.spendThb / agg.totalClicks : 0
        const cpsThb = agg.totalJoins > 0 ? agg.spendThb / agg.totalJoins : 0
        const cpmThb = agg.totalViews > 0 ? (agg.spendThb / agg.totalViews) * 1000 : 0

        return (
          <div key={monthKey} className="border border-border rounded-lg overflow-hidden">
            {/* Month header — always visible */}
            <button
              type="button"
              onClick={() => toggleMonth(monthKey)}
              className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <span className="font-semibold text-sm">{monthLabel(sorted[0].date)}</span>
                <span className="text-xs text-muted-foreground">{sorted.length} วัน</span>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <span className="text-muted-foreground hidden sm:inline">Views <span className="text-foreground font-medium">{agg.totalViews.toLocaleString()}</span></span>
                <span className="text-muted-foreground hidden sm:inline">Clicks <span className="text-foreground font-medium">{agg.totalClicks.toLocaleString()}</span></span>
                <span className="text-muted-foreground hidden sm:inline">{joinsLabel} <span className="text-foreground font-medium">{agg.totalJoins.toLocaleString()}</span></span>
                <span className="text-border hidden sm:inline">|</span>
                <span className="text-green-400 font-medium">{fmtThbInt(agg.spendThb)}</span>
                <span className="font-semibold" style={{ color: bspColor(agg.bsp) }}>
                  BSP {agg.bsp.toFixed(1)}%
                </span>
                <span className="text-muted-foreground text-base leading-none">
                  {isOpen ? '▲' : '▼'}
                </span>
              </div>
            </button>

            {/* Daily rows — only rendered when open */}
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
                      <th className="text-right py-2 px-2">CPM</th>
                      <th className="text-right py-2 px-2">BSP</th>
                      <th className="py-2 px-2 pr-4 w-16"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((e: any) => {
                      const thb = Number(e.usdThbRate)
                      const m = calcEntryMetrics({
                        spendTon: Number(e.spendTon),
                        dailyBudgetTon: Number(e.dailyBudgetTon) || campaignDailyBudget,
                        tonPriceUsd: Number(e.tonPriceUsd),
                        usdThbRate: thb,
                        impressions: e.impressions,
                        views: e.views,
                        clicks: e.clicks,
                        joins: e.joins,
                      })
                      return (
                        <tr key={e.id} className="border-b border-muted/40 hover:bg-muted/20">
                          <td className="py-1.5 px-2 pl-4 whitespace-nowrap text-muted-foreground">
                            {new Date(e.date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}
                          </td>
                          <td className="text-right py-1.5 px-2">{e.views.toLocaleString()}</td>
                          <td className="text-right py-1.5 px-2">{e.clicks.toLocaleString()}</td>
                          <td className="text-right py-1.5 px-2">{e.joins.toLocaleString()}</td>
                          <td className="text-right py-1.5 px-2 text-muted-foreground">{Number(e.spendTon).toFixed(2)}</td>
                          <td className="text-right py-1.5 px-2 text-green-400">{fmtThbInt(m.spendThb)}</td>
                          <td className="text-right py-1.5 px-2">{m.ctr.toFixed(2)}%</td>
                          <td className="text-right py-1.5 px-2">{m.cr.toFixed(2)}%</td>
                          <td className="text-right py-1.5 px-2">{fmtThb(m.cpc * thb)}</td>
                          <td className="text-right py-1.5 px-2">{fmtThb(m.cps * thb)}</td>
                          <td className="text-right py-1.5 px-2">{fmtThb(m.cpm * thb)}</td>
                          <td className="text-right py-1.5 px-2 font-medium" style={{ color: bspColor(m.bsp) }}>{m.bsp.toFixed(1)}%</td>
                          <td className="py-1.5 px-2 pr-4">
                            <div className="flex items-center gap-1 justify-end">
                              <Link
                                href={`/campaigns/${campaignId}/entries/${e.id}/edit`}
                                className="p-1 rounded hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
                              >
                                <Pencil size={13} />
                              </Link>
                              <button
                                type="button"
                                onClick={() => handleDelete(e.id, e.date)}
                                disabled={deletingId === e.id}
                                className="p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-40"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}

                    {/* Monthly summary */}
                    <tr className="border-t-2 border-border bg-muted/30 font-semibold">
                      <td className="py-2 px-2 pl-4 text-muted-foreground">รวมเดือน</td>
                      <td className="text-right py-2 px-2">{agg.totalViews.toLocaleString()}</td>
                      <td className="text-right py-2 px-2">{agg.totalClicks.toLocaleString()}</td>
                      <td className="text-right py-2 px-2">{agg.totalJoins.toLocaleString()}</td>
                      <td className="text-right py-2 px-2 text-muted-foreground">{agg.totalSpendTon.toFixed(2)}</td>
                      <td className="text-right py-2 px-2 text-green-400 font-bold">{fmtThbInt(agg.spendThb)}</td>
                      <td className="text-right py-2 px-2">{agg.ctr.toFixed(2)}%</td>
                      <td className="text-right py-2 px-2">{agg.cr.toFixed(2)}%</td>
                      <td className="text-right py-2 px-2">{fmtThb(cpcThb)}</td>
                      <td className="text-right py-2 px-2">{fmtThb(cpsThb)}</td>
                      <td className="text-right py-2 px-2">{fmtThb(cpmThb)}</td>
                      <td className="text-right py-2 px-2" style={{ color: bspColor(agg.bsp) }}>{agg.bsp.toFixed(1)}%</td>
                      <td />
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )
      })}
      {deleteError && (
        <p className="text-sm text-destructive mt-2">{deleteError}</p>
      )}
    </div>
  )
}
