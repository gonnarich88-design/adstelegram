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
}

export function AllocateForm({
  depositId,
  maxTon,
  campaigns,
  onCancel,
}: {
  depositId: string
  maxTon: number
  campaigns: Campaign[]
  onCancel: () => void
}) {
  const router = useRouter()
  const [campaignId, setCampaignId] = useState(campaigns[0]?.id ?? '')
  const [amountTon, setAmountTon] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const amount = parseFloat(amountTon)
    if (isNaN(amount) || amount < 0.00000001 || amount > maxTon) {
      setError(`จำนวนต้องอยู่ระหว่าง 0.00000001–${maxTon.toFixed(4)}`)
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/allocation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountTon: amount, depositId }),
      })
      if (res.ok) {
        router.refresh()
        onCancel()
      } else {
        const data = await res.json()
        setError(
          data.error === 'INSUFFICIENT_BALANCE'
            ? 'ยอดคงเหลือใน deposit ไม่พอ'
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
    <form onSubmit={handleSubmit} className="mt-3 space-y-3 rounded-md border p-3 bg-muted/10">
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
              {c.name}{c.status !== 'ACTIVE' ? ` (${c.status})` : ''}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <Label>จำนวน TON (สูงสุด {maxTon.toFixed(4)})</Label>
        <Input
          type="number"
          step="0.00000001"
          min="0.00000001"
          max={maxTon}
          value={amountTon}
          onChange={e => setAmountTon(e.target.value)}
          placeholder={maxTon.toFixed(4)}
          required
        />
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
