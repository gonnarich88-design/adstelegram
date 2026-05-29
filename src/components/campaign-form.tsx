'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

interface CampaignFormProps {
  initialData?: {
    id: string
    name: string
    targetType: string
    targetName: string
    startDate: string
    endDate?: string | null
    dailyBudgetTon: string
    bidCpmTon?: string | null
    budgetTon?: string
    status: string
    note?: string | null
  }
}

export function CampaignForm({ initialData }: CampaignFormProps) {
  const router = useRouter()
  const isEdit = !!initialData

  const [form, setForm] = useState({
    name: initialData?.name ?? '',
    targetType: initialData?.targetType ?? 'CHANNEL',
    targetName: initialData?.targetName ?? '',
    placementName: (initialData as any)?.placementName ?? '',
    startDate: initialData?.startDate?.split('T')[0] ?? new Date().toISOString().split('T')[0],
    endDate: initialData?.endDate?.split('T')[0] ?? '',
    dailyBudgetTon: initialData?.dailyBudgetTon ?? '',
    bidCpmTon: initialData?.bidCpmTon ?? '',
    budgetTon: initialData?.budgetTon ?? '',
    status: initialData?.status ?? 'ACTIVE',
    note: initialData?.note ?? '',
    changeNote: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function set(key: string, value: string) {
    setForm(f => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const payload = {
      ...form,
      endDate: form.endDate || null,
      placementName: form.placementName || null,
      note: form.note || null,
      changeNote: form.changeNote || '',
      dailyBudgetTon: parseFloat(form.dailyBudgetTon),
      bidCpmTon: form.bidCpmTon ? parseFloat(form.bidCpmTon) : null,
      budgetTon: form.budgetTon ? parseFloat(form.budgetTon) : null,
    }

    const url = isEdit ? `/api/campaigns/${initialData!.id}` : '/api/campaigns'
    const method = isEdit ? 'PUT' : 'POST'

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        const data = await res.json()
        router.push(`/campaigns/${data.id}`)
        router.refresh()
      } else {
        setError('เกิดข้อผิดพลาด ลองใหม่อีกครั้ง')
      }
    } catch {
      setError('เกิดข้อผิดพลาด ลองใหม่อีกครั้ง')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-xl">
      <div className="space-y-2">
        <Label>ชื่อ Campaign</Label>
        <Input value={form.name} onChange={e => set('name', e.target.value)} required />
      </div>

      <div className="space-y-2">
        <Label>Target</Label>
        <div className="flex rounded-md border border-input overflow-hidden focus-within:ring-1 focus-within:ring-ring">
          <Select value={form.targetType} onValueChange={v => set('targetType', v ?? '')}>
            <SelectTrigger className="w-32 rounded-none border-0 border-r border-input focus:ring-0 shrink-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="CHANNEL">CHANNEL</SelectItem>
              <SelectItem value="BOT">BOT</SelectItem>
            </SelectContent>
          </Select>
          <input
            className="flex-1 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground"
            value={form.targetName}
            onChange={e => set('targetName', e.target.value)}
            placeholder="@username"
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>วันเริ่ม</Label>
          <Input type="date" value={form.startDate} onChange={e => set('startDate', e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label>วันสิ้นสุด (optional)</Label>
          <Input type="date" value={form.endDate} onChange={e => set('endDate', e.target.value)} />
        </div>
      </div>

      <div className="space-y-2">
        <Label>ปลายทาง <span className="text-muted-foreground font-normal">(optional — channel/topic ที่ ads โผล่)</span></Label>
        <Input
          value={form.placementName}
          onChange={e => set('placementName', e.target.value)}
          placeholder="เช่น Gaming, @somechannel"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>งบต่อวัน (TON)</Label>
          <Input
            type="number"
            step="0.001"
            value={form.dailyBudgetTon}
            onChange={e => set('dailyBudgetTon', e.target.value)}
            placeholder="10"
            required
          />
        </div>
        <div className="space-y-2">
          <Label>CPM Bid (TON)</Label>
          <Input
            type="number"
            step="0.0001"
            min="0.0001"
            value={form.bidCpmTon}
            onChange={e => set('bidCpmTon', e.target.value)}
            placeholder="0.50"
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>งบรวมทั้ง campaign (TON) <span className="text-muted-foreground font-normal">optional</span></Label>
        <Input
          type="number"
          step="0.001"
          value={form.budgetTon}
          onChange={e => set('budgetTon', e.target.value)}
          placeholder="300"
        />
      </div>

      {isEdit && (
        <div className="space-y-2">
          <Label>Status</Label>
          <Select value={form.status} onValueChange={v => set('status', v ?? '')}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ACTIVE">ACTIVE</SelectItem>
              <SelectItem value="PAUSED">PAUSED</SelectItem>
              <SelectItem value="STOPPED">STOPPED</SelectItem>
              <SelectItem value="DONE">DONE</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-2">
        <Label>Note (optional)</Label>
        <Textarea value={form.note ?? ''} onChange={e => set('note', e.target.value)} rows={3} />
      </div>

      {isEdit && (
        <div className="space-y-2">
          <Label htmlFor="changeNote">เหตุผลที่แก้ไข (optional)</Label>
          <Input
            id="changeNote"
            value={form.changeNote}
            onChange={e => set('changeNote', e.target.value)}
            placeholder="เช่น ปรับ CPM เพราะ CTR ตก"
          />
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-3">
        <Button type="submit" disabled={loading}>
          {loading ? 'กำลังบันทึก...' : isEdit ? 'บันทึกการแก้ไข' : 'สร้าง Campaign'}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          ยกเลิก
        </Button>
      </div>
    </form>
  )
}
