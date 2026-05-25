'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface RefundButtonProps {
  campaignId: string
  status: string
  estimatedRefundTon: number
}

export function RefundButton({ campaignId, status, estimatedRefundTon }: RefundButtonProps) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const today = new Date().toISOString().split('T')[0]

  const [form, setForm] = useState({
    amountTon: estimatedRefundTon > 0 ? estimatedRefundTon.toFixed(8).replace(/\.?0+$/, '') : '',
    refundedAt: today,
    tonPriceUsd: '',
    usdThbRate: '',
    note: '',
  })
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(false)
  const [error, setError] = useState('')

  function set(key: string, value: string) {
    setForm(f => ({ ...f, [key]: value }))
  }

  async function fetchRate(date: string) {
    if (!date) return
    setFetching(true)
    try {
      const res = await fetch(`/api/rates/historical?from=${date}&to=${date}`)
      if (res.ok) {
        const data = await res.json()
        const rate = data[date]
        if (rate) {
          setForm(f => ({
            ...f,
            tonPriceUsd: rate.tonUsd.toFixed(4),
            usdThbRate: rate.usdThb.toFixed(4),
          }))
        }
      }
    } catch {
      // user fills manually
    } finally {
      setFetching(false)
    }
  }

  useEffect(() => {
    if (showForm) fetchRate(today)
  }, [showForm])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amountTon: parseFloat(form.amountTon),
          tonPriceUsd: parseFloat(form.tonPriceUsd),
          usdThbRate: parseFloat(form.usdThbRate),
          refundedAt: form.refundedAt,
          note: form.note || null,
        }),
      })
      if (res.ok) {
        setShowForm(false)
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

  if (status !== 'ACTIVE' && status !== 'PAUSED') return null

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setShowForm(v => !v)}
      >
        ยกเลิกแคมเปญ
      </Button>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="mt-4 space-y-4 rounded-lg border p-4 bg-muted/10"
        >
          <p className="font-medium text-sm">บันทึก Refund จาก Telegram</p>
          {estimatedRefundTon > 0 && (
            <p className="text-xs text-muted-foreground">
              คาดการณ์ยอดคืน: {estimatedRefundTon.toFixed(4)} TON (allocated − spent)
            </p>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>ยอด TON ที่ได้คืน</Label>
              <Input
                type="number"
                step="0.00000001"
                min="0.00000001"
                value={form.amountTon}
                onChange={e => set('amountTon', e.target.value)}
                placeholder="4.0410"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>วันที่คืนเงิน</Label>
              <Input
                type="date"
                value={form.refundedAt}
                onChange={e => {
                  setForm(f => ({ ...f, refundedAt: e.target.value, tonPriceUsd: '', usdThbRate: '' }))
                  fetchRate(e.target.value)
                }}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>ราคา TON/USD {fetching && <span className="text-xs text-blue-400">(กำลังดึง...)</span>}</Label>
              <Input
                type="number"
                step="0.0001"
                value={form.tonPriceUsd}
                onChange={e => set('tonPriceUsd', e.target.value)}
                placeholder="3.21"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>อัตรา USD/THB</Label>
              <Input
                type="number"
                step="0.0001"
                value={form.usdThbRate}
                onChange={e => set('usdThbRate', e.target.value)}
                placeholder="35.50"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>หมายเหตุ (optional)</Label>
            <Input
              value={form.note}
              onChange={e => set('note', e.target.value)}
              placeholder="เช่น ยกเลิกก่อนกำหนด"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex gap-3">
            <Button type="submit" disabled={loading}>
              {loading ? 'กำลังบันทึก...' : 'ยืนยันยกเลิกแคมเปญ'}
            </Button>
            <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
              ยกเลิก
            </Button>
          </div>
        </form>
      )}
    </>
  )
}
