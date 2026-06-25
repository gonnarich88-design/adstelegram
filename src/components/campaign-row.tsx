'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { calcAggregateMetrics } from '@/lib/metrics'
import { ChevronDown, Pencil, MapPin } from 'lucide-react'

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

export function CampaignRow({
  campaign,
  onBidUpdate,
}: {
  campaign: any
  onBidUpdate?: (id: string, bidCpmTon: string | null) => void
}) {
  const [editingBid, setEditingBid] = useState(false)
  const [bidInput, setBidInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const cancelledRef = useRef(false)

  const dailyBudget = Number(campaign.dailyBudgetTon)

  const currentMonth = new Date().toISOString().slice(0, 7)
  const monthEntries = [...campaign.entries]
    .filter((e: any) => e.date.slice(0, 7) === currentMonth)
    .reverse()

  const monthMetrics =
    monthEntries.length > 0
      ? calcAggregateMetrics(
          monthEntries.map((e: any) => ({
            spendTon: Number(e.spendTon),
            dailyBudgetTon: dailyBudget || Number(e.dailyBudgetTon),
            tonPriceUsd: Number(e.tonPriceUsd),
            usdThbRate: Number(e.usdThbRate),
            impressions: e.impressions,
            views: e.views,
            clicks: e.clicks,
            joins: e.joins,
          }))
        )
      : null

  function fmtDay(dateStr: string) {
    return new Date(dateStr.slice(0, 10) + 'T00:00:00Z').toLocaleDateString('th-TH', {
      day: 'numeric', month: 'short', timeZone: 'UTC',
    })
  }

  function toggleExpand(e: React.MouseEvent) {
    e.preventDefault()
    setExpanded(v => !v)
  }

  const metrics =
    campaign.entries.length > 0
      ? calcAggregateMetrics(
          campaign.entries.map((e: any) => ({
            spendTon: Number(e.spendTon),
            dailyBudgetTon: dailyBudget || Number(e.dailyBudgetTon),
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

  function startEdit(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    cancelledRef.current = false
    setBidInput(campaign.bidCpmTon ? Number(campaign.bidCpmTon).toFixed(4) : '')
    setEditingBid(true)
    setTimeout(() => { inputRef.current?.select() }, 0)
  }

  async function save() {
    if (saving) return
    const trimmed = bidInput.trim()
    const newBid = trimmed === '' ? null : parseFloat(trimmed)
    if (trimmed !== '' && (isNaN(newBid!) || newBid! <= 0)) {
      setEditingBid(false)
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/campaigns/${campaign.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bidCpmTon: newBid }),
      })
      if (res.ok) {
        const data = await res.json()
        onBidUpdate?.(campaign.id, data.bidCpmTon)
      }
    } finally {
      setSaving(false)
      setEditingBid(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      save()
    } else if (e.key === 'Escape') {
      cancelledRef.current = true
      setEditingBid(false)
    }
  }

  function handleBlur() {
    if (cancelledRef.current) {
      cancelledRef.current = false
      return
    }
    save()
  }

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      {/* Header row */}
      <div className="flex items-center">
        {/* Clickable area → expand/collapse */}
        <div
          onClick={toggleExpand}
          className="flex items-center gap-4 px-4 py-3 flex-1 min-w-0 cursor-pointer hover:bg-muted/30 transition-colors"
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
              <span className="text-[11px] text-muted-foreground">
                {campaign.targetType} · {campaign.targetName}
                {placementLabel && ` · ${placementLabel}`}
                {campaign.entries.length > 0 && ` · ${campaign.entries.length} วัน`}
              </span>
              {/* Placement chips — M2M first, fallback to legacy placementName */}
              {(campaign.placements ?? []).length > 0
                ? (campaign.placements as { placementId: string; placement: { name: string } }[]).map(cp => (
                    <span
                      key={cp.placementId}
                      className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20 shrink-0 max-w-[180px]"
                    >
                      <MapPin className="w-2.5 h-2.5 shrink-0" />
                      <span className="truncate">{cp.placement.name}</span>
                    </span>
                  ))
                : campaign.placementName && (
                    <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20 shrink-0 max-w-[180px]">
                      <MapPin className="w-2.5 h-2.5 shrink-0" />
                      <span className="truncate">{campaign.placementName}</span>
                    </span>
                  )
              }
              {/* Bid chip — click to edit inline */}
              {editingBid ? (
                <span
                  className="flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted shrink-0"
                  onClick={e => { e.preventDefault(); e.stopPropagation() }}
                >
                  <input
                    ref={inputRef}
                    value={bidInput}
                    onChange={e => setBidInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onBlur={handleBlur}
                    disabled={saving}
                    className="w-14 bg-transparent outline-none text-foreground text-[10px] border-b border-foreground/40"
                    placeholder="0.0000"
                    autoFocus
                  />
                  <span className="text-muted-foreground">TON</span>
                </span>
              ) : campaign.bidCpmTon != null ? (
                <span
                  onClick={startEdit}
                  className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0 cursor-pointer hover:bg-primary/10 hover:text-foreground transition-colors"
                  title="คลิกเพื่อแก้ไข Bid"
                >
                  Bid {Number(campaign.bidCpmTon).toFixed(2)} TON
                </span>
              ) : (
                <span
                  onClick={startEdit}
                  className="text-[10px] px-1.5 py-0.5 rounded border border-dashed border-muted-foreground/30 text-muted-foreground/40 shrink-0 cursor-pointer hover:text-muted-foreground hover:border-muted-foreground/50 transition-colors"
                  title="คลิกเพื่อตั้ง Bid"
                >
                  + Bid
                </span>
              )}
            </div>
          </div>

          {/* Right: metrics */}
          <div className="flex items-center gap-3 shrink-0">
            <Stat label="Views" value={metrics ? n(metrics.totalViews) : '—'} />
            <Stat label="Clicks" value={metrics ? n(metrics.totalClicks) : '—'} />
            <Stat label={joinsLabel} value={metrics ? n(metrics.totalJoins) : '—'} />
            <Stat label="CPM ฿" value={cpmThb !== null ? `฿${n(cpmThb, 1)}` : '—'} />
            <Stat label="CTR" value={metrics ? `${n(metrics.ctr, 2)}%` : '—'} />
            <Stat label="CPS ฿" value={cpsThb !== null ? `฿${n(cpsThb, 0)}` : '—'} />
            <Stat label="Spend ฿" value={metrics ? `฿${n(metrics.spendThb, 0)}` : '—'} />
            {metrics ? (
              <div className="text-center" style={{ minWidth: 52 }}>
                <div className="text-[10px] text-muted-foreground leading-none mb-1">BSP</div>
                <div className="text-xs font-medium leading-none" style={{ color: bspColor(metrics.bsp) }}>
                  {n(metrics.bsp, 1)}%
                </div>
              </div>
            ) : (
              <Stat label="BSP" value="—" />
            )}
            <ChevronDown
              className={`w-3.5 h-3.5 text-muted-foreground shrink-0 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
            />
          </div>
        </div>

        {/* Edit button → campaign edit page */}
        <Link
          href={`/campaigns/${campaign.id}/edit`}
          onClick={e => e.stopPropagation()}
          className="flex items-center justify-center w-8 h-8 mr-2 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
          aria-label="แก้ไข campaign"
        >
          <Pencil className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Expanded panel — current month entries */}
      {expanded && (
        <div className="border-t border-border bg-muted/10 px-4 py-3">
          {monthEntries.length === 0 ? (
            <p className="text-xs text-muted-foreground py-1">ยังไม่มีข้อมูลเดือนนี้</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[10px] text-muted-foreground">
                  <th className="text-left pb-2 font-normal">วันที่</th>
                  <th className="text-right pb-2 font-normal">Views</th>
                  <th className="text-right pb-2 font-normal">Clicks</th>
                  <th className="text-right pb-2 font-normal">{joinsLabel}</th>
                  <th className="text-right pb-2 font-normal">Spend TON</th>
                  <th className="text-right pb-2 font-normal">Spend ฿</th>
                  <th className="text-right pb-2 font-normal">BSP</th>
                </tr>
              </thead>
              <tbody>
                {monthEntries.map((e: any) => {
                  const spendThb = Number(e.spendTon) * Number(e.tonPriceUsd) * Number(e.usdThbRate)
                  const bsp = dailyBudget > 0 ? (Number(e.spendTon) / dailyBudget) * 100 : 0
                  return (
                    <tr key={e.id} className="border-t border-border/40">
                      <td className="py-1 text-muted-foreground">{fmtDay(e.date)}</td>
                      <td className="py-1 text-right">{n(e.views)}</td>
                      <td className="py-1 text-right">{n(e.clicks)}</td>
                      <td className="py-1 text-right">{n(e.joins)}</td>
                      <td className="py-1 text-right text-muted-foreground">{Number(e.spendTon).toFixed(2)}</td>
                      <td className="py-1 text-right">฿{n(spendThb, 0)}</td>
                      <td className="py-1 text-right font-medium" style={{ color: bspColor(bsp) }}>
                        {n(bsp, 1)}%
                      </td>
                    </tr>
                  )
                })}
                {/* Summary row */}
                {monthMetrics && (
                  <tr className="border-t border-border font-medium">
                    <td className="pt-2 text-muted-foreground">รวม</td>
                    <td className="pt-2 text-right">{n(monthMetrics.totalViews)}</td>
                    <td className="pt-2 text-right">{n(monthMetrics.totalClicks)}</td>
                    <td className="pt-2 text-right">{n(monthMetrics.totalJoins)}</td>
                    <td className="pt-2 text-right text-muted-foreground">{monthMetrics.totalSpendTon.toFixed(2)}</td>
                    <td className="pt-2 text-right">฿{n(monthMetrics.spendThb, 0)}</td>
                    <td className="pt-2 text-right" style={{ color: bspColor(monthMetrics.bsp) }}>
                      {n(monthMetrics.bsp, 1)}%
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
          <div className="mt-3 flex justify-end">
            <Link
              href={`/campaigns/${campaign.id}`}
              onClick={e => e.stopPropagation()}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              ดูทั้งหมด →
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
