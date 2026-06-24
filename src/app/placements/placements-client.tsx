'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MapPin, ChevronDown, ChevronRight, Pencil, Trash2, Check, X } from 'lucide-react'

interface Campaign {
  id: string
  name: string
  status: string
  targetType: string
}

interface Placement {
  id: string
  name: string
  type: string | null
  note: string | null
  createdAt: string
  campaigns: Campaign[]
}

const TYPE_COLORS: Record<string, string> = {
  CHANNEL: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  BOT: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  SEARCH: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
}

export function PlacementsClient({
  placements: initial,
  legacyGroups = [],
  statusClass,
  typeLabel,
}: {
  placements: Placement[]
  legacyGroups?: [string, Campaign[]][]
  statusClass: Record<string, string>
  typeLabel: Record<string, string>
}) {
  const [placements, setPlacements] = useState(initial)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [editing, setEditing] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editNote, setEditNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleteError, setDeleteError] = useState<Record<string, string>>({})

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function startEdit(p: Placement) {
    setEditing(p.id)
    setEditName(p.name)
    setEditNote(p.note ?? '')
  }

  async function saveEdit(id: string) {
    if (!editName.trim() || saving) return
    setSaving(true)
    try {
      const res = await fetch(`/api/placements/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName.trim(), note: editNote || null }),
      })
      if (res.ok) {
        const updated = await res.json()
        setPlacements(ps => ps.map(p => p.id === id ? { ...p, name: updated.name, note: updated.note } : p))
        setEditing(null)
      }
    } finally {
      setSaving(false)
    }
  }

  async function deletePlacement(id: string) {
    setDeleteError(e => ({ ...e, [id]: '' }))
    const res = await fetch(`/api/placements/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setPlacements(ps => ps.filter(p => p.id !== id))
    } else {
      const data = await res.json()
      setDeleteError(e => ({ ...e, [id]: data.error ?? 'ลบไม่ได้' }))
    }
  }

  return (
    <div className="space-y-3">
      {placements.map(p => {
        const isOpen = expanded.has(p.id)
        const isEditing = editing === p.id
        const activeCount = p.campaigns.filter(c => c.status === 'ACTIVE').length
        const typeColor = p.type ? TYPE_COLORS[p.type] : null

        return (
          <div key={p.id} className="rounded-lg border border-border overflow-hidden">
            {/* Header row */}
            <div className="flex items-center gap-3 px-4 py-3 bg-card">
              <button
                type="button"
                onClick={() => toggleExpand(p.id)}
                className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
              >
                {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>

              <MapPin className="w-4 h-4 text-sky-400 shrink-0" />

              <div className="flex-1 min-w-0">
                {isEditing ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      className="h-7 text-sm w-48"
                      autoFocus
                      onKeyDown={e => {
                        if (e.key === 'Enter') saveEdit(p.id)
                        if (e.key === 'Escape') setEditing(null)
                      }}
                    />
                    <Input
                      value={editNote}
                      onChange={e => setEditNote(e.target.value)}
                      placeholder="หมายเหตุ (optional)"
                      className="h-7 text-sm flex-1"
                    />
                  </div>
                ) : (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{p.name}</span>
                    {p.type && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border ${typeColor}`}>
                        {typeLabel[p.type] ?? p.type}
                      </span>
                    )}
                    {p.note && (
                      <span className="text-xs text-muted-foreground">{p.note}</span>
                    )}
                  </div>
                )}
              </div>

              {/* Campaign count badge */}
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-xs text-muted-foreground">
                  {p.campaigns.length} แคมเปญ
                  {activeCount > 0 && (
                    <span className="ml-1 text-green-400">({activeCount} active)</span>
                  )}
                </span>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 shrink-0">
                {isEditing ? (
                  <>
                    <button
                      type="button"
                      onClick={() => saveEdit(p.id)}
                      disabled={saving}
                      className="p-1.5 rounded hover:bg-muted text-green-400 transition-colors"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditing(null)}
                      className="p-1.5 rounded hover:bg-muted text-muted-foreground transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => startEdit(p)}
                      className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => deletePlacement(p.id)}
                      className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-destructive transition-colors"
                      title={p.campaigns.length > 0 ? `มี ${p.campaigns.length} แคมเปญใช้อยู่` : 'ลบ'}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
            </div>

            {deleteError[p.id] && (
              <p className="px-4 py-1.5 text-xs text-destructive bg-destructive/5 border-t border-destructive/20">
                {deleteError[p.id]}
              </p>
            )}

            {/* Campaign list */}
            {isOpen && (
              <div className="border-t border-border divide-y divide-border">
                {p.campaigns.length === 0 ? (
                  <p className="px-10 py-3 text-xs text-muted-foreground">ยังไม่มีแคมเปญที่ยิงไปที่นี่</p>
                ) : (
                  p.campaigns.map(c => (
                    <Link
                      key={c.id}
                      href={`/campaigns/${c.id}`}
                      className="flex items-center gap-3 px-10 py-2.5 hover:bg-muted/40 transition-colors"
                    >
                      <span className="text-sm flex-1 min-w-0 truncate">{c.name}</span>
                      <span className="text-xs text-muted-foreground shrink-0">{c.targetType}</span>
                      <Badge className={`${statusClass[c.status] ?? ''} text-[10px] px-1.5 py-0 h-4 shrink-0`}>
                        {c.status}
                      </Badge>
                    </Link>
                  ))
                )}
              </div>
            )}
          </div>
        )
      })}

      {/* Legacy placementName groups */}
      {legacyGroups.length > 0 && (
        <div className="space-y-3">
          {initial.length > 0 && (
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold pt-2 border-t border-border">
              ข้อมูลเก่า (ยังไม่ได้เพิ่มในระบบใหม่)
            </p>
          )}
          {legacyGroups.map(([name, campaigns]) => (
            <LegacyGroup
              key={name}
              name={name}
              campaigns={campaigns}
              statusClass={statusClass}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function LegacyGroup({
  name,
  campaigns,
  statusClass,
}: {
  name: string
  campaigns: Campaign[]
  statusClass: Record<string, string>
}) {
  const [open, setOpen] = useState(false)
  const activeCount = campaigns.filter(c => c.status === 'ACTIVE').length

  return (
    <div className="rounded-lg border border-border border-dashed overflow-hidden opacity-80">
      <div className="flex items-center gap-3 px-4 py-3 bg-card">
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
        >
          {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
        <MapPin className="w-4 h-4 text-amber-400 shrink-0" />
        <span className="flex-1 text-sm font-medium truncate">{name}</span>
        <span className="text-xs text-muted-foreground shrink-0">
          {campaigns.length} แคมเปญ
          {activeCount > 0 && <span className="ml-1 text-green-400">({activeCount} active)</span>}
        </span>
        <span className="text-[10px] text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded shrink-0">
          เก่า
        </span>
      </div>
      {open && (
        <div className="border-t border-border divide-y divide-border">
          {campaigns.map(c => (
            <Link
              key={c.id}
              href={`/campaigns/${c.id}`}
              className="flex items-center gap-3 px-10 py-2.5 hover:bg-muted/40 transition-colors"
            >
              <span className="text-sm flex-1 min-w-0 truncate">{c.name}</span>
              <span className="text-xs text-muted-foreground shrink-0">{c.targetType}</span>
              <Badge className={`${statusClass[c.status] ?? ''} text-[10px] px-1.5 py-0 h-4 shrink-0`}>
                {c.status}
              </Badge>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
