'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { MapPin, ChevronDown, ChevronRight, Pencil, Trash2, Check, X, Hash, Bot } from 'lucide-react'

interface Campaign {
  id: string
  name: string
  status: string
  targetType: string
}

interface PlacementItem {
  id: string
  name: string
  type: string | null
  note: string | null
  createdAt: string
  campaigns: Campaign[]
}

interface LegacyGroup {
  name: string
  campaigns: Campaign[]
  type: string | null
}

const SECTION_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string; border: string }> = {
  CHANNEL: { label: 'Channel', icon: Hash,   color: 'text-blue-400',   border: 'border-blue-500/30' },
  BOT:     { label: 'Bot',     icon: Bot,    color: 'text-purple-400', border: 'border-purple-500/30' },
  SEARCH:  { label: 'Search',  icon: MapPin, color: 'text-orange-400', border: 'border-orange-500/30' },
  null:    { label: 'ไม่ระบุ', icon: MapPin, color: 'text-muted-foreground', border: 'border-border' },
}

const TYPE_ORDER = ['CHANNEL', 'BOT', 'SEARCH', 'null']

export function PlacementsClient({
  placements: initial,
  legacyGroups,
  statusClass,
}: {
  placements: PlacementItem[]
  legacyGroups: LegacyGroup[]
  statusClass: Record<string, string>
}) {
  const [placements, setPlacements] = useState(initial)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [editing, setEditing] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editNote, setEditNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleteError, setDeleteError] = useState<Record<string, string>>({})

  function toggleExpand(key: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
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

  // Group M2M placements and legacy by type
  const grouped: Record<string, { m2m: PlacementItem[]; legacy: LegacyGroup[] }> = {}
  for (const t of TYPE_ORDER) { grouped[t] = { m2m: [], legacy: [] } }

  for (const p of placements) {
    const key = p.type ?? 'null'
    if (!grouped[key]) grouped[key] = { m2m: [], legacy: [] }
    grouped[key].m2m.push(p)
  }
  for (const lg of legacyGroups) {
    const key = lg.type ?? 'null'
    if (!grouped[key]) grouped[key] = { m2m: [], legacy: [] }
    grouped[key].legacy.push(lg)
  }

  const sections = TYPE_ORDER.filter(t => grouped[t].m2m.length + grouped[t].legacy.length > 0)

  return (
    <div className="space-y-8">
      {sections.map(typeKey => {
        const { m2m, legacy } = grouped[typeKey]
        const cfg = SECTION_CONFIG[typeKey]
        const Icon = cfg.icon
        const total = m2m.length + legacy.length

        return (
          <div key={typeKey}>
            {/* Section header */}
            <div className={`flex items-center gap-2 mb-3 pb-2 border-b ${cfg.border}`}>
              <Icon className={`w-4 h-4 ${cfg.color}`} />
              <h2 className={`text-sm font-semibold uppercase tracking-wide ${cfg.color}`}>
                {cfg.label}
              </h2>
              <span className="text-xs text-muted-foreground">· {total} ปลายทาง</span>
            </div>

            <div className="space-y-2">
              {/* M2M Placement records */}
              {m2m.map(p => {
                const isOpen = expanded.has(p.id)
                const isEditing = editing === p.id
                const activeCount = p.campaigns.filter(c => c.status === 'ACTIVE').length

                return (
                  <div key={p.id} className="rounded-lg border border-border overflow-hidden">
                    <div className="flex items-center gap-3 px-4 py-3 bg-card">
                      <button
                        type="button"
                        onClick={() => toggleExpand(p.id)}
                        className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                      >
                        {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </button>
                      <Icon className={`w-4 h-4 ${cfg.color} shrink-0`} />

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
                            {p.note && <span className="text-xs text-muted-foreground">{p.note}</span>}
                          </div>
                        )}
                      </div>

                      <span className="text-xs text-muted-foreground shrink-0">
                        {p.campaigns.length} แคมเปญ
                        {activeCount > 0 && <span className="ml-1 text-green-400">({activeCount} active)</span>}
                      </span>

                      <div className="flex items-center gap-1 shrink-0">
                        {isEditing ? (
                          <>
                            <button type="button" onClick={() => saveEdit(p.id)} disabled={saving}
                              className="p-1.5 rounded hover:bg-muted text-green-400 transition-colors">
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button type="button" onClick={() => setEditing(null)}
                              className="p-1.5 rounded hover:bg-muted text-muted-foreground transition-colors">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button type="button"
                              onClick={() => { setEditing(p.id); setEditName(p.name); setEditNote(p.note ?? '') }}
                              className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button type="button" onClick={() => deletePlacement(p.id)}
                              className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-destructive transition-colors">
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

                    {isOpen && (
                      <div className="border-t border-border divide-y divide-border">
                        {p.campaigns.length === 0 ? (
                          <p className="px-10 py-3 text-xs text-muted-foreground">ยังไม่มีแคมเปญที่ยิงไปที่นี่</p>
                        ) : p.campaigns.map(c => (
                          <CampaignRow key={c.id} campaign={c} statusClass={statusClass} />
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Legacy groups */}
              {legacy.map(lg => (
                <LegacyGroupItem
                  key={lg.name}
                  lg={lg}
                  icon={Icon}
                  iconClass={cfg.color}
                  expanded={expanded.has(`legacy:${lg.name}`)}
                  onToggle={() => toggleExpand(`legacy:${lg.name}`)}
                  statusClass={statusClass}
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function CampaignRow({ campaign: c, statusClass }: { campaign: Campaign; statusClass: Record<string, string> }) {
  return (
    <Link href={`/campaigns/${c.id}`}
      className="flex items-center gap-3 px-10 py-2.5 hover:bg-muted/40 transition-colors">
      <span className="text-sm flex-1 min-w-0 truncate">{c.name}</span>
      <span className="text-xs text-muted-foreground shrink-0">{c.targetType}</span>
      <Badge className={`${statusClass[c.status] ?? ''} text-[10px] px-1.5 py-0 h-4 shrink-0`}>
        {c.status}
      </Badge>
    </Link>
  )
}

function LegacyGroupItem({
  lg, icon: Icon, iconClass, expanded, onToggle, statusClass,
}: {
  lg: LegacyGroup
  icon: React.ElementType
  iconClass: string
  expanded: boolean
  onToggle: () => void
  statusClass: Record<string, string>
}) {
  const activeCount = lg.campaigns.filter(c => c.status === 'ACTIVE').length
  return (
    <div className="rounded-lg border border-dashed border-border overflow-hidden opacity-80">
      <div className="flex items-center gap-3 px-4 py-3 bg-card">
        <button type="button" onClick={onToggle}
          className="text-muted-foreground hover:text-foreground transition-colors shrink-0">
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
        <Icon className={`w-4 h-4 ${iconClass} shrink-0`} />
        <span className="flex-1 text-sm font-medium truncate">{lg.name}</span>
        <span className="text-xs text-muted-foreground shrink-0">
          {lg.campaigns.length} แคมเปญ
          {activeCount > 0 && <span className="ml-1 text-green-400">({activeCount} active)</span>}
        </span>
        <span className="text-[10px] text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded shrink-0">เก่า</span>
      </div>
      {expanded && (
        <div className="border-t border-border divide-y divide-border">
          {lg.campaigns.map(c => <CampaignRow key={c.id} campaign={c} statusClass={statusClass} />)}
        </div>
      )}
    </div>
  )
}
