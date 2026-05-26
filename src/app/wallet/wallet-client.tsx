'use client'

import { useState } from 'react'
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
  | { kind: 'deposit'; id: string; amountTon: number; date: string; createdAt: string; note: string | null; type: 'DEPOSIT' | 'REFUND'; refundCampaignName: string | null; remaining: number; hasAllocations: boolean }
  | { kind: 'allocation'; id: string; campaignId: string; campaignName: string; amountTon: number; date: string; createdAt: string; totalSpendTon: number }

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })
}

export function WalletClient({
  balance,
  currentRate,
  deposits,
  availableCampaigns,
}: {
  balance: number
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

  async function handleDeleteAllocation(allocationId: string) {
    setDeletingAllocationId(allocationId)
    try {
      const res = await fetch(`/api/wallet/allocations/${allocationId}`, { method: 'DELETE' })
      if (res.ok) {
        router.refresh()
      } else {
        const data = await res.json()
        alert(data.error ?? 'ลบไม่สำเร็จ')
      }
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

  const transactions: TxRow[] = deposits
    .flatMap(d => [
      {
        kind: 'deposit' as const,
        id: d.id,
        amountTon: d.amountTon,
        date: d.depositedAt,
        createdAt: d.createdAt,
        note: d.note,
        type: d.type,
        refundCampaignName: d.refundCampaignName,
        remaining: d.remaining,
        hasAllocations: d.allocations.length > 0,
      },
      ...d.allocations.map(a => ({
        kind: 'allocation' as const,
        id: a.id,
        campaignId: a.campaignId,
        campaignName: a.campaignName,
        amountTon: a.amountTon,
        date: a.allocatedAt,
        createdAt: a.createdAt,
        totalSpendTon: a.totalSpendTon,
      })),
    ])
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  const canAllocate = balance > 0 && availableCampaigns.length > 0

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">TON Wallet</h1>
          <p className="text-3xl font-bold mt-1">{balance.toFixed(4)} TON</p>
          {currentRate ? (
            <p className="text-sm text-muted-foreground mt-1">
              1 TON = ${currentRate.tonPriceUsd.toFixed(4)} / ฿{currentRate.usdThbRate.toFixed(4)}
              <span className="ml-2 text-xs">(อัตราของ deposit เก่าที่สุดที่ยังมีเงินเหลือ)</span>
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

      <div className="space-y-1">
        <div className="flex items-center justify-between mb-3">
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

        {transactions.length === 0 && (
          <p className="text-sm text-muted-foreground py-8 text-center">ยังไม่มี transaction</p>
        )}

        {transactions.map(tx =>
          tx.kind === 'deposit' ? (
            <div
              key={`dep-${tx.id}`}
              className="flex items-center gap-3 py-2.5 border-b border-border/40 last:border-0"
            >
              <div className="w-8 h-8 rounded-full bg-green-950 text-green-400 flex items-center justify-center text-sm font-bold flex-shrink-0">
                {tx.type === 'REFUND' ? '↩' : '↑'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">
                  {tx.type === 'REFUND'
                    ? `คืนจากแคมเปญ${tx.refundCampaignName ? `: ${tx.refundCampaignName}` : ''}`
                    : `ฝากเงิน${tx.note ? ` · ${tx.note}` : ''}`}
                </p>
                {tx.type === 'DEPOSIT' && (
                  <p className="text-xs text-muted-foreground">
                    คงเหลือ {tx.remaining.toFixed(4)} TON
                  </p>
                )}
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-sm font-semibold text-green-400">+{tx.amountTon.toFixed(4)}</p>
                <p className="text-xs text-muted-foreground">{formatDate(tx.date)}</p>
              </div>
              {!tx.hasAllocations && tx.type !== 'REFUND' && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive h-7 px-2 text-xs flex-shrink-0"
                  disabled={deletingId === tx.id}
                  onClick={() => handleDeleteDeposit(tx.id)}
                >
                  ลบ
                </Button>
              )}
            </div>
          ) : (
            <div key={`alloc-${tx.id}`} className="border-b border-border/40 last:border-0">
              <div className="flex items-center gap-3 py-2.5">
                <div className="w-8 h-8 rounded-full bg-red-950 text-red-400 flex items-center justify-center text-sm flex-shrink-0">
                  →
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{tx.campaignName}</p>
                  <p className="text-xs text-muted-foreground">
                    จัดสรรให้ Campaign · ใช้ {tx.totalSpendTon.toFixed(4)} / เหลือ{' '}
                    <span className={(tx.amountTon - tx.totalSpendTon) < 0 ? 'text-red-400' : 'text-green-400'}>
                      {(tx.amountTon - tx.totalSpendTon).toFixed(4)}
                    </span>
                    {' '}TON
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-semibold text-red-400">−{tx.amountTon.toFixed(4)}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(tx.date)}</p>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs"
                    onClick={() => editingAllocationId === tx.id ? setEditingAllocationId(null) : startEdit(tx.id, tx.amountTon, tx.date)}
                  >
                    {editingAllocationId === tx.id ? 'ยกเลิก' : 'แก้ไข'}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive h-7 px-2 text-xs"
                    disabled={deletingAllocationId === tx.id}
                    onClick={() => handleDeleteAllocation(tx.id)}
                  >
                    ลบ
                  </Button>
                </div>
              </div>
              {editingAllocationId === tx.id && (
                <div className="mb-2 ml-11 space-y-3 rounded-md border p-3 bg-muted/10">
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
                    onClick={() => handleSaveEdit(tx.id, balance + tx.amountTon)}
                  >
                    {editLoading ? 'กำลังบันทึก...' : 'บันทึก'}
                  </Button>
                </div>
              )}
            </div>
          )
        )}
      </div>
    </div>
  )
}
