'use client'

import { useState } from 'react'
import { ChevronUp, ChevronDown } from 'lucide-react'
import { CampaignRow } from './campaign-row'

type SerializedCampaign = {
  id: string
  placementType: string | null
  status: string
  sortOrder: number
  createdAt: string
  [key: string]: unknown
}

function sortGroup(group: SerializedCampaign[]): SerializedCampaign[] {
  return [...group].sort((a, b) => {
    const bySort = (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
    if (bySort !== 0) return bySort
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })
}

function computeMove(
  group: SerializedCampaign[],
  idx: number,
  dir: 'up' | 'down'
): SerializedCampaign[] {
  const m = group.map((c, i) => ({ ...c, sortOrder: i }))
  const target = dir === 'up' ? idx - 1 : idx + 1
  const tmp = m[idx].sortOrder
  m[idx] = { ...m[idx], sortOrder: m[target].sortOrder }
  m[target] = { ...m[target], sortOrder: tmp }
  return m.sort((a, b) => a.sortOrder - b.sortOrder)
}

function persistOrder(items: SerializedCampaign[]) {
  fetch('/api/campaigns/reorder', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(items.map(c => ({ id: c.id, sortOrder: c.sortOrder }))),
  })
}

export function CampaignList({ campaigns: initial }: { campaigns: SerializedCampaign[] }) {
  const [campaigns, setCampaigns] = useState(initial)

  function handleMove(group: SerializedCampaign[], idx: number, dir: 'up' | 'down') {
    const newGroup = computeMove(group, idx, dir)
    const groupIds = new Set(group.map(c => c.id))
    setCampaigns(prev => [...prev.filter(c => !groupIds.has(c.id)), ...newGroup])
    persistOrder(newGroup)
  }

  const active = campaigns.filter(c => c.status !== 'CANCELLED')
  const groups: { label: string; items: SerializedCampaign[]; sortable: boolean }[] = [
    { label: 'Channels', items: sortGroup(active.filter(c => c.placementType === 'CHANNEL')), sortable: true },
    { label: 'Bots',     items: sortGroup(active.filter(c => c.placementType === 'BOT')),     sortable: true },
    { label: 'Search',   items: sortGroup(active.filter(c => c.placementType === 'SEARCH')),  sortable: true },
    { label: 'ไม่ระบุ',  items: sortGroup(active.filter(c => !c.placementType)),              sortable: true },
    { label: 'Cancelled', items: campaigns.filter(c => c.status === 'CANCELLED'),             sortable: false },
  ]

  return (
    <div className="space-y-8">
      {groups.map(({ label, items, sortable }) =>
        items.length === 0 ? null : (
          <div key={label}>
            <div className="flex items-center gap-2 mb-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                {label}
              </h2>
              <span className="text-xs text-muted-foreground">· {items.length}</span>
            </div>
            <div className="space-y-1.5">
              {items.map((c, i) => (
                <div key={c.id} className="flex items-center gap-1.5">
                  {sortable && (
                    <div className="flex flex-col gap-0.5 shrink-0">
                      <button
                        onClick={() => handleMove(items, i, 'up')}
                        disabled={i === 0}
                        className="p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-0 disabled:pointer-events-none transition-colors"
                        aria-label="ขึ้น"
                      >
                        <ChevronUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleMove(items, i, 'down')}
                        disabled={i === items.length - 1}
                        className="p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-0 disabled:pointer-events-none transition-colors"
                        aria-label="ลง"
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <CampaignRow campaign={c} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      )}
    </div>
  )
}
