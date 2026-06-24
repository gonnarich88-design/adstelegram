'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { MapPin, Pencil, Trash2, Check, X, Hash, Bot } from 'lucide-react'
import type { Section, PlacementItem, LegacyItem, CampaignRow } from './page'

const SECTION_CONFIG: Record<string, { label: string; Icon: React.ElementType; color: string; border: string }> = {
  CHANNEL: { label: 'Channel', Icon: Hash,   color: 'text-blue-400',         border: 'border-blue-500/30' },
  BOT:     { label: 'Bot',     Icon: Bot,    color: 'text-purple-400',       border: 'border-purple-500/30' },
  SEARCH:  { label: 'Search',  Icon: MapPin, color: 'text-orange-400',       border: 'border-orange-500/30' },
  OTHER:   { label: 'ไม่ระบุ', Icon: MapPin, color: 'text-muted-foreground', border: 'border-border' },
}

const STATUS_DOT: Record<string, string> = {
  ACTIVE:    'bg-green-500',
  STOPPED:   'bg-yellow-500',
  PAUSED:    'bg-gray-500',
  DONE:      'bg-gray-600',
  CANCELLED: 'bg-red-500',
}

const MAX_CHIPS = 3

function CampaignChips({ campaigns, expandKey, expanded, onToggle }: {
  campaigns: CampaignRow[]
  expandKey: string
  expanded: boolean
  onToggle: () => void
}) {
  const shown = expanded ? campaigns : campaigns.slice(0, MAX_CHIPS)
  const overflow = campaigns.length - MAX_CHIPS

  return (
    <div className="flex flex-wrap items-center gap-1.5 mt-1">
      {shown.map(c => (
        <Link
          key={c.id}
          href={`/campaigns/${c.id}`}
          onClick={e => e.stopPropagation()}
          className="flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-full bg-muted hover:bg-muted/60 transition-colors max-w-[160px] shrink-0"
        >
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[c.status] ?? 'bg-gray-500'}`} />
          <span className="truncate text-foreground">{c.name}</span>
        </Link>
      ))}
      {!expanded && overflow > 0 && (
        <button
          type="button"
          onClick={e => { e.stopPropagation(); onToggle() }}
          className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0"
        >
          +{overflow} เพิ่มเติม
        </button>
      )}
      {expanded && campaigns.length > MAX_CHIPS && (
        <button
          type="button"
          onClick={e => { e.stopPropagation(); onToggle() }}
          className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0"
        >
          ซ่อน
        </button>
      )}
    </div>
  )
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
                const isEditing = editing === p.id
                const chipKey = `chips:${p.id}`

                return (
                  <div key={p.id} className="rounded-lg border border-border overflow-hidden">
                    <div className="flex items-start gap-3 px-4 py-3 bg-card">
                      <Icon className={`w-4 h-4 ${cfg.color} shrink-0 mt-0.5`} />

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
                          <span className="font-medium text-sm">{p.name}</span>
                        )}
                        {p.campaigns.length > 0 && (
                          <CampaignChips
                            campaigns={p.campaigns}
                            expandKey={chipKey}
                            expanded={expanded.has(chipKey)}
                            onToggle={() => toggle(chipKey)}
                          />
                        )}
                        {p.note && <p className="text-xs text-muted-foreground mt-1">{p.note}</p>}
                      </div>

                      <div className="flex items-center gap-1 shrink-0 mt-0.5">
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
                  </div>
                )
              })}

              {/* Legacy groups */}
              {section.legacy.map(lg => {
                const chipKey = `chips:lg:${lg.name}`
                return (
                  <div key={lg.name} className="rounded-lg border border-dashed border-border overflow-hidden opacity-80">
                    <div className="flex items-start gap-3 px-4 py-3 bg-card">
                      <Icon className={`w-4 h-4 ${cfg.color} shrink-0 mt-0.5`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm truncate">{lg.name}</span>
                          <span className="text-[10px] text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded shrink-0">เก่า</span>
                        </div>
                        {lg.campaigns.length > 0 && (
                          <CampaignChips
                            campaigns={lg.campaigns}
                            expandKey={chipKey}
                            expanded={expanded.has(chipKey)}
                            onToggle={() => toggle(chipKey)}
                          />
                        )}
                      </div>
                    </div>
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
