'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { calcEntryMetrics } from '@/lib/metrics'

export function EntryForm({ campaignId, targetType, defaultDailyBudget, entry, entryId, allocationRate }: {
  campaignId: string
  targetType: string
  defaultDailyBudget?: string
  allocationRate?: { tonPriceUsd: number; usdThbRate: number; depositedAt: string; remainingTon: number }
  entry?: {
    date: string
    spendTon: number
    dailyBudgetTon: number
    tonPriceUsd: number
    usdThbRate: number
    views: number
    clicks: number
    joins: number
    note?: string | null
  }
  entryId?: string
}) {
  const joinsLabel = targetType === 'BOT' ? 'Startbot' : 'Joins'
  const router = useRouter()
  const today = new Date().toISOString().split('T')[0]

  // entry.date คือ ISO string จาก server (.toISOString())
  // ใช้ .slice(0, 10) ได้ปลอดภัยเพราะเป็น UTC midnight — ไม่มี timezone shift
  const [form, setForm] = useState({
    date: entry ? entry.date.slice(0, 10) : today,
    dailyBudgetTon: entry ? String(entry.dailyBudgetTon) : (defaultDailyBudget ?? ''),
    spendTon: entry ? String(entry.spendTon) : '',
    tonPriceUsd: entry
      ? String(entry.tonPriceUsd)
      : allocationRate
        ? allocationRate.tonPriceUsd.toFixed(4)
        : '',
    usdThbRate: entry
      ? String(entry.usdThbRate)
      : allocationRate
        ? allocationRate.usdThbRate.toFixed(4)
        : '',
    views: entry ? String(entry.views) : '',
    clicks: entry ? String(entry.clicks) : '',
    joins: entry ? String(entry.joins) : '',
    note: entry?.note ?? '',
  })
  const [fetchedAt, setFetchedAt] = useState('')
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(false)
  const [error, setError] = useState('')

  const fetchRates = useCallback(async () => {
    setFetching(true)
    try {
      const res = await fetch('/api/rates')
      if (res.ok) {
        const data = await res.json()
        setForm(f => ({
          ...f,
          tonPriceUsd: data.tonUsd.toFixed(4),
          usdThbRate: data.usdThb.toFixed(4),
        }))
        setFetchedAt(new Date(data.fetchedAt).toLocaleTimeString('th-TH'))
      }
    } finally {
      setFetching(false)
    }
  }, [])

  useEffect(() => {
    if (entry || allocationRate) return
    fetchRates()
  }, [fetchRates])

  function set(key: string, value: string) {
    setForm(f => ({ ...f, [key]: value }))
  }

  const canPreview = form.spendTon && form.dailyBudgetTon && form.tonPriceUsd &&
    form.usdThbRate && form.clicks && form.joins

  const preview = canPreview
    ? calcEntryMetrics({
        spendTon: parseFloat(form.spendTon),
        dailyBudgetTon: parseFloat(form.dailyBudgetTon),
        tonPriceUsd: parseFloat(form.tonPriceUsd),
        usdThbRate: parseFloat(form.usdThbRate),
        impressions: 0,
        clicks: parseInt(form.clicks),
        joins: parseInt(form.joins),
      })
    : null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const url = entryId
        ? `/api/campaigns/${campaignId}/entries/${entryId}`
        : `/api/campaigns/${campaignId}/entries`
      const res = await fetch(url, {
        method: entryId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: form.date,
          dailyBudgetTon: parseFloat(form.dailyBudgetTon),
          spendTon: parseFloat(form.spendTon),
          tonPriceUsd: parseFloat(form.tonPriceUsd),
          usdThbRate: parseFloat(form.usdThbRate),
          impressions: 0,
          views: parseInt(form.views),
          clicks: parseInt(form.clicks),
          joins: parseInt(form.joins),
          note: form.note || null,
        }),
      })

      if (res.ok) {
        router.push(`/campaigns/${campaignId}`)
        router.refresh()
      } else {
        setError('เกิดข้อผิดพลาด ลองใหม่อีกครั้ง')
      }
    } catch {
      setError('เกิดข้อผิดพลาด ลองใหม่อีกครั้ง')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-xl">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>วันที่</Label>
          <Input type="date" value={form.date} onChange={e => set('date', e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label>งบวันนี้ (TON)</Label>
          <Input type="number" step="0.001" value={form.dailyBudgetTon} onChange={e => set('dailyBudgetTon', e.target.value)} placeholder="10" required />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Spend จริง (TON)</Label>
        <Input type="number" step="0.001" value={form.spendTon} onChange={e => set('spendTon', e.target.value)} placeholder="8.5" required />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <Label>ราคา TON/USD</Label>
            {!allocationRate && !entry && (
              <button type="button" onClick={fetchRates} disabled={fetching} className="text-xs text-blue-400 hover:underline disabled:opacity-50">
                {fetching ? 'กำลังดึง...' : '↻ ดึงอัตโนมัติ'}
              </button>
            )}
          </div>
          <Input
            type="number"
            step="0.0001"
            value={form.tonPriceUsd}
            onChange={e => set('tonPriceUsd', e.target.value)}
            placeholder="3.18"
            required
            readOnly={!!allocationRate && !entry}
            className={allocationRate && !entry ? 'opacity-70 cursor-not-allowed' : ''}
          />
          {allocationRate && !entry && (
            <p className="text-xs text-blue-400">
              อัตราจาก Deposit {new Date(allocationRate.depositedAt).toLocaleDateString('th-TH')}
              {' · '}คงเหลือ {allocationRate.remainingTon.toFixed(2)} TON
            </p>
          )}
          {fetchedAt && !allocationRate && <p className="text-xs text-green-500">อัปเดต {fetchedAt}</p>}
        </div>
        <div className="space-y-2">
          <Label>อัตรา USD/THB</Label>
          <Input
            type="number"
            step="0.0001"
            value={form.usdThbRate}
            onChange={e => set('usdThbRate', e.target.value)}
            placeholder="32.45"
            required
            readOnly={!!allocationRate && !entry}
            className={allocationRate && !entry ? 'opacity-70 cursor-not-allowed' : ''}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Views</Label>
          <Input type="number" value={form.views} onChange={e => set('views', e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label>Clicks</Label>
          <Input type="number" value={form.clicks} onChange={e => set('clicks', e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label>{joinsLabel}</Label>
          <Input type="number" value={form.joins} onChange={e => set('joins', e.target.value)} required />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Note (optional)</Label>
        <Textarea value={form.note} onChange={e => set('note', e.target.value)} rows={2} />
      </div>

      {preview && (
        <div className="rounded-lg border border-green-800 bg-green-950/20 p-3 text-sm">
          <p className="text-xs text-muted-foreground mb-2">Preview</p>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <span>BSP: <strong>{preview.bsp.toFixed(1)}%</strong></span>
            <span>CTR: <strong>{preview.ctr.toFixed(2)}%</strong></span>
            <span>CR: <strong>{preview.cr.toFixed(2)}%</strong></span>
            <span>CPC: <strong>฿{(preview.cpc * parseFloat(form.usdThbRate || '0')).toFixed(2)}</strong></span>
            <span>CPS: <strong>฿{(preview.cps * parseFloat(form.usdThbRate || '0')).toFixed(2)}</strong></span>
            <span>CPM: <strong>฿{(preview.cpm * parseFloat(form.usdThbRate || '0')).toFixed(2)}</strong></span>
            <span className="col-span-3">มูลค่า: <strong>฿{preview.spendThb.toLocaleString('th-TH', { maximumFractionDigits: 0 })}</strong></span>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-3">
        <Button type="submit" disabled={loading}>
          {loading ? 'กำลังบันทึก...' : entryId ? 'บันทึกการแก้ไข' : 'บันทึก Entry'}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          ยกเลิก
        </Button>
      </div>
    </form>
  )
}
