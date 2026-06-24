'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { X, Plus, MapPin } from 'lucide-react'

interface PlacementOption {
  id: string
  name: string
  type?: string | null
}

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
    placementName?: string | null
    placementType?: string | null
    placements?: { placementId: string; placement: PlacementOption }[]
  }
  allPlacements?: PlacementOption[]
}

export function CampaignForm({ initialData, allPlacements = [] }: CampaignFormProps) {
  const router = useRouter()
  const isEdit = !!initialData

  const initialPlacementIds = (initialData?.placements ?? []).map(p => p.placementId)
  const initialPlacementMap = Object.fromEntries(
    (initialData?.placements ?? []).map(p => [p.placementId, p.placement])
  )
  // ข้อมูล placementName เก่า (text field) ที่ยังไม่ถูก migrate เป็น M2M
  const legacyPlacementName =
    initialPlacementIds.length === 0 ? (initialData?.placementName ?? null) : null

  const [form, setForm] = useState({
    name: initialData?.name ?? '',
    targetType: initialData?.targetType ?? 'CHANNEL',
    targetName: initialData?.targetName ?? '',
    placementType: initialData?.placementType ?? '',
    startDate: initialData?.startDate?.split('T')[0] ?? new Date().toISOString().split('T')[0],
    endDate: initialData?.endDate?.split('T')[0] ?? '',
    dailyBudgetTon: initialData?.dailyBudgetTon ?? '',
    bidCpmTon: initialData?.bidCpmTon ?? '',
    budgetTon: initialData?.budgetTon ?? '',
    status: initialData?.status ?? 'ACTIVE',
    note: initialData?.note ?? '',
    changeNote: '',
  })

  const [selectedIds, setSelectedIds] = useState<string[]>(initialPlacementIds)
  const [placementMap, setPlacementMap] = useState<Record<string, PlacementOption>>({
    ...Object.fromEntries(allPlacements.map(p => [p.id, p])),
    ...initialPlacementMap,
  })
  const [search, setSearch] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  function set(key: string, value: string) {
    setForm(f => ({ ...f, [key]: value }))
  }

  const filtered = allPlacements.filter(
    p => p.name.toLowerCase().includes(search.toLowerCase()) && !selectedIds.includes(p.id)
  )
  const showCreate = search.trim() && !allPlacements.some(
    p => p.name.toLowerCase() === search.trim().toLowerCase()
  )

  async function selectPlacement(p: PlacementOption) {
    setSelectedIds(ids => [...ids, p.id])
    setPlacementMap(m => ({ ...m, [p.id]: p }))
    setSearch('')
    setDropdownOpen(false)
  }

  async function createAndSelect() {
    const name = search.trim()
    if (!name || creating) return
    setCreating(true)
    try {
      const res = await fetch('/api/placements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      if (res.ok) {
        const p = await res.json()
        await selectPlacement({ id: p.id, name: p.name, type: p.type })
      }
    } finally {
      setCreating(false)
    }
  }

  function removePlacement(id: string) {
    setSelectedIds(ids => ids.filter(i => i !== id))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const payload = {
      ...form,
      endDate: form.endDate || null,
      placementType: form.placementType || null,
      note: form.note || null,
      changeNote: form.changeNote || '',
      dailyBudgetTon: parseFloat(form.dailyBudgetTon),
      bidCpmTon: form.bidCpmTon ? parseFloat(form.bidCpmTon) : null,
      budgetTon: form.budgetTon ? parseFloat(form.budgetTon) : null,
      placementIds: selectedIds,
      // ถ้ามี M2M placements แล้ว → ล้าง legacy text; ถ้าไม่มี → เก็บ legacy ไว้
      placementName: selectedIds.length > 0 ? null : legacyPlacementName,
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
        <Label>
          โฆษณาไปแสดงใน{' '}
          <span className="text-muted-foreground font-normal">(optional — Target ใน Telegram Ads)</span>
        </Label>
        <div className="flex gap-2">
          {(['CHANNEL', 'BOT', 'SEARCH'] as const).map(v => (
            <button
              key={v}
              type="button"
              onClick={() => set('placementType', form.placementType === v ? '' : v)}
              className={`flex-1 py-2 rounded-md border text-sm font-medium transition-colors ${
                form.placementType === v
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-transparent text-muted-foreground border-input hover:border-foreground/40'
              }`}
            >
              {v === 'CHANNEL' ? 'Channels' : v === 'BOT' ? 'Bots' : 'Search'}
            </button>
          ))}
        </div>
      </div>

      {/* Placement multi-select */}
      <div className="space-y-2">
        <Label>
          ปลายทาง{' '}
          <span className="text-muted-foreground font-normal">(optional — channel/topic ที่ ads โผล่)</span>
        </Label>

        {/* Legacy placementName — ข้อมูลเก่าที่ยังไม่ได้ migrate */}
        {legacyPlacementName && selectedIds.length === 0 && (
          <div className="flex items-start gap-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-md px-3 py-2 mb-2">
            <MapPin className="w-3 h-3 mt-0.5 shrink-0" />
            <span>
              ข้อมูลเก่า: <span className="font-medium">{legacyPlacementName}</span>
              {' '}— เพิ่มใหม่ผ่าน dropdown ด้านล่างเพื่อแปลงเป็นรูปแบบใหม่
            </span>
          </div>
        )}

        {/* Selected chips */}
        {selectedIds.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {selectedIds.map(id => {
              const p = placementMap[id]
              if (!p) return null
              return (
                <span
                  key={id}
                  className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20"
                >
                  <MapPin className="w-2.5 h-2.5 shrink-0" />
                  {p.name}
                  <button
                    type="button"
                    onClick={() => removePlacement(id)}
                    className="ml-0.5 hover:text-sky-200 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )
            })}
          </div>
        )}

        {/* Dropdown input */}
        <div className="relative" ref={dropdownRef}>
          <Input
            value={search}
            onChange={e => { setSearch(e.target.value); setDropdownOpen(true) }}
            onFocus={() => setDropdownOpen(true)}
            placeholder="ค้นหาหรือพิมพ์เพื่อสร้างปลายทางใหม่..."
            className="text-sm"
          />
          {dropdownOpen && (filtered.length > 0 || showCreate) && (
            <div className="absolute z-10 mt-1 w-full rounded-md border border-border bg-popover shadow-md overflow-hidden">
              {filtered.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onMouseDown={e => { e.preventDefault(); selectPlacement(p) }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-left hover:bg-muted transition-colors"
                >
                  <MapPin className="w-3 h-3 text-sky-400 shrink-0" />
                  <span>{p.name}</span>
                  {p.type && (
                    <span className="ml-auto text-[10px] text-muted-foreground">{p.type}</span>
                  )}
                </button>
              ))}
              {showCreate && (
                <button
                  type="button"
                  onMouseDown={e => { e.preventDefault(); createAndSelect() }}
                  disabled={creating}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-left hover:bg-muted transition-colors text-sky-400 border-t border-border"
                >
                  <Plus className="w-3 h-3 shrink-0" />
                  {creating ? 'กำลังสร้าง...' : `สร้าง "${search.trim()}"`}
                </button>
              )}
            </div>
          )}
        </div>
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
