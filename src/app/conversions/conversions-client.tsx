'use client'

import { useState, Fragment } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react'

export interface BreakdownItem {
  id: string
  campaignId: string
  campaignName: string
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

interface BreakdownFormRow {
  campaignId: string
  registrations: string
  depositCount: string
  depositTxCount: string
  depositAmountThb: string
}

interface FormState {
  date: string
  registrations: string
  depositCount: string
  depositTxCount: string
  depositAmountThb: string
  note: string
}

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

function emptyBreakdown(): BreakdownFormRow {
  return { campaignId: '', registrations: '0', depositCount: '0', depositTxCount: '0', depositAmountThb: '0' }
}

function SummaryCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-lg border p-3 text-center">
      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-lg font-bold ${color ?? ''}`}>{value}</p>
    </div>
  )
}

// --- Extracted components (outside ConversionsClient to avoid focus loss on re-render) ---

function InputRow({ f, setF }: { f: FormState; setF: (fn: (prev: FormState) => FormState) => void }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
      <div className="space-y-1.5">
        <label className="text-xs font-medium">วันที่ *</label>
        <input type="date" className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
          value={f.date} onChange={e => setF(p => ({ ...p, date: e.target.value }))} />
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-medium">จำนวนสมาชิกสมัครใหม่ *</label>
        <input type="number" min="0" step="1" className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
          value={f.registrations} onChange={e => setF(p => ({ ...p, registrations: e.target.value }))} />
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-medium">จำนวนสมาชิกที่ฝากเงิน *</label>
        <input type="number" min="0" step="1" className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
          value={f.depositCount} onChange={e => setF(p => ({ ...p, depositCount: e.target.value }))} />
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-medium">จำนวนรายการฝาก *</label>
        <input type="number" min="0" step="1" className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
          value={f.depositTxCount} onChange={e => setF(p => ({ ...p, depositTxCount: e.target.value }))} />
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-medium">ยอดฝาก (฿) *</label>
        <input type="number" min="0" step="0.01" className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
          value={f.depositAmountThb} onChange={e => setF(p => ({ ...p, depositAmountThb: e.target.value }))} />
      </div>
    </div>
  )
}

function BreakdownFormSection({
  rows,
  campaigns,
  onChange,
}: {
  rows: BreakdownFormRow[]
  campaigns: { id: string; name: string }[]
  onChange: (rows: BreakdownFormRow[]) => void
}) {
  function update(idx: number, field: keyof BreakdownFormRow, value: string) {
    const next = rows.map((r, i) => i === idx ? { ...r, [field]: value } : r)
    onChange(next)
  }
  function remove(idx: number) {
    onChange(rows.filter((_, i) => i !== idx))
  }
  function add() {
    onChange([...rows, emptyBreakdown()])
  }

  const usedCampaignIds = new Set(rows.map(r => r.campaignId))

  return (
    <div className="space-y-2">
      {rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-muted-foreground border-b">
                <th className="text-left py-1.5 pr-2 font-medium">แคมเปญ</th>
                <th className="text-right py-1.5 px-2 font-medium">สมัคร</th>
                <th className="text-right py-1.5 px-2 font-medium">ฝาก</th>
                <th className="text-right py-1.5 px-2 font-medium">รายการ</th>
                <th className="text-right py-1.5 px-2 font-medium">ยอดฝาก</th>
                <th className="py-1.5 w-6"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={idx} className="border-b border-border/30">
                  <td className="py-1.5 pr-2">
                    <select
                      className="w-full rounded border bg-background px-2 py-1 text-xs"
                      value={row.campaignId}
                      onChange={e => update(idx, 'campaignId', e.target.value)}
                    >
                      <option value="">-- เลือกแคมเปญ --</option>
                      {campaigns.map(c => (
                        <option key={c.id} value={c.id}
                          disabled={usedCampaignIds.has(c.id) && c.id !== row.campaignId}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-1.5 px-2">
                    <input type="number" min="0" step="1"
                      className="w-16 rounded border bg-background px-2 py-1 text-xs text-right"
                      value={row.registrations} onChange={e => update(idx, 'registrations', e.target.value)} />
                  </td>
                  <td className="py-1.5 px-2">
                    <input type="number" min="0" step="1"
                      className="w-16 rounded border bg-background px-2 py-1 text-xs text-right"
                      value={row.depositCount} onChange={e => update(idx, 'depositCount', e.target.value)} />
                  </td>
                  <td className="py-1.5 px-2">
                    <input type="number" min="0" step="1"
                      className="w-16 rounded border bg-background px-2 py-1 text-xs text-right"
                      value={row.depositTxCount} onChange={e => update(idx, 'depositTxCount', e.target.value)} />
                  </td>
                  <td className="py-1.5 px-2">
                    <input type="number" min="0" step="0.01"
                      className="w-20 rounded border bg-background px-2 py-1 text-xs text-right"
                      value={row.depositAmountThb} onChange={e => update(idx, 'depositAmountThb', e.target.value)} />
                  </td>
                  <td className="py-1.5 pl-1">
                    <button type="button" onClick={() => remove(idx)}
                      className="text-muted-foreground hover:text-destructive transition-colors">
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <button
        type="button"
        onClick={add}
        disabled={rows.length >= campaigns.length}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
      >
        <Plus size={12} /> เพิ่มแคมเปญ
      </button>
    </div>
  )
}

// --- Main client component ---

export function ConversionsClient({
  records,
  campaigns,
}: {
  records: ConversionRow[]
  campaigns: { id: string; name: string }[]
}) {
  const router = useRouter()
  const emptyForm: FormState = { date: todayStr(), registrations: '', depositCount: '', depositTxCount: '', depositAmountThb: '', note: '' }

  const [form, setForm] = useState<FormState>(emptyForm)
  const [formBreakdowns, setFormBreakdowns] = useState<BreakdownFormRow[]>([])
  const [showFormBreakdown, setShowFormBreakdown] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<FormState>(emptyForm)
  const [editBreakdowns, setEditBreakdowns] = useState<BreakdownFormRow[]>([])
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

  function validateForm(f: FormState): string | null {
    if (!f.date) return 'กรุณาใส่วันที่'
    const reg = parseInt(f.registrations)
    const dep = parseInt(f.depositCount)
    const tx = parseInt(f.depositTxCount)
    const amt = parseFloat(f.depositAmountThb)
    if (isNaN(reg) || reg < 0) return 'จำนวนสมาชิกสมัครใหม่ต้องเป็นจำนวนเต็มที่ไม่ติดลบ'
    if (isNaN(dep) || dep < 0) return 'จำนวนสมาชิกที่ฝากเงินต้องเป็นจำนวนเต็มที่ไม่ติดลบ'
    if (isNaN(tx) || tx < 0) return 'จำนวนรายการฝากต้องเป็นจำนวนเต็มที่ไม่ติดลบ'
    if (isNaN(amt) || amt < 0) return 'ยอดฝากต้องเป็นตัวเลขที่ไม่ติดลบ'
    return null
  }

  function serializeBreakdowns(rows: BreakdownFormRow[]) {
    return rows
      .filter(r => r.campaignId)
      .map(r => ({
        campaignId: r.campaignId,
        registrations: parseInt(r.registrations) || 0,
        depositCount: parseInt(r.depositCount) || 0,
        depositTxCount: parseInt(r.depositTxCount) || 0,
        depositAmountThb: parseFloat(r.depositAmountThb) || 0,
      }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const err = validateForm(form)
    if (err) { setFormError(err); return }
    setSubmitting(true)
    setFormError('')
    try {
      const res = await fetch('/api/conversions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: form.date,
          registrations: parseInt(form.registrations),
          depositCount: parseInt(form.depositCount),
          depositTxCount: parseInt(form.depositTxCount),
          depositAmountThb: parseFloat(form.depositAmountThb),
          note: form.note || null,
          breakdowns: serializeBreakdowns(formBreakdowns),
        }),
      })
      if (res.ok) {
        setForm({ ...emptyForm, date: todayStr() })
        setFormBreakdowns([])
        setShowFormBreakdown(false)
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
    setEditForm({
      date: r.date,
      registrations: r.registrations.toString(),
      depositCount: r.depositCount.toString(),
      depositTxCount: r.depositTxCount.toString(),
      depositAmountThb: r.depositAmountThb.toFixed(2),
      note: r.note ?? '',
    })
    setEditBreakdowns(r.breakdowns.map(b => ({
      campaignId: b.campaignId,
      registrations: b.registrations.toString(),
      depositCount: b.depositCount.toString(),
      depositTxCount: b.depositTxCount.toString(),
      depositAmountThb: b.depositAmountThb.toFixed(2),
    })))
    setEditError('')
  }

  async function handleSaveEdit(id: string) {
    const err = validateForm(editForm)
    if (err) { setEditError(err); return }
    setEditLoading(true)
    setEditError('')
    try {
      const res = await fetch(`/api/conversions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: editForm.date,
          registrations: parseInt(editForm.registrations),
          depositCount: parseInt(editForm.depositCount),
          depositTxCount: parseInt(editForm.depositTxCount),
          depositAmountThb: parseFloat(editForm.depositAmountThb),
          note: editForm.note || null,
          breakdowns: serializeBreakdowns(editBreakdowns),
        }),
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
      <div className="rounded-md border p-4 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">บันทึกรายวัน</p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <InputRow f={form} setF={setForm} />
          <div className="flex items-end gap-3">
            <div className="flex-1 space-y-1.5">
              <label className="text-xs font-medium">หมายเหตุ</label>
              <input
                type="text"
                className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
                placeholder="optional"
                value={form.note}
                onChange={e => setForm(p => ({ ...p, note: e.target.value }))}
              />
            </div>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'กำลังบันทึก...' : '+ บันทึก'}
            </Button>
          </div>

          {/* Breakdown toggle */}
          {campaigns.length > 0 && (
            <div className="border-t pt-3 space-y-2">
              <button
                type="button"
                onClick={() => setShowFormBreakdown(p => !p)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {showFormBreakdown ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                แบ่งตามแคมเปญ (optional)
                {formBreakdowns.filter(b => b.campaignId).length > 0 && (
                  <span className="ml-1 text-primary font-medium">
                    {formBreakdowns.filter(b => b.campaignId).length} แคมเปญ
                  </span>
                )}
              </button>
              {showFormBreakdown && (
                <BreakdownFormSection
                  rows={formBreakdowns}
                  campaigns={campaigns}
                  onChange={setFormBreakdowns}
                />
              )}
            </div>
          )}

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
                                    title="ดู breakdown ตามแคมเปญ"
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

                          {/* Breakdown expand row */}
                          {hasBreakdowns && isExpanded && (
                            <tr>
                              <td colSpan={8} className="px-6 pb-3 pt-0 bg-muted/5">
                                <table className="w-full text-xs mt-1">
                                  <thead>
                                    <tr className="text-muted-foreground border-b border-border/40">
                                      <th className="text-left py-1.5 font-medium">แคมเปญ</th>
                                      <th className="text-right py-1.5 px-3 font-medium">สมัคร</th>
                                      <th className="text-right py-1.5 px-3 font-medium">ฝาก</th>
                                      <th className="text-right py-1.5 px-3 font-medium">รายการ</th>
                                      <th className="text-right py-1.5 px-3 font-medium">ยอดฝาก</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {r.breakdowns.map(b => (
                                      <tr key={b.id} className="border-b border-border/20">
                                        <td className="py-1.5 text-muted-foreground">{b.campaignName}</td>
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

                          {/* Edit inline row */}
                          {editingId === r.id && (
                            <tr>
                              <td colSpan={8} className="px-3 pb-3 pt-0">
                                <div className="mt-1 space-y-3 rounded-md border p-3 bg-muted/10">
                                  <InputRow f={editForm} setF={setEditForm} />
                                  <div className="flex items-end gap-3">
                                    <div className="flex-1 space-y-1.5">
                                      <label className="text-xs font-medium">หมายเหตุ</label>
                                      <input type="text" className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
                                        value={editForm.note} onChange={e => setEditForm(p => ({ ...p, note: e.target.value }))} />
                                    </div>
                                    <Button size="sm" disabled={editLoading} onClick={() => handleSaveEdit(r.id)}>
                                      {editLoading ? 'กำลังบันทึก...' : 'บันทึก'}
                                    </Button>
                                  </div>

                                  {/* Breakdown in edit mode */}
                                  {campaigns.length > 0 && (
                                    <div className="border-t pt-3 space-y-2">
                                      <p className="text-xs font-medium text-muted-foreground">แบ่งตามแคมเปญ (optional)</p>
                                      <BreakdownFormSection
                                        rows={editBreakdowns}
                                        campaigns={campaigns}
                                        onChange={setEditBreakdowns}
                                      />
                                    </div>
                                  )}

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
