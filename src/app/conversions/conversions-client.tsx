'use client'

import { useState, Fragment } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ChevronDown, ChevronRight, Trash2 } from 'lucide-react'

export interface BreakdownItem {
  id: string
  channelName: string
  campaignId: string | null
  registrations: number
  depositCount: number
  depositTxCount: number
  depositAmountThb: number
}

export interface ConversionRow {
  id: string
  date: string
  registrations: number
  depositCount: number
  depositTxCount: number
  depositAmountThb: number
  note: string | null
  spendThb: number | null
  cpr: number | null
  cpd: number | null
  breakdowns: BreakdownItem[]
}

// channelKey: '__tgc__' | campaignId
interface ChannelRow {
  channelKey: string
  registrations: string
  depositCount: string
  depositTxCount: string
  depositAmountThb: string
}

const TGC_KEY = '__tgc__'

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function fmtDate(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('th-TH', {
    day: 'numeric', month: 'short', year: '2-digit',
  })
}

function fmtMonth(key: string) {
  return new Date(key + '-01T00:00:00').toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })
}

function fmtThb(n: number) {
  return '฿' + Math.round(n).toLocaleString('th-TH')
}

function emptyRow(): ChannelRow {
  return { channelKey: '', registrations: '0', depositCount: '0', depositTxCount: '0', depositAmountThb: '0' }
}

function computeTotals(rows: ChannelRow[]) {
  return rows.filter(r => r.channelKey).reduce(
    (acc, r) => ({
      registrations: acc.registrations + (parseInt(r.registrations) || 0),
      depositCount: acc.depositCount + (parseInt(r.depositCount) || 0),
      depositTxCount: acc.depositTxCount + (parseInt(r.depositTxCount) || 0),
      depositAmountThb: acc.depositAmountThb + (parseFloat(r.depositAmountThb) || 0),
    }),
    { registrations: 0, depositCount: 0, depositTxCount: 0, depositAmountThb: 0 }
  )
}

function serializeRows(rows: ChannelRow[], campaigns: { id: string; name: string }[]) {
  return rows.filter(r => r.channelKey).map(r => {
    if (r.channelKey === TGC_KEY) {
      return {
        channelName: 'tgc',
        campaignId: null,
        registrations: parseInt(r.registrations) || 0,
        depositCount: parseInt(r.depositCount) || 0,
        depositTxCount: parseInt(r.depositTxCount) || 0,
        depositAmountThb: parseFloat(r.depositAmountThb) || 0,
      }
    }
    const campaign = campaigns.find(c => c.id === r.channelKey)
    return {
      channelName: campaign?.name ?? r.channelKey,
      campaignId: r.channelKey,
      registrations: parseInt(r.registrations) || 0,
      depositCount: parseInt(r.depositCount) || 0,
      depositTxCount: parseInt(r.depositTxCount) || 0,
      depositAmountThb: parseFloat(r.depositAmountThb) || 0,
    }
  })
}

function breakdownsToRows(
  breakdowns: BreakdownItem[],
  campaigns: { id: string; name: string }[]
): ChannelRow[] {
  return breakdowns.map(b => ({
    channelKey: b.channelName === 'tgc' ? TGC_KEY : (b.campaignId ?? b.channelName),
    registrations: b.registrations.toString(),
    depositCount: b.depositCount.toString(),
    depositTxCount: b.depositTxCount.toString(),
    depositAmountThb: b.depositAmountThb.toFixed(2),
  }))
}

function SummaryCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-lg border p-3 text-center">
      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-lg font-bold ${color ?? ''}`}>{value}</p>
    </div>
  )
}

// --- Channel rows form (extracted outside main component to avoid focus loss) ---

function ChannelRowsForm({
  rows,
  campaigns,
  onChange,
}: {
  rows: ChannelRow[]
  campaigns: { id: string; name: string }[]
  onChange: (rows: ChannelRow[]) => void
}) {
  const usedKeys = new Set(rows.map(r => r.channelKey))
  const maxRows = 1 + campaigns.length

  function update(idx: number, field: keyof ChannelRow, value: string) {
    onChange(rows.map((r, i) => i === idx ? { ...r, [field]: value } : r))
  }

  function remove(idx: number) {
    onChange(rows.filter((_, i) => i !== idx))
  }

  return (
    <div className="space-y-1">
      <div className="grid text-xs text-muted-foreground font-medium border-b pb-1"
        style={{ gridTemplateColumns: '2fr 80px 80px 80px 90px 28px' }}>
        <span>ช่องทาง</span>
        <span className="text-right">สมัคร</span>
        <span className="text-right">ฝาก</span>
        <span className="text-right">รายการ</span>
        <span className="text-right">ยอดฝาก</span>
        <span />
      </div>

      {rows.map((row, idx) => (
        <div key={idx} className="grid gap-1.5 items-center"
          style={{ gridTemplateColumns: '2fr 80px 80px 80px 90px 28px' }}>
          <select
            className="rounded border bg-background px-2 py-1.5 text-sm"
            value={row.channelKey}
            onChange={e => update(idx, 'channelKey', e.target.value)}
          >
            <option value="">-- ช่องทาง --</option>
            <option
              value={TGC_KEY}
              disabled={usedKeys.has(TGC_KEY) && row.channelKey !== TGC_KEY}
            >
              tgc (organic)
            </option>
            {campaigns.length > 0 && (
              <optgroup label="แคมเปญ">
                {campaigns.map(c => (
                  <option
                    key={c.id}
                    value={c.id}
                    disabled={usedKeys.has(c.id) && row.channelKey !== c.id}
                  >
                    {c.name}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
          <input type="number" min="0" step="1"
            className="rounded border bg-background px-2 py-1.5 text-sm text-right"
            value={row.registrations} onChange={e => update(idx, 'registrations', e.target.value)}
            onFocus={e => e.target.select()} />
          <input type="number" min="0" step="1"
            className="rounded border bg-background px-2 py-1.5 text-sm text-right"
            value={row.depositCount} onChange={e => update(idx, 'depositCount', e.target.value)}
            onFocus={e => e.target.select()} />
          <input type="number" min="0" step="1"
            className="rounded border bg-background px-2 py-1.5 text-sm text-right"
            value={row.depositTxCount} onChange={e => update(idx, 'depositTxCount', e.target.value)}
            onFocus={e => e.target.select()} />
          <input type="number" min="0" step="0.01"
            className="rounded border bg-background px-2 py-1.5 text-sm text-right"
            value={row.depositAmountThb} onChange={e => update(idx, 'depositAmountThb', e.target.value)}
            onFocus={e => e.target.select()} />
          <button type="button" onClick={() => remove(idx)}
            className="flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors">
            <Trash2 size={13} />
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={() => onChange([...rows, emptyRow()])}
        disabled={rows.length >= maxRows}
        className="mt-1 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
      >
        + เพิ่มช่องทาง
      </button>
    </div>
  )
}

// --- Main component ---

export function ConversionsClient({
  records,
  campaigns,
}: {
  records: ConversionRow[]
  campaigns: { id: string; name: string }[]
}) {
  const router = useRouter()

  // Add form state
  const [addDate, setAddDate] = useState(todayStr())
  const [addNote, setAddNote] = useState('')
  const [addRows, setAddRows] = useState<ChannelRow[]>([emptyRow()])
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDate, setEditDate] = useState('')
  const [editNote, setEditNote] = useState('')
  const [editRows, setEditRows] = useState<ChannelRow[]>([])
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError] = useState('')

  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  function toggleExpand(id: string) {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function validateRows(date: string, rows: ChannelRow[]): string | null {
    if (!date) return 'กรุณาใส่วันที่'
    const filled = rows.filter(r => r.channelKey)
    if (filled.length === 0) return 'กรุณาเลือกช่องทางอย่างน้อย 1 ช่องทาง'
    return null
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const err = validateRows(addDate, addRows)
    if (err) { setFormError(err); return }
    setSubmitting(true)
    setFormError('')
    const totals = computeTotals(addRows)
    const breakdowns = serializeRows(addRows, campaigns)
    try {
      const res = await fetch('/api/conversions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: addDate, ...totals, note: addNote || null, breakdowns }),
      })
      if (res.ok) {
        setAddDate(todayStr())
        setAddNote('')
        setAddRows([emptyRow()])
        router.refresh()
      } else {
        const data = await res.json()
        setFormError(data.error === 'DUPLICATE_DATE'
          ? 'มีข้อมูลวันนี้แล้ว กรุณาแก้ไขแทน'
          : (data.error ?? 'บันทึกไม่สำเร็จ'))
      }
    } catch {
      setFormError('บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง')
    } finally {
      setSubmitting(false)
    }
  }

  function startEdit(r: ConversionRow) {
    setEditingId(r.id)
    setEditDate(r.date)
    setEditNote(r.note ?? '')
    setEditRows(
      r.breakdowns.length > 0
        ? breakdownsToRows(r.breakdowns, campaigns)
        : [emptyRow()]
    )
    setEditError('')
  }

  async function handleSaveEdit(id: string) {
    const err = validateRows(editDate, editRows)
    if (err) { setEditError(err); return }
    setEditLoading(true)
    setEditError('')
    const totals = computeTotals(editRows)
    const breakdowns = serializeRows(editRows, campaigns)
    try {
      const res = await fetch(`/api/conversions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: editDate, ...totals, note: editNote || null, breakdowns }),
      })
      if (res.ok) {
        setEditingId(null)
        router.refresh()
      } else {
        const data = await res.json()
        setEditError(data.error === 'DUPLICATE_DATE'
          ? 'วันที่ซ้ำกับรายการอื่น'
          : (data.error ?? 'บันทึกไม่สำเร็จ'))
      }
    } catch {
      setEditError('บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง')
    } finally {
      setEditLoading(false)
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    try {
      const res = await fetch(`/api/conversions/${id}`, { method: 'DELETE' })
      if (res.ok) {
        router.refresh()
      } else {
        const data = await res.json()
        alert(data.error ?? 'ลบไม่สำเร็จ')
      }
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <h1 className="text-2xl font-bold">Conversions</h1>

      {/* Add form */}
      <div className="rounded-md border p-4 space-y-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">บันทึกรายวัน</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium">วันที่ *</label>
            <input
              type="date"
              className="rounded-md border bg-background px-3 py-1.5 text-sm"
              value={addDate}
              onChange={e => setAddDate(e.target.value)}
            />
          </div>

          <ChannelRowsForm rows={addRows} campaigns={campaigns} onChange={setAddRows} />

          <div className="flex items-end gap-3 pt-1">
            <div className="flex-1 space-y-1.5">
              <label className="text-xs font-medium">หมายเหตุ</label>
              <input
                type="text"
                className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
                placeholder="optional"
                value={addNote}
                onChange={e => setAddNote(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'กำลังบันทึก...' : '+ บันทึก'}
            </Button>
          </div>

          {formError && <p className="text-xs text-destructive">{formError}</p>}
        </form>
      </div>

      {/* Monthly sections */}
      {records.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">ยังไม่มีข้อมูล</p>
      ) : (() => {
        const byMonth = new Map<string, ConversionRow[]>()
        for (const r of records) {
          const key = r.date.slice(0, 7)
          const arr = byMonth.get(key) ?? []
          arr.push(r)
          byMonth.set(key, arr)
        }
        const months = [...byMonth.entries()].sort((a, b) => b[0].localeCompare(a[0]))

        return months.map(([monthKey, monthRows]) => {
          const totalReg = monthRows.reduce((s, r) => s + r.registrations, 0)
          const totalDep = monthRows.reduce((s, r) => s + r.depositCount, 0)
          const totalTx = monthRows.reduce((s, r) => s + r.depositTxCount, 0)
          const totalAmt = monthRows.reduce((s, r) => s + r.depositAmountThb, 0)
          const totalSpend = monthRows.reduce((s, r) => s + (r.spendThb ?? 0), 0)
          const cpr = totalReg > 0 && totalSpend > 0 ? totalSpend / totalReg : null
          const cpd = totalDep > 0 && totalSpend > 0 ? totalSpend / totalDep : null
          const sorted = [...monthRows].sort((a, b) => b.date.localeCompare(a.date))

          return (
            <div key={monthKey} className="rounded-md border overflow-hidden">
              <div className="px-4 py-3 bg-muted/20 border-b flex items-center justify-between">
                <h2 className="font-semibold">{fmtMonth(monthKey)}</h2>
                <span className="text-xs text-muted-foreground">{monthRows.length} วัน</span>
              </div>

              <div className="p-4 grid grid-cols-3 md:grid-cols-6 gap-3">
                <SummaryCard label="สมาชิกใหม่" value={totalReg.toLocaleString()} color="text-green-400" />
                <SummaryCard label="สมาชิกฝาก" value={totalDep.toLocaleString()} color="text-blue-400" />
                <SummaryCard label="รายการฝาก" value={totalTx.toLocaleString()} color="text-blue-300" />
                <SummaryCard label="ยอดฝาก" value={fmtThb(totalAmt)} />
                <SummaryCard label="CPR (฿)" value={cpr !== null ? fmtThb(cpr) : '—'} color="text-amber-400" />
                <SummaryCard label="CPD (฿)" value={cpd !== null ? fmtThb(cpd) : '—'} color="text-amber-400" />
              </div>

              <div className="overflow-x-auto border-t">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/20 text-xs text-muted-foreground">
                      <th className="px-3 py-2 text-left font-medium whitespace-nowrap">วันที่</th>
                      <th className="px-3 py-2 text-right font-medium whitespace-nowrap">สมาชิกสมัครใหม่</th>
                      <th className="px-3 py-2 text-right font-medium whitespace-nowrap">สมาชิกที่ฝากเงิน</th>
                      <th className="px-3 py-2 text-right font-medium whitespace-nowrap">รายการฝาก</th>
                      <th className="px-3 py-2 text-right font-medium whitespace-nowrap">ยอดฝาก</th>
                      <th className="px-3 py-2 text-right font-medium whitespace-nowrap">CPR (฿)</th>
                      <th className="px-3 py-2 text-right font-medium whitespace-nowrap">CPD (฿)</th>
                      <th className="px-1 py-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {sorted.map(r => {
                      const isExpanded = expandedIds.has(r.id)
                      const hasBreakdowns = r.breakdowns.length > 0
                      return (
                        <Fragment key={r.id}>
                          <tr className="hover:bg-muted/10">
                            <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                {hasBreakdowns ? (
                                  <button
                                    onClick={() => toggleExpand(r.id)}
                                    className="text-muted-foreground hover:text-foreground transition-colors"
                                    title="ดูแยกตามช่องทาง"
                                  >
                                    {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                                  </button>
                                ) : (
                                  <span className="w-[13px]" />
                                )}
                                {fmtDate(r.date)}
                              </div>
                            </td>
                            <td className="px-3 py-2.5 text-right font-medium text-green-400">{r.registrations.toLocaleString()}</td>
                            <td className="px-3 py-2.5 text-right font-medium text-blue-400">{r.depositCount.toLocaleString()}</td>
                            <td className="px-3 py-2.5 text-right font-medium text-blue-300">{r.depositTxCount.toLocaleString()}</td>
                            <td className="px-3 py-2.5 text-right">{fmtThb(r.depositAmountThb)}</td>
                            <td className="px-3 py-2.5 text-right text-amber-400">{r.cpr !== null ? fmtThb(r.cpr) : '—'}</td>
                            <td className="px-3 py-2.5 text-right text-amber-400">{r.cpd !== null ? fmtThb(r.cpd) : '—'}</td>
                            <td className="px-1 py-2.5">
                              <div className="flex gap-0.5">
                                <Button size="sm" variant="ghost" className="h-6 px-2 text-xs"
                                  onClick={() => editingId === r.id ? setEditingId(null) : startEdit(r)}>
                                  {editingId === r.id ? 'ยกเลิก' : 'แก้ไข'}
                                </Button>
                                <Button size="sm" variant="ghost" className="text-destructive h-6 px-2 text-xs"
                                  disabled={deletingId === r.id} onClick={() => handleDelete(r.id)}>
                                  ลบ
                                </Button>
                              </div>
                            </td>
                          </tr>

                          {/* Breakdown expand */}
                          {hasBreakdowns && isExpanded && (
                            <tr>
                              <td colSpan={8} className="px-6 pb-3 pt-1 bg-muted/5">
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="text-muted-foreground border-b border-border/40">
                                      <th className="text-left py-1.5 font-medium">ช่องทาง</th>
                                      <th className="text-right py-1.5 px-3 font-medium">สมัคร</th>
                                      <th className="text-right py-1.5 px-3 font-medium">ฝาก</th>
                                      <th className="text-right py-1.5 px-3 font-medium">รายการ</th>
                                      <th className="text-right py-1.5 px-3 font-medium">ยอดฝาก</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {r.breakdowns.map(b => (
                                      <tr key={b.id} className="border-b border-border/20">
                                        <td className="py-1.5 font-mono text-muted-foreground">{b.channelName}</td>
                                        <td className="py-1.5 px-3 text-right text-green-400">{b.registrations.toLocaleString()}</td>
                                        <td className="py-1.5 px-3 text-right text-blue-400">{b.depositCount.toLocaleString()}</td>
                                        <td className="py-1.5 px-3 text-right text-blue-300">{b.depositTxCount.toLocaleString()}</td>
                                        <td className="py-1.5 px-3 text-right">{fmtThb(b.depositAmountThb)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </td>
                            </tr>
                          )}

                          {/* Edit inline */}
                          {editingId === r.id && (
                            <tr>
                              <td colSpan={8} className="px-3 pb-4 pt-1">
                                <div className="space-y-4 rounded-md border p-3 bg-muted/10">
                                  <div className="space-y-1.5">
                                    <label className="text-xs font-medium">วันที่</label>
                                    <input
                                      type="date"
                                      className="rounded-md border bg-background px-3 py-1.5 text-sm"
                                      value={editDate}
                                      onChange={e => setEditDate(e.target.value)}
                                    />
                                  </div>

                                  <ChannelRowsForm
                                    rows={editRows}
                                    campaigns={campaigns}
                                    onChange={setEditRows}
                                  />

                                  <div className="flex items-end gap-3">
                                    <div className="flex-1 space-y-1.5">
                                      <label className="text-xs font-medium">หมายเหตุ</label>
                                      <input type="text" className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
                                        value={editNote} onChange={e => setEditNote(e.target.value)} />
                                    </div>
                                    <Button size="sm" disabled={editLoading} onClick={() => handleSaveEdit(r.id)}>
                                      {editLoading ? 'กำลังบันทึก...' : 'บันทึก'}
                                    </Button>
                                  </div>

                                  {editError && <p className="text-xs text-destructive">{editError}</p>}
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )
        })
      })()}
    </div>
  )
}
