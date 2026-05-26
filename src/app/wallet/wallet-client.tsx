'use client'

import { useState, Fragment } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { DepositForm } from './deposit-form'
import { AllocateForm } from './allocate-form'

interface Campaign {
  id: string
  name: string
  status: string
  currentAllocationTon?: number
}

interface Allocation {
  id: string
  campaignId: string
  campaignName: string
  amountTon: number
  allocatedAt: string
  createdAt: string
  totalSpendTon: number
  tonPriceUsd: number
  usdThbRate: number
}

interface Deposit {
  id: string
  amountTon: number
  tonPriceUsd: number
  usdThbRate: number
  depositedAt: string
  createdAt: string
  note: string | null
  type: 'DEPOSIT' | 'REFUND'
  refundCampaignName: string | null
  remaining: number
  allocations: Allocation[]
}

type TxRow =
  | { kind: 'deposit'; id: string; amountTon: number; amountThb: number; tonPriceUsd: number; usdThbRate: number; date: string; createdAt: string; note: string | null; type: 'DEPOSIT' | 'REFUND'; refundCampaignName: string | null; remaining: number; hasAllocations: boolean }
  | { kind: 'allocation'; ids: string[]; campaignId: string; campaignName: string; amountTon: number; amountThb: number; date: string; createdAt: string; usedTon: number; remainingTon: number; splitCount: number }

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })
}

function formatThb(thb: number): string {
  return '฿' + Math.round(thb).toLocaleString('th-TH')
}

export function WalletClient({
  balance,
  balanceThb,
  currentRate,
  deposits,
  availableCampaigns,
}: {
  balance: number
  balanceThb: number
  currentRate: { tonPriceUsd: number; usdThbRate: number } | null
  deposits: Deposit[]
  availableCampaigns: Campaign[]
}) {
  const router = useRouter()
  const [showDepositForm, setShowDepositForm] = useState(false)
  const [showAllocateForm, setShowAllocateForm] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [editingAllocationId, setEditingAllocationId] = useState<string | null>(null)
  const [editAmount, setEditAmount] = useState('')
  const [editDate, setEditDate] = useState('')
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError] = useState('')
  const [deletingAllocationId, setDeletingAllocationId] = useState<string | null>(null)
  const [editingDepositId, setEditingDepositId] = useState<string | null>(null)
  const [editDepositForm, setEditDepositForm] = useState({ amountTon: '', depositedAt: '', tonPriceUsd: '', usdThbRate: '', note: '' })
  const [editDepositFetching, setEditDepositFetching] = useState(false)
  const [editDepositLoading, setEditDepositLoading] = useState(false)
  const [editDepositError, setEditDepositError] = useState('')

  function startEdit(allocationId: string, amountTon: number, date: string) {
    setEditingAllocationId(allocationId)
    setEditAmount(amountTon.toFixed(8).replace(/\.?0+$/, ''))
    setEditDate(date.split('T')[0])
    setEditError('')
    setShowAllocateForm(false)
  }

  async function handleSaveEdit(allocationId: string, maxAmount: number) {
    const amount = parseFloat(editAmount)
    if (isNaN(amount) || amount < 0.00000001 || amount > maxAmount) {
      setEditError(`จำนวนต้องอยู่ระหว่าง 0.00000001–${maxAmount.toFixed(4)}`)
      return
    }
    setEditLoading(true)
    setEditError('')
    try {
      const res = await fetch(`/api/wallet/allocations/${allocationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountTon: amount, allocatedAt: editDate }),
      })
      if (res.ok) {
        setEditingAllocationId(null)
        router.refresh()
      } else {
        const data = await res.json()
        setEditError(data.error === 'INSUFFICIENT_BALANCE' ? 'ยอดคงเหลือไม่พอ' : (data.error ?? 'บันทึกไม่สำเร็จ'))
      }
    } catch {
      setEditError('บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง')
    } finally {
      setEditLoading(false)
    }
  }

  async function handleDeleteAllocation(ids: string[]) {
    setDeletingAllocationId(ids[0])
    try {
      for (const id of ids) {
        const res = await fetch(`/api/wallet/allocations/${id}`, { method: 'DELETE' })
        if (!res.ok) {
          const data = await res.json()
          alert(data.error ?? 'ลบไม่สำเร็จ')
          return
        }
      }
      router.refresh()
    } finally {
      setDeletingAllocationId(null)
    }
  }

  async function handleDeleteDeposit(id: string) {
    setDeletingId(id)
    try {
      const res = await fetch(`/api/wallet/deposits/${id}`, { method: 'DELETE' })
      if (res.ok) {
        router.refresh()
      } else {
        const data = await res.json()
        alert(data.error ?? 'ลบไม่ได้ — deposit นี้มีการจัดสรรแล้ว')
      }
    } finally {
      setDeletingId(null)
    }
  }

  function startEditDeposit(tx: { id: string; amountTon: number; date: string; tonPriceUsd: number; usdThbRate: number; note: string | null }) {
    setEditingDepositId(tx.id)
    setEditDepositForm({
      amountTon: tx.amountTon.toFixed(8).replace(/\.?0+$/, ''),
      depositedAt: tx.date.split('T')[0],
      tonPriceUsd: tx.tonPriceUsd.toFixed(4),
      usdThbRate: tx.usdThbRate.toFixed(4),
      note: tx.note ?? '',
    })
    setEditDepositError('')
    setShowDepositForm(false)
  }

  async function fetchDepositRate(date: string) {
    if (!date) return
    setEditDepositFetching(true)
    try {
      const res = await fetch(`/api/rates/historical?from=${date}&to=${date}`)
      if (res.ok) {
        const data = await res.json()
        const rate = data[date]
        if (rate) {
          setEditDepositForm(f => ({ ...f, tonPriceUsd: rate.tonUsd.toFixed(4), usdThbRate: rate.usdThb.toFixed(4) }))
        }
      }
    } catch { /* manual fallback */ }
    finally { setEditDepositFetching(false) }
  }

  async function handleSaveDeposit(id: string) {
    const amountTon = parseFloat(editDepositForm.amountTon)
    const tonPriceUsd = parseFloat(editDepositForm.tonPriceUsd)
    const usdThbRate = parseFloat(editDepositForm.usdThbRate)
    if (isNaN(amountTon) || amountTon <= 0 || isNaN(tonPriceUsd) || tonPriceUsd <= 0 || isNaN(usdThbRate) || usdThbRate <= 0) {
      setEditDepositError('กรุณาใส่ข้อมูลให้ถูกต้อง')
      return
    }
    setEditDepositLoading(true)
    setEditDepositError('')
    try {
      const res = await fetch(`/api/wallet/deposits/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountTon, tonPriceUsd, usdThbRate, depositedAt: editDepositForm.depositedAt, note: editDepositForm.note || null }),
      })
      if (res.ok) {
        setEditingDepositId(null)
        router.refresh()
      } else {
        const data = await res.json()
        setEditDepositError(data.detail ?? data.error ?? 'บันทึกไม่สำเร็จ')
      }
    } catch {
      setEditDepositError('บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง')
    } finally {
      setEditDepositLoading(false)
    }
  }

  const rawAllocations = deposits.flatMap(d =>
    d.allocations.map(a => ({
      id: a.id,
      campaignId: a.campaignId,
      campaignName: a.campaignName,
      amountTon: a.amountTon,
      date: a.allocatedAt,
      createdAt: a.createdAt,
      totalSpendTon: a.totalSpendTon,
      tonPriceUsd: a.tonPriceUsd,
      usdThbRate: a.usdThbRate,
    }))
  )

  const allocationGroupMap = new Map<string, typeof rawAllocations>()
  for (const a of rawAllocations) {
    const key = `${a.campaignId}::${a.createdAt}`
    const group = allocationGroupMap.get(key) ?? []
    group.push(a)
    allocationGroupMap.set(key, group)
  }

  // FIFO: distribute campaign spend across allocation groups, oldest-first
  const campaignGroupsList = new Map<string, Array<{ groupKey: string; amountTon: number; date: string; createdAt: string; totalSpendTon: number }>>()
  for (const [groupKey, group] of allocationGroupMap) {
    const first = group[0]
    const list = campaignGroupsList.get(first.campaignId) ?? []
    list.push({
      groupKey,
      amountTon: group.reduce((s, a) => s + a.amountTon, 0),
      date: first.date,
      createdAt: first.createdAt,
      totalSpendTon: first.totalSpendTon,
    })
    campaignGroupsList.set(first.campaignId, list)
  }

  const groupFifoMap = new Map<string, { usedTon: number; remainingTon: number }>()
  for (const groups of campaignGroupsList.values()) {
    groups.sort((a, b) =>
      new Date(a.date).getTime() - new Date(b.date).getTime() ||
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    )
    let remainingSpend = groups[0].totalSpendTon
    for (const g of groups) {
      const used = Math.min(g.amountTon, Math.max(0, remainingSpend))
      groupFifoMap.set(g.groupKey, { usedTon: used, remainingTon: g.amountTon - used })
      remainingSpend -= used
    }
  }

  const transactions: TxRow[] = [
    ...deposits.map(d => ({
      kind: 'deposit' as const,
      id: d.id,
      amountTon: d.amountTon,
      amountThb: d.amountTon * d.tonPriceUsd * d.usdThbRate,
      tonPriceUsd: d.tonPriceUsd,
      usdThbRate: d.usdThbRate,
      date: d.depositedAt,
      createdAt: d.createdAt,
      note: d.note,
      type: d.type,
      refundCampaignName: d.refundCampaignName,
      remaining: d.remaining,
      hasAllocations: d.allocations.length > 0,
    })),
    ...Array.from(allocationGroupMap.values()).map(group => {
      const first = group[0]
      const groupKey = `${first.campaignId}::${first.createdAt}`
      const fifo = groupFifoMap.get(groupKey) ?? { usedTon: 0, remainingTon: 0 }
      return {
        kind: 'allocation' as const,
        ids: group.map(a => a.id),
        campaignId: first.campaignId,
        campaignName: first.campaignName,
        amountTon: group.reduce((s, a) => s + a.amountTon, 0),
        amountThb: group.reduce((s, a) => s + a.amountTon * a.tonPriceUsd * a.usdThbRate, 0),
        date: first.date,
        createdAt: first.createdAt,
        usedTon: fifo.usedTon,
        remainingTon: fifo.remainingTon,
        splitCount: group.length,
      }
    }),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  const canAllocate = balance > 0 && availableCampaigns.length > 0

  let runningBal = 0
  const tableRows = [...transactions]
    .sort((a, b) =>
      new Date(a.date).getTime() - new Date(b.date).getTime() ||
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    )
    .map(tx => {
      if (tx.kind === 'deposit') runningBal += tx.amountTon
      else runningBal -= tx.amountTon
      return { ...tx, bal: runningBal }
    })

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">TON Wallet</h1>
          <p className="text-3xl font-bold mt-1">{balance.toFixed(4)} TON</p>
          <p className="text-lg font-semibold text-muted-foreground">≈ {formatThb(balanceThb)}</p>
          {currentRate ? (
            <p className="text-sm text-muted-foreground mt-1">
              1 TON = ${currentRate.tonPriceUsd.toFixed(4)} / ฿{currentRate.usdThbRate.toFixed(4)}
              <span className="ml-2 text-xs">(อัตราปัจจุบัน)</span>
            </p>
          ) : (
            <p className="text-sm text-muted-foreground mt-1">ไม่มี deposit ที่มีเงินเหลือ</p>
          )}
        </div>
        <Button
          onClick={() => { setShowDepositForm(true); setShowAllocateForm(false) }}
          disabled={showDepositForm}
        >
          + ฝากเงิน
        </Button>
      </div>

      {showDepositForm && <DepositForm onCancel={() => setShowDepositForm(false)} />}

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">ประวัติ</h2>
          {canAllocate && !showAllocateForm && (
            <Button size="sm" variant="outline" onClick={() => setShowAllocateForm(true)}>
              + จัดสรร
            </Button>
          )}
        </div>

        {showAllocateForm && (
          <AllocateForm
            balance={balance}
            campaigns={availableCampaigns}
            onCancel={() => setShowAllocateForm(false)}
          />
        )}

        {tableRows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">ยังไม่มี transaction</p>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/20 text-xs text-muted-foreground">
                  <th className="px-3 py-2 text-left font-medium whitespace-nowrap">วันที่</th>
                  <th className="px-3 py-2 text-left font-medium">รายการ</th>
                  <th className="px-3 py-2 text-right font-medium whitespace-nowrap">ฝาก (TON)</th>
                  <th className="px-3 py-2 text-right font-medium whitespace-nowrap">ถอน (TON)</th>
                  <th className="px-3 py-2 text-right font-medium whitespace-nowrap">คงเหลือ</th>
                  <th className="px-1 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {tableRows.map(tx =>
                  tx.kind === 'deposit' ? (
                    <Fragment key={`dep-${tx.id}`}>
                      <tr className="hover:bg-muted/10">
                        <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                          {formatDate(tx.date)}
                        </td>
                        <td className="px-3 py-2.5 font-medium">
                          {tx.type === 'REFUND'
                            ? `คืนจาก${tx.refundCampaignName ? `: ${tx.refundCampaignName}` : ''}`
                            : `ฝากเงิน${tx.note ? ` · ${tx.note}` : ''}`}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono text-green-400">
                          {tx.amountTon.toFixed(4)}
                          <span className="block text-xs text-muted-foreground font-sans">${tx.tonPriceUsd.toFixed(2)}/TON · {formatThb(tx.amountThb)}</span>
                        </td>
                        <td className="px-3 py-2.5 text-right text-muted-foreground/30">—</td>
                        <td className="px-3 py-2.5 text-right font-mono font-medium">
                          {tx.bal.toFixed(4)}
                        </td>
                        <td className="px-1 py-2.5">
                          {tx.type !== 'REFUND' && (
                            <div className="flex gap-0.5">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 px-2 text-xs"
                                onClick={() => editingDepositId === tx.id ? setEditingDepositId(null) : startEditDeposit(tx)}
                              >
                                {editingDepositId === tx.id ? 'ยกเลิก' : 'แก้ไข'}
                              </Button>
                              {tx.hasAllocations
                                ? <span className="text-xs text-muted-foreground/50 px-2 self-center">ล็อก</span>
                                : <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-destructive h-6 px-2 text-xs"
                                    disabled={deletingId === tx.id}
                                    onClick={() => handleDeleteDeposit(tx.id)}
                                  >
                                    ลบ
                                  </Button>
                              }
                            </div>
                          )}
                        </td>
                      </tr>
                      {editingDepositId === tx.id && (
                        <tr>
                          <td colSpan={6} className="px-3 pb-3 pt-0">
                            <div className="mt-1 space-y-3 rounded-md border p-3 bg-muted/10">
                              <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                  <label className="text-xs font-medium">จำนวน TON</label>
                                  <input
                                    type="number"
                                    step="0.00000001"
                                    min="0.00000001"
                                    className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
                                    value={editDepositForm.amountTon}
                                    onChange={e => setEditDepositForm(f => ({ ...f, amountTon: e.target.value }))}
                                  />
                                </div>
                                <div className="space-y-1.5">
                                  <label className="text-xs font-medium">วันที่ฝาก</label>
                                  <input
                                    type="date"
                                    className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
                                    value={editDepositForm.depositedAt}
                                    onChange={e => {
                                      setEditDepositForm(f => ({ ...f, depositedAt: e.target.value, tonPriceUsd: '', usdThbRate: '' }))
                                      fetchDepositRate(e.target.value)
                                    }}
                                  />
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                  <label className="text-xs font-medium">
                                    ราคา TON/USD{editDepositFetching && <span className="ml-1 text-blue-400">(กำลังดึง...)</span>}
                                  </label>
                                  <input
                                    type="number"
                                    step="0.0001"
                                    className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
                                    value={editDepositForm.tonPriceUsd}
                                    onChange={e => setEditDepositForm(f => ({ ...f, tonPriceUsd: e.target.value }))}
                                  />
                                </div>
                                <div className="space-y-1.5">
                                  <label className="text-xs font-medium">อัตรา USD/THB</label>
                                  <input
                                    type="number"
                                    step="0.0001"
                                    className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
                                    value={editDepositForm.usdThbRate}
                                    onChange={e => setEditDepositForm(f => ({ ...f, usdThbRate: e.target.value }))}
                                  />
                                </div>
                              </div>
                              <div className="space-y-1.5">
                                <label className="text-xs font-medium">หมายเหตุ (optional)</label>
                                <input
                                  type="text"
                                  className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
                                  value={editDepositForm.note}
                                  onChange={e => setEditDepositForm(f => ({ ...f, note: e.target.value }))}
                                  placeholder="เช่น ซื้อรอบเดือนพฤษภาคม"
                                />
                              </div>
                              {editDepositError && <p className="text-xs text-destructive">{editDepositError}</p>}
                              <Button size="sm" disabled={editDepositLoading} onClick={() => handleSaveDeposit(tx.id)}>
                                {editDepositLoading ? 'กำลังบันทึก...' : 'บันทึก'}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ) : (
                    <Fragment key={`alloc-${tx.ids[0]}`}>
                      <tr className="hover:bg-muted/10">
                        <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                          {formatDate(tx.date)}
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="font-medium">{tx.campaignName}</span>
                          {tx.splitCount > 1 && (
                            <span className="ml-1.5 text-xs text-muted-foreground">({tx.splitCount} ยอด)</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right text-muted-foreground/30">—</td>
                        <td className="px-3 py-2.5 text-right font-mono text-red-400">
                          {tx.amountTon.toFixed(4)}
                          <span className="block text-xs text-muted-foreground font-sans">{formatThb(tx.amountThb)}</span>
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono font-medium">
                          {tx.bal.toFixed(4)}
                        </td>
                        <td className="px-1 py-2.5">
                          <div className="flex gap-0.5">
                            {tx.splitCount === 1 && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 px-2 text-xs"
                                onClick={() => editingAllocationId === tx.ids[0] ? setEditingAllocationId(null) : startEdit(tx.ids[0], tx.amountTon, tx.date)}
                              >
                                {editingAllocationId === tx.ids[0] ? 'ยกเลิก' : 'แก้ไข'}
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive h-6 px-2 text-xs"
                              disabled={deletingAllocationId === tx.ids[0]}
                              onClick={() => handleDeleteAllocation(tx.ids)}
                            >
                              ลบ
                            </Button>
                          </div>
                        </td>
                      </tr>
                      {tx.splitCount === 1 && editingAllocationId === tx.ids[0] && (
                        <tr>
                          <td colSpan={6} className="px-3 pb-3 pt-0">
                            <div className="mt-1 space-y-3 rounded-md border p-3 bg-muted/10">
                              <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                  <label className="text-xs font-medium">วันที่จัดสรร</label>
                                  <input
                                    type="date"
                                    className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
                                    value={editDate}
                                    onChange={e => setEditDate(e.target.value)}
                                  />
                                </div>
                                <div className="space-y-1.5">
                                  <label className="text-xs font-medium">จำนวน TON (สูงสุด {(balance + tx.amountTon).toFixed(4)})</label>
                                  <input
                                    type="number"
                                    step="0.00000001"
                                    min="0.00000001"
                                    max={balance + tx.amountTon}
                                    className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
                                    value={editAmount}
                                    onChange={e => setEditAmount(e.target.value)}
                                  />
                                </div>
                              </div>
                              {editError && <p className="text-xs text-destructive">{editError}</p>}
                              <Button
                                size="sm"
                                disabled={editLoading}
                                onClick={() => handleSaveEdit(tx.ids[0], balance + tx.amountTon)}
                              >
                                {editLoading ? 'กำลังบันทึก...' : 'บันทึก'}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                )}
                <tr className="border-t-2 border-border bg-muted/20">
                  <td colSpan={4} className="px-3 py-2.5 text-right text-xs font-semibold text-muted-foreground">
                    ยอดคงเหลือ
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono font-bold">
                    {balance.toFixed(4)} TON
                    <span className="block text-xs text-muted-foreground font-sans font-normal">{formatThb(balanceThb)}</span>
                  </td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
