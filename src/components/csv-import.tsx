'use client'

import { useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface ParsedRow {
  date: string
  impressions: number
  views: number
  clicks: number
  joins: number
  spendTon?: number
}

function parseCSV(text: string): ParsedRow[] {
  const lines = text.trim().split(/\r?\n/)
  if (lines.length < 2) return []

  const delim = lines[0].includes('\t') ? '\t' : ','
  const headers = lines[0].split(delim).map(h => h.trim().toLowerCase().replace(/['"]/g, ''))

  const col = (names: string[]) => headers.findIndex(h => names.some(n => h.includes(n)))

  const dateIdx = col(['date', 'day'])
  const impIdx = col(['impression'])
  const viewIdx = col(['view'])
  const clickIdx = col(['click'])
  const joinIdx = col(['join', 'started bot', 'startbot'])
  const spendIdx = col(['amount'])

  const rows: ParsedRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(delim).map(c => c.trim().replace(/['"]/g, ''))
    if (!cells[dateIdx]) continue

    const raw = cells[dateIdx]
    if (/total|sum|average|avg/i.test(raw)) continue
    const date = new Date(raw)
    if (isNaN(date.getTime())) continue

    // ใช้ local date methods เพื่อหลีกเลี่ยง UTC timezone offset bug
    const isoDate = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0'),
    ].join('-')

    const views = viewIdx >= 0 ? parseInt(cells[viewIdx]) || 0 : 0
    const clicks = clickIdx >= 0 ? parseInt(cells[clickIdx]) || 0 : 0
    const joins = joinIdx >= 0 ? parseInt(cells[joinIdx]) || 0 : 0
    const impressions = impIdx >= 0 ? parseInt(cells[impIdx]) || 0 : 0
    const spendRaw = spendIdx >= 0 ? parseFloat(cells[spendIdx].replace(',', '.')) : NaN
    const spendTon = isNaN(spendRaw) ? undefined : spendRaw

    if (views === 0 && clicks === 0 && joins === 0 && !spendTon) continue

    rows.push({ date: isoDate, impressions, views, clicks, joins, spendTon })
  }
  return rows
}

export function CsvImport({ campaignId, targetType, defaultDailyBudget }: {
  campaignId: string
  targetType: string
  defaultDailyBudget?: string
}) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const joinsLabel = targetType === 'BOT' ? 'Startbot' : 'Joins'

  const [rows, setRows] = useState<ParsedRow[]>([])
  const [globals, setGlobals] = useState({
    spendTon: '',
    tonPriceUsd: '',
    usdThbRate: '',
  })
  const [fetching, setFetching] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [fetchedAt, setFetchedAt] = useState('')

  const hasSpendData = rows.some(r => r.spendTon !== undefined)

  function setG(key: string, value: string) {
    setGlobals(g => ({ ...g, [key]: value }))
  }

  async function fetchRates() {
    setFetching(true)
    try {
      const res = await fetch('/api/rates')
      if (res.ok) {
        const data = await res.json()
        setGlobals(g => ({
          ...g,
          tonPriceUsd: data.tonUsd.toFixed(4),
          usdThbRate: data.usdThb.toFixed(4),
        }))
        setFetchedAt(new Date(data.fetchedAt).toLocaleTimeString('th-TH'))
      }
    } finally {
      setFetching(false)
    }
  }

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return

    const readFile = (file: File): Promise<ParsedRow[]> =>
      new Promise(resolve => {
        const reader = new FileReader()
        reader.onload = ev => resolve(parseCSV(ev.target?.result as string))
        reader.readAsText(file)
      })

    Promise.all(files.map(readFile)).then(results => {
      const byDate = new Map<string, ParsedRow>()
      for (const row of results.flat()) {
        const existing = byDate.get(row.date)
        if (!existing) {
          byDate.set(row.date, { ...row })
        } else {
          byDate.set(row.date, {
            date: row.date,
            impressions: Math.max(existing.impressions, row.impressions),
            views: Math.max(existing.views, row.views),
            clicks: Math.max(existing.clicks, row.clicks),
            joins: Math.max(existing.joins, row.joins),
            spendTon: existing.spendTon ?? row.spendTon,
          })
        }
      }

      const merged = Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date))
      setRows(merged)
      setError(merged.length === 0 ? 'ไม่พบข้อมูลในไฟล์ หรือ format ไม่ถูกต้อง' : '')
    })
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (rows.length === 0) return
    setLoading(true)
    setError('')

    const payload = rows.map(r => ({
      ...r,
      spendTon: r.spendTon ?? parseFloat(globals.spendTon),
      dailyBudgetTon: parseFloat(defaultDailyBudget ?? '0'),
      tonPriceUsd: parseFloat(globals.tonPriceUsd),
      usdThbRate: parseFloat(globals.usdThbRate),
    }))

    try {
      const res = await fetch(`/api/campaigns/${campaignId}/entries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        router.push(`/campaigns/${campaignId}`)
        router.refresh()
      } else {
        setError('Import ล้มเหลว ลองใหม่อีกครั้ง')
      }
    } catch {
      setError('Import ล้มเหลว ลองใหม่อีกครั้ง')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-2xl">
      <div className="space-y-2">
        <Label>ไฟล์ CSV จาก Telegram Ads</Label>
        <p className="text-xs text-muted-foreground">
          เลือกได้หลายไฟล์พร้อมกัน — performance file (Views/Clicks/Joins) และ billing file (Amount TON) จะถูก merge อัตโนมัติ
        </p>
        <input ref={fileRef} type="file" accept=".csv" multiple onChange={handleFile} className="hidden" id="csv-file" />
        <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>
          เลือกไฟล์ CSV
        </Button>
        {rows.length > 0 && (
          <p className="text-sm text-green-500">พบ {rows.length} แถวที่มีข้อมูล</p>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>

      {rows.length > 0 && (
        <>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">ค่าที่ใช้กับทุกแถว</p>
              <button type="button" onClick={fetchRates} disabled={fetching} className="text-xs text-blue-400 hover:underline disabled:opacity-50">
                {fetching ? 'กำลังดึง...' : '↻ ดึง Rate อัตโนมัติ'}
              </button>
            </div>
            {fetchedAt && <p className="text-xs text-green-500">อัปเดต {fetchedAt}</p>}
            {!defaultDailyBudget && (
              <p className="text-xs text-yellow-500">⚠ Campaign นี้ยังไม่ได้ตั้งงบต่อวัน BSP จะเป็น 0 — แก้ได้ที่หน้าแก้ไข Campaign</p>
            )}
            {defaultDailyBudget && (
              <p className="text-xs text-muted-foreground">งบต่อวัน: <strong>{defaultDailyBudget} TON</strong> (จาก Campaign)</p>
            )}
            <div className="grid grid-cols-2 gap-4">
              {!hasSpendData && (
                <div className="space-y-2">
                  <Label>Spend จริงต่อวัน (TON)</Label>
                  <Input type="number" step="0.001" value={globals.spendTon} onChange={e => setG('spendTon', e.target.value)} placeholder="8.5" required />
                </div>
              )}
              {hasSpendData && (
                <div className="space-y-2">
                  <Label>Spend จริงต่อวัน (TON)</Label>
                  <p className="text-xs text-green-500 pt-1">ดึงจาก billing file อัตโนมัติ</p>
                </div>
              )}
              <div className="space-y-2">
                <Label>ราคา TON/USD</Label>
                <Input type="number" step="0.0001" value={globals.tonPriceUsd} onChange={e => setG('tonPriceUsd', e.target.value)} placeholder="3.18" required />
              </div>
              <div className="space-y-2">
                <Label>อัตรา USD/THB</Label>
                <Input type="number" step="0.0001" value={globals.usdThbRate} onChange={e => setG('usdThbRate', e.target.value)} placeholder="32.45" required />
              </div>
            </div>
          </div>

          <div>
            <p className="text-sm font-medium mb-2">Preview ({rows.length} แถว)</p>
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/30 text-muted-foreground">
                    <th className="text-left py-2 px-3">วันที่</th>
                    <th className="text-right py-2 px-3">Imp</th>
                    <th className="text-right py-2 px-3">Views</th>
                    <th className="text-right py-2 px-3">Clicks</th>
                    <th className="text-right py-2 px-3">{joinsLabel}</th>
                    {hasSpendData && <th className="text-right py-2 px-3">Spend (TON)</th>}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="py-1.5 px-3">{r.date}</td>
                      <td className="text-right py-1.5 px-3">{r.impressions.toLocaleString()}</td>
                      <td className="text-right py-1.5 px-3">{r.views.toLocaleString()}</td>
                      <td className="text-right py-1.5 px-3">{r.clicks.toLocaleString()}</td>
                      <td className="text-right py-1.5 px-3">{r.joins.toLocaleString()}</td>
                      {hasSpendData && (
                        <td className="text-right py-1.5 px-3">{r.spendTon?.toFixed(4) ?? '—'}</td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex gap-3">
            <Button type="submit" disabled={loading}>
              {loading ? 'กำลัง Import...' : `Import ${rows.length} แถว`}
            </Button>
            <Button type="button" variant="outline" onClick={() => { setRows([]); if (fileRef.current) fileRef.current.value = '' }}>
              ยกเลิก
            </Button>
          </div>
        </>
      )}
    </form>
  )
}
