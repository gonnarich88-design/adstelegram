'use client'

import { useState, Fragment } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

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

function SummaryCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-lg border p-3 text-center">
      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-lg font-bold ${color ?? ''}`}>{value}</p>
    </div>
  )
}

// InputRow ต้องอยู่นอก ConversionsClient เสมอ — ถ้าอยู่ใน render function
// React จะสร้าง component ใหม่ทุก render ทำให้ input เสีย focus
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

export function ConversionsClient({ records }: { records: ConversionRow[] }) {
  const router = useRouter()
  const emptyForm: FormState = { date: todayStr(), registrations: '', depositCount: '', depositTxCount: '', depositAmountThb: '', note: '' }

  const [form, setForm] = useState<FormState>(emptyForm)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<FormState>(emptyForm)
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError] = useState('')

  const [deletingId, setDeletingId] = useState<string | null>(null)

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
        }),
      })
      if (res.ok) {
        setForm({ ...emptyForm, date: todayStr() })
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
                    {sorted.map(r => (
                      <Fragment key={r.id}>
                        <tr className="hover:bg-muted/10">
                          <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{fmtDate(r.date)}</td>
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
                                {editError && <p className="text-xs text-destructive">{editError}</p>}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
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
