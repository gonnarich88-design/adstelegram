'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export interface ChangeLog {
  id: string
  campaignId: string
  changedAt: string
  field: string | null
  oldValue: string | null
  newValue: string | null
  note: string | null
}

const FIELD_LABELS: Record<string, string> = {
  name: 'ชื่อแคมเปญ',
  targetType: 'ประเภท',
  targetName: 'Target',
  startDate: 'วันเริ่ม',
  endDate: 'วันสิ้นสุด',
  budgetTon: 'งบรวม (TON)',
  dailyBudgetTon: 'งบรายวัน (TON)',
  bidCpmTon: 'CPM Bid (TON)',
  status: 'สถานะ',
  placementName: 'Placement',
}

function formatValue(field: string | null, val: string | null): string {
  if (val == null) return '—'
  if (field === 'dailyBudgetTon' || field === 'bidCpmTon' || field === 'budgetTon') {
    const n = parseFloat(val)
    return isNaN(n) ? val : n.toFixed(4)
  }
  return val
}

function fmtDateTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('th-TH', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'Asia/Bangkok',
  })
}

function groupByTime(logs: ChangeLog[]): Array<{ time: string; items: ChangeLog[] }> {
  const map = new Map<string, ChangeLog[]>()
  for (const l of logs) {
    if (!map.has(l.changedAt)) map.set(l.changedAt, [])
    map.get(l.changedAt)!.push(l)
  }
  return Array.from(map.entries())
    .map(([time, items]) => ({ time, items }))
    .sort((a, b) => b.time.localeCompare(a.time))
}

export function CampaignChangelog({
  campaignId,
  logs,
}: {
  campaignId: string
  logs: ChangeLog[]
}) {
  const router = useRouter()
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const groups = groupByTime(logs)

  async function handleAddNote(e: React.FormEvent) {
    e.preventDefault()
    if (!note.trim()) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/changelog`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: note.trim() }),
      })
      if (res.ok) {
        setNote('')
        router.refresh()
      } else {
        const data = await res.json()
        setError(data.error ?? 'บันทึกไม่สำเร็จ')
      }
    } catch {
      setError('บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">ประวัติการเปลี่ยนแปลง</h2>

      <form onSubmit={handleAddNote} className="flex gap-2">
        <input
          type="text"
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="บันทึกหมายเหตุ..."
          className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <button
          type="submit"
          disabled={loading || !note.trim()}
          className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted/50 disabled:opacity-50"
        >
          {loading ? '...' : '+ บันทึก'}
        </button>
      </form>
      {error && <p className="text-xs text-destructive">{error}</p>}

      {groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">ยังไม่มีประวัติ</p>
      ) : (
        <div className="space-y-3">
          {groups.map(({ time, items }) => {
            const fieldChanges = items.filter(l => l.field !== null)
            const notes = items.filter(l => l.field === null && l.note)
            return (
              <div key={time} className="rounded-lg border border-muted/40 p-3 space-y-1.5">
                <p className="text-xs text-muted-foreground">{fmtDateTime(time)}</p>
                {fieldChanges.map(l => (
                  <div key={l.id} className="flex items-baseline gap-2 text-sm">
                    <span className="text-muted-foreground text-xs min-w-[120px]">
                      {FIELD_LABELS[l.field!] ?? l.field}
                    </span>
                    <span className="text-muted-foreground/60 line-through text-xs">
                      {formatValue(l.field, l.oldValue)}
                    </span>
                    <span className="text-xs text-muted-foreground">→</span>
                    <span className="font-medium text-xs">{formatValue(l.field, l.newValue)}</span>
                  </div>
                ))}
                {notes.map(l => (
                  <p key={l.id} className="text-xs text-muted-foreground">
                    💬 {l.note}
                  </p>
                ))}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
