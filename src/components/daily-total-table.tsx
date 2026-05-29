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
  registrations?: number
  depositCount?: number
}

interface AggRow {
  key: string
  label: string
  monthKey: string
  views: number
  clicks: number
  joins: number
  spendTon: number
  spendThb: number
  dailyBudgetTon: number
  registrations?: number
  depositCount?: number
}

function fmtThb(n: number) {
  return '฿' + n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtThbInt(n: number) {
  return '฿' + n.toLocaleString('th-TH', { maximumFractionDigits: 0 })
}

function monthLabel(yyyymm: string) {
  return new Date(yyyymm + '-01T00:00:00Z').toLocaleDateString('th-TH', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

function fmtDay(dateStr: string) {
  return new Date(dateStr + 'T00:00:00Z').toLocaleDateString('th-TH', { day: 'numeric', month: 'short', timeZone: 'UTC' })
}

// Get Monday (UTC) of the week containing dateStr
function getMondayStr(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z')
  const dow = d.getUTCDay() // 0=Sun
  const offset = dow === 0 ? 6 : dow - 1
  const mon = new Date(d)
  mon.setUTCDate(d.getUTCDate() - offset)
  return mon.toISOString().slice(0, 10)
}

function weekLabel(monStr: string): string {
  const sun = new Date(monStr + 'T00:00:00Z')
  sun.setUTCDate(sun.getUTCDate() + 6)
  const sunStr = sun.toISOString().slice(0, 10)
  return `${fmtDay(monStr)} – ${fmtDay(sunStr)}`
}

function sumRows(rows: AggRow[]) {
  const views = rows.reduce((s, r) => s + r.views, 0)
  const clicks = rows.reduce((s, r) => s + r.clicks, 0)
  const joins = rows.reduce((s, r) => s + r.joins, 0)
  const spendTon = rows.reduce((s, r) => s + r.spendTon, 0)
  const spendThb = rows.reduce((s, r) => s + r.spendThb, 0)
  const dailyBudgetTon = rows.reduce((s, r) => s + r.dailyBudgetTon, 0)
  const hasReg = rows.some(r => r.registrations !== undefined)
  const hasDep = rows.some(r => r.depositCount !== undefined)
  return {
    views, clicks, joins, spendTon, spendThb, dailyBudgetTon,
    registrations: hasReg ? rows.reduce((s, r) => s + (r.registrations ?? 0), 0) : undefined,
    depositCount: hasDep ? rows.reduce((s, r) => s + (r.depositCount ?? 0), 0) : undefined,
    ctr: views > 0 ? (clicks / views) * 100 : 0,
    cr: clicks > 0 ? (joins / clicks) * 100 : 0,
    cpc: clicks > 0 ? spendThb / clicks : 0,
    cps: joins > 0 ? spendThb / joins : 0,
    bsp: dailyBudgetTon > 0 ? (spendTon / dailyBudgetTon) * 100 : 0,
  }
}

function toDayRows(dailyTotals: DailyTotal[]): AggRow[] {
  return dailyTotals.map(r => ({
    key: r.date,
    label: fmtDay(r.date),
    monthKey: r.date.slice(0, 7),
    ...r,
  }))
}

function toWeekRows(dailyTotals: DailyTotal[]): AggRow[] {
  const map = new Map<string, DailyTotal[]>()
  for (const r of dailyTotals) {
    const mon = getMondayStr(r.date)
    if (!map.has(mon)) map.set(mon, [])
    map.get(mon)!.push(r)
  }
  return Array.from(map.entries())
    .map(([monStr, days]) => {
      const sum = days.reduce(
        (acc, r) => ({
          views: acc.views + r.views,
          clicks: acc.clicks + r.clicks,
          joins: acc.joins + r.joins,
          spendTon: acc.spendTon + r.spendTon,
          spendThb: acc.spendThb + r.spendThb,
          dailyBudgetTon: acc.dailyBudgetTon + r.dailyBudgetTon,
          registrations: r.registrations !== undefined ? (acc.registrations ?? 0) + r.registrations : acc.registrations,
          depositCount: r.depositCount !== undefined ? (acc.depositCount ?? 0) + r.depositCount : acc.depositCount,
        }),
        { views: 0, clicks: 0, joins: 0, spendTon: 0, spendThb: 0, dailyBudgetTon: 0, registrations: undefined as number | undefined, depositCount: undefined as number | undefined }
      )
      return {
        key: monStr,
        label: weekLabel(monStr),
        monthKey: monStr.slice(0, 7),
        ...sum,
      }
    })
    .sort((a, b) => b.key.localeCompare(a.key))
}

function groupRows(rows: AggRow[]) {
  const map = new Map<string, AggRow[]>()
  for (const r of rows) {
    if (!map.has(r.monthKey)) map.set(r.monthKey, [])
    map.get(r.monthKey)!.push(r)
  }
  return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]))
}

export function DailyTotalTable({ dailyTotals, joinsLabel = 'Joins' }: {
  dailyTotals: DailyTotal[]
  joinsLabel?: string
}) {
  const [mode, setMode] = useState<'day' | 'week'>('day')

  const rows = mode === 'day' ? toDayRows(dailyTotals) : toWeekRows(dailyTotals)
  const groups = groupRows(rows)
  const latestKey = groups[0]?.[0] ?? ''
  const [openMonths, setOpenMonths] = useState<Set<string>>(new Set([latestKey]))

  if (dailyTotals.length === 0) return null

  function toggle(key: string) {
    setOpenMonths(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  const unitLabel = mode === 'day' ? 'วัน' : 'สัปดาห์'

  return (
    <div className="space-y-2">
      {/* Mode toggle */}
      <div className="flex justify-end gap-1 mb-1">
        {(['day', 'week'] as const).map(m => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`px-3 py-1 text-xs rounded border transition-colors ${
              mode === m
                ? 'bg-foreground text-background border-foreground font-semibold'
                : 'border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            {m === 'day' ? 'รายวัน' : 'รายอาทิตย์'}
          </button>
        ))}
      </div>

      {groups.map(([monthKey, groupRows]) => {
        const isOpen = openMonths.has(monthKey)
        const sorted = [...groupRows].sort((a, b) => b.key.localeCompare(a.key))
        const agg = sumRows(sorted)

        return (
          <div key={monthKey + mode} className="border border-border rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => toggle(monthKey)}
              className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <span className="font-semibold text-sm">{monthLabel(monthKey)}</span>
                <span className="text-xs text-muted-foreground">{sorted.length} {unitLabel}</span>
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
                      <th className="text-left py-2 px-2 pl-4">{mode === 'day' ? 'วันที่' : 'สัปดาห์'}</th>
                      <th className="text-right py-2 px-2">Views</th>
                      <th className="text-right py-2 px-2">Clicks</th>
                      <th className="text-right py-2 px-2">{joinsLabel}</th>
                      <th className="text-right py-2 px-2 text-purple-400">สมัคร</th>
                      <th className="text-right py-2 px-2 text-blue-400">ฝาก</th>
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
                      const ctr = r.views > 0 ? (r.clicks / r.views) * 100 : 0
                      const cr = r.clicks > 0 ? (r.joins / r.clicks) * 100 : 0
                      const cpc = r.clicks > 0 ? r.spendThb / r.clicks : 0
                      const cps = r.joins > 0 ? r.spendThb / r.joins : 0
                      const bsp = r.dailyBudgetTon > 0 ? (r.spendTon / r.dailyBudgetTon) * 100 : 0
                      return (
                        <tr key={r.key} className="border-b border-muted/40 hover:bg-muted/20">
                          <td className="py-1.5 px-2 pl-4 whitespace-nowrap text-muted-foreground">{r.label}</td>
                          <td className="text-right py-1.5 px-2">{r.views.toLocaleString()}</td>
                          <td className="text-right py-1.5 px-2">{r.clicks.toLocaleString()}</td>
                          <td className="text-right py-1.5 px-2">{r.joins.toLocaleString()}</td>
                          <td className="text-right py-1.5 px-2 text-purple-400">{r.registrations !== undefined ? r.registrations.toLocaleString() : '—'}</td>
                          <td className="text-right py-1.5 px-2 text-blue-400">{r.depositCount !== undefined ? r.depositCount.toLocaleString() : '—'}</td>
                          <td className="text-right py-1.5 px-2 text-muted-foreground">{r.spendTon.toFixed(2)}</td>
                          <td className="text-right py-1.5 px-2 text-green-400">{fmtThbInt(r.spendThb)}</td>
                          <td className="text-right py-1.5 px-2">{ctr.toFixed(2)}%</td>
                          <td className="text-right py-1.5 px-2">{cr.toFixed(2)}%</td>
                          <td className="text-right py-1.5 px-2">{fmtThb(cpc)}</td>
                          <td className="text-right py-1.5 px-2">{r.joins > 0 ? fmtThb(cps) : '—'}</td>
                          <td className="text-right py-1.5 px-2 pr-4 font-medium" style={{ color: bspColor(bsp) }}>{bsp.toFixed(1)}%</td>
                        </tr>
                      )
                    })}

                    <tr className="border-t-2 border-border bg-muted/30 font-semibold">
                      <td className="py-2 px-2 pl-4 text-muted-foreground">รวมเดือน</td>
                      <td className="text-right py-2 px-2">{agg.views.toLocaleString()}</td>
                      <td className="text-right py-2 px-2">{agg.clicks.toLocaleString()}</td>
                      <td className="text-right py-2 px-2">{agg.joins.toLocaleString()}</td>
                      <td className="text-right py-2 px-2 text-purple-400">{agg.registrations !== undefined ? agg.registrations.toLocaleString() : '—'}</td>
                      <td className="text-right py-2 px-2 text-blue-400">{agg.depositCount !== undefined ? agg.depositCount.toLocaleString() : '—'}</td>
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
