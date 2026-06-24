'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { MapPin, ChevronDown, ChevronRight, Pencil, Trash2, Check, X, Hash, Bot } from 'lucide-react'
import type { Section, PlacementItem, LegacyItem, CampaignRow } from './page'

const SECTION_CONFIG: Record<string, { label: string; Icon: React.ElementType; color: string; border: string }> = {
  CHANNEL: { label: 'Channel', Icon: Hash,   color: 'text-blue-400',            border: 'border-blue-500/30' },
  BOT:     { label: 'Bot',     Icon: Bot,    color: 'text-purple-400',          border: 'border-purple-500/30' },
  SEARCH:  { label: 'Search',  Icon: MapPin, color: 'text-orange-400',          border: 'border-orange-500/30' },
  OTHER:   { label: 'ไม่ระบุ', Icon: MapPin, color: 'text-muted-foreground',    border: 'border-border' },
}

export function PlacementsClient({
  sections,
  statusClass,
}: {
  sections: Section[]
  statusClass: Record<string, string>
}) {
  const [placements, setPlacements] = useState<Record<string, PlacementItem>>(
    () => Object.fromEntries(sections.flatMap(s => s.m2m).map(p => [p.id, p]))
  )
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [editing, setEditing] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editNote, setEditNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleteError, setDeleteError] = useState<Record<string, string>>({})
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set())

  function toggle(key: string) {
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
        setPlacements(prev => ({ ...prev, [id]: { ...prev[id], name: updated.name, note: updated.note } }))
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
      setDeletedIds(prev => new Set([...prev, id]))
    } else {
      const data = await res.json()
      setDeleteError(e => ({ ...e, [id]: data.error ?? 'ลบไม่ได้' }))
    }
  }

  return (
    <div className="space-y-8">
      {sections.map(section => {
        const cfg = SECTION_CONFIG[section.typeKey] ?? SECTION_CONFIG.OTHER
        const { Icon } = cfg
        const visibleM2m = section.m2m.filter(p => !deletedIds.has(p.id))
        const count = visibleM2m.length + section.legacy.length

        return (
          <div key={section.typeKey}>
            {/* Section header */}
            <div className={`flex items-center gap-2 mb-3 pb-2 border-b ${cfg.border}`}>
              <Icon className={`w-4 h-4 ${cfg.color}`} />
              <h2 className={`text-sm font-semibold uppercase tracking-wide ${cfg.color}`}>
                {cfg.label}
              </h2>
              <span className="text-xs text-muted-foreground">· {count} ปลายทาง</span>
            </div>

            <div className="space-y-2">
              {/* M2M Placement records */}
              {visibleM2m.map(orig => {
                const p = placements[orig.id] ?? orig
                const isOpen = expanded.has(p.id)
                const isEditing = editing === p.id
                const activeCount = p.campaigns.filter(c => c.status === 'ACTIVE').length

                return (
                  <div key={p.id} className="rounded-lg border border-border overflow-hidden">
                    <div className="flex items-center gap-3 px-4 py-3 bg-card">
                      <button type="button" onClick={() => toggle(p.id)}
                        className="text-muted-foreground hover:text-foreground transition-colors shrink-0">
                        {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </button>
                      <Icon className={`w-4 h-4 ${cfg.color} shrink-0`} />
                      <div className="flex-1 min-w-0">
                        {isEditing ? (
                          <div className="flex items-center gap-2">
                            <Input value={editName} onChange={e => setEditName(e.target.value)}
                              className="h-7 text-sm w-48" autoFocus
                              onKeyDown={e => { if (e.key === 'Enter') saveEdit(p.id); if (e.key === 'Escape') setEditing(null) }} />
                            <Input value={editNote} onChange={e => setEditNote(e.target.value)}
                              placeholder="หมายเหตุ" className="h-7 text-sm flex-1" />
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
                              className="p-1.5 rounded hover:bg-muted text-green-400"><Check className="w-3.5 h-3.5" /></button>
                            <button type="button" onClick={() => setEditing(null)}
                              className="p-1.5 rounded hover:bg-muted text-muted-foreground"><X className="w-3.5 h-3.5" /></button>
                          </>
                        ) : (
                          <>
                            <button type="button"
                              onClick={() => { setEditing(p.id); setEditName(p.name); setEditNote(p.note ?? '') }}
                              className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground">
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button type="button" onClick={() => deletePlacement(p.id)}
                              className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-destructive">
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
                        {p.campaigns.length === 0
                          ? <p className="px-10 py-3 text-xs text-muted-foreground">ยังไม่มีแคมเปญ</p>
                          : p.campaigns.map(c => <CampaignLink key={c.id} c={c} statusClass={statusClass} />)
                        }
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Legacy groups */}
              {section.legacy.map(lg => {
                const key = `lg:${lg.name}`
                const isOpen = expanded.has(key)
                const activeCount = lg.campaigns.filter(c => c.status === 'ACTIVE').length
                return (
                  <div key={lg.name} className="rounded-lg border border-dashed border-border overflow-hidden opacity-80">
                    <div className="flex items-center gap-3 px-4 py-3 bg-card">
                      <button type="button" onClick={() => toggle(key)}
                        className="text-muted-foreground hover:text-foreground shrink-0">
                        {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </button>
                      <Icon className={`w-4 h-4 ${cfg.color} shrink-0`} />
                      <span className="flex-1 text-sm font-medium truncate">{lg.name}</span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {lg.campaigns.length} แคมเปญ
                        {activeCount > 0 && <span className="ml-1 text-green-400">({activeCount} active)</span>}
                      </span>
                      <span className="text-[10px] text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded shrink-0">เก่า</span>
                    </div>
                    {isOpen && (
                      <div className="border-t border-border divide-y divide-border">
                        {lg.campaigns.map(c => <CampaignLink key={c.id} c={c} statusClass={statusClass} />)}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function CampaignLink({ c, statusClass }: { c: CampaignRow; statusClass: Record<string, string> }) {
  return (
    <Link href={`/campaigns/${c.id}`}
      className="flex items-center gap-3 px-10 py-2.5 hover:bg-muted/40 transition-colors">
      <span className="text-sm flex-1 min-w-0 truncate">{c.name}</span>
      <span className="text-xs text-muted-foreground shrink-0">{c.targetType}</span>
      <Badge className={`${statusClass[c.status] ?? ''} text-[10px] px-1.5 py-0 h-4 shrink-0`}>{c.status}</Badge>
    </Link>
  )
}
