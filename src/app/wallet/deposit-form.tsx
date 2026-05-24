'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function DepositForm({ onCancel }: { onCancel: () => void }) {
  const router = useRouter()
  const today = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState({
    amountTon: '',
    depositedAt: today,
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

  async function fetchRateForDate(date: string) {
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
      // user can fill manually
    } finally {
      setFetching(false)
    }
  }

  useEffect(() => {
    fetchRateForDate(today)
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/wallet/deposits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amountTon: parseFloat(form.amountTon),
          tonPriceUsd: parseFloat(form.tonPriceUsd),
          usdThbRate: parseFloat(form.usdThbRate),
          depositedAt: form.depositedAt,
          note: form.note || null,
        }),
      })

      if (res.ok) {
        router.refresh()
        onCancel()
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
    <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border p-4 bg-muted/10">
      <p className="font-medium text-sm">ฝากเงินเข้า Wallet</p>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>จำนวน TON</Label>
          <Input
            type="number"
            step="0.00000001"
            value={form.amountTon}
            onChange={e => set('amountTon', e.target.value)}
            placeholder="2000"
            required
          />
        </div>
        <div className="space-y-2">
          <Label>วันที่ฝาก</Label>
          <Input
            type="date"
            value={form.depositedAt}
            onChange={e => {
              setForm(f => ({ ...f, depositedAt: e.target.value, tonPriceUsd: '', usdThbRate: '' }))
              fetchRateForDate(e.target.value)
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
        <Label>Note (optional)</Label>
        <Input value={form.note} onChange={e => set('note', e.target.value)} placeholder="เช่น ซื้อรอบเดือนพฤษภาคม" />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-3">
        <Button type="submit" disabled={loading}>
          {loading ? 'กำลังบันทึก...' : 'บันทึก'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          ยกเลิก
        </Button>
      </div>
    </form>
  )
}
