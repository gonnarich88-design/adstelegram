'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface Campaign {
  id: string
  name: string
  status: string
  currentAllocationTon?: number
}

export function AllocateForm({
  balance,
  campaigns,
  onCancel,
}: {
  balance: number
  campaigns: Campaign[]
  onCancel: () => void
}) {
  const router = useRouter()
  const today = new Date().toISOString().split('T')[0]
  const [campaignId, setCampaignId] = useState(campaigns[0]?.id ?? '')
  const [amountTon, setAmountTon] = useState('')
  const [allocatedAt, setAllocatedAt] = useState(today)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const selectedCampaign = campaigns.find(c => c.id === campaignId)
  const existingAllocation = selectedCampaign?.currentAllocationTon ?? 0

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const additional = parseFloat(amountTon)
    if (isNaN(additional) || additional < 0.00000001 || additional > balance) {
      setError(`จำนวนต้องอยู่ระหว่าง 0.00000001–${balance.toFixed(4)}`)
      return
    }
    const newTotal = existingAllocation + additional
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/allocation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountTon: newTotal, allocatedAt }),
      })
      if (res.ok) {
        router.refresh()
        onCancel()
      } else {
        const data = await res.json()
        setError(
          data.error === 'INSUFFICIENT_BALANCE'
            ? 'ยอดคงเหลือใน wallet ไม่พอ'
            : (data.error ?? 'จัดสรรไม่สำเร็จ ลองใหม่อีกครั้ง')
        )
      }
    } catch {
      setError('จัดสรรไม่สำเร็จ ลองใหม่อีกครั้ง')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-1 mb-2 space-y-3 rounded-md border p-3 bg-muted/10">
      <p className="text-sm font-medium">จัดสรรงบให้ Campaign</p>

      <div className="space-y-1.5">
        <Label>Campaign</Label>
        <select
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          value={campaignId}
          onChange={e => setCampaignId(e.target.value)}
          required
        >
          {campaigns.map(c => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.currentAllocationTon ? ` (มีแล้ว ${c.currentAllocationTon.toFixed(4)} TON)` : ''}
              {c.status !== 'ACTIVE' ? ` · ${c.status}` : ''}
            </option>
          ))}
        </select>
        {existingAllocation > 0 && (
          <p className="text-xs text-muted-foreground">
            จัดสรรแล้ว {existingAllocation.toFixed(4)} TON · ยอดรวมใหม่จะเป็น{' '}
            <span className="text-foreground font-medium">
              {(existingAllocation + (parseFloat(amountTon) || 0)).toFixed(4)} TON
            </span>
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>วันที่จัดสรร</Label>
          <Input
            type="date"
            value={allocatedAt}
            onChange={e => setAllocatedAt(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label>{existingAllocation > 0 ? `เพิ่มเติม TON (สูงสุด ${balance.toFixed(4)})` : `จำนวน TON (สูงสุด ${balance.toFixed(4)})`}</Label>
          <Input
            type="number"
            step="0.00000001"
            min="0.00000001"
            max={balance}
            value={amountTon}
            onChange={e => setAmountTon(e.target.value)}
            placeholder={balance.toFixed(4)}
            required
          />
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={loading || !campaignId}>
          {loading ? 'กำลังจัดสรร...' : 'จัดสรร'}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onCancel}>
          ยกเลิก
        </Button>
      </div>
    </form>
  )
}
