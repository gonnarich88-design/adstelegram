'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface AllocationInfo {
  id: string
  amountTon: number
  tonPriceUsd: number
  usdThbRate: number
  totalSpendTon: number
}

export function AllocationCard({
  campaignId,
  allocation,
  walletBalance,
  currentRate,
}: {
  campaignId: string
  allocation: AllocationInfo | null
  walletBalance: number
  currentRate: { tonPriceUsd: number; usdThbRate: number } | null
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSave() {
    const amountTon = parseFloat(amount)
    if (isNaN(amountTon) || amountTon <= 0) {
      setError('กรุณากรอกจำนวน TON ที่ถูกต้อง')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/allocation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountTon }),
      })
      if (res.ok) {
        router.refresh()
        setEditing(false)
        setAmount('')
      } else {
        const data = await res.json()
        setError(data.error === 'INSUFFICIENT_BALANCE' ? 'ยอดเงินใน Wallet ไม่พอ' : 'บันทึกไม่สำเร็จ')
      }
    } catch {
      setError('บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง')
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete() {
    setLoading(true)
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/allocation`, { method: 'DELETE' })
      if (res.ok) {
        router.refresh()
      }
    } finally {
      setLoading(false)
    }
  }

  if (!allocation && !editing) {
    return (
      <div className="rounded-lg border border-yellow-700/50 bg-yellow-950/10 p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-yellow-400">⚠ ยังไม่ได้จัดสรรงบจาก Wallet</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {currentRate
                ? `Wallet: ${walletBalance.toFixed(4)} TON · 1 TON = $${currentRate.tonPriceUsd.toFixed(4)} / ฿${currentRate.usdThbRate.toFixed(4)}`
                : 'ไม่มี deposit ที่มีเงินเหลือใน Wallet'}
            </p>
          </div>
          {currentRate && walletBalance > 0 && (
            <Button
              size="sm"
              onClick={() => {
                setEditing(true)
                setAmount('')
              }}
            >
              จัดสรรงบ
            </Button>
          )}
        </div>
      </div>
    )
  }

  if (editing) {
    return (
      <div className="rounded-lg border p-4 space-y-3">
        <p className="text-sm font-medium">จัดสรรงบจาก Wallet</p>
        {currentRate && (
          <p className="text-xs text-muted-foreground">
            อัตราที่จะใช้ (locked): 1 TON = ${currentRate.tonPriceUsd.toFixed(4)} / ฿{currentRate.usdThbRate.toFixed(4)}
          </p>
        )}
        <div className="flex gap-3 items-end">
          <div className="space-y-1.5">
            <Label>จำนวน TON</Label>
            <Input
              type="number"
              step="0.00000001"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="500"
              className="w-40"
            />
          </div>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? 'กำลังบันทึก...' : 'ยืนยัน'}
          </Button>
          <Button variant="outline" onClick={() => { setEditing(false); setError('') }}>
            ยกเลิก
          </Button>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    )
  }

  // Has allocation
  const remainingTon = allocation!.amountTon - allocation!.totalSpendTon

  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">งบจาก Wallet</p>
          <p className="font-medium">{allocation!.amountTon.toFixed(4)} TON</p>
          <p className="text-xs text-muted-foreground">
            1 TON = ${allocation!.tonPriceUsd.toFixed(4)} / ฿{allocation!.usdThbRate.toFixed(4)} (locked)
          </p>
          <div className="mt-1.5 flex gap-3 text-xs">
            <span className="text-muted-foreground">ใช้ไปแล้ว: <span className="text-foreground">{allocation!.totalSpendTon.toFixed(4)} TON</span></span>
            <span className="text-muted-foreground">คงเหลือ: <span className={remainingTon < 0 ? 'text-red-400 font-medium' : 'text-green-400 font-medium'}>{remainingTon.toFixed(4)} TON</span></span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setEditing(true)
              setAmount(String(allocation!.amountTon))
            }}
          >
            แก้ไข
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-destructive"
            disabled={loading}
            onClick={handleDelete}
          >
            ลบ
          </Button>
        </div>
      </div>
    </div>
  )
}
