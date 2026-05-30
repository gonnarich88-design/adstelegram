'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface CampaignGoal {
  id: string
  name: string
  status: string
  targetType: string
  startDate: string
  endDate: string | null
  targetDate: string | null
  targetJoins: number | null
  goalText: string | null
  planText: string | null
  totalJoins: number
}

interface Props {
  globalNote: string | null
  campaigns: CampaignGoal[]
}

function daysBetween(a: Date, b: Date) {
  return Math.max(0, Math.floor((b.getTime() - a.getTime()) / 86400000))
}

function PaceBar({ startDate, targetDate, targetJoins, actualJoins }: {
  startDate: string
  targetDate: string | null
  targetJoins: number | null
  actualJoins: number
}) {
  if (!targetJoins || targetJoins <= 0 || !targetDate) return null

  const now = new Date()
  const start = new Date(startDate)
  const end = new Date(targetDate)
  const totalDays = daysBetween(start, end)

  if (totalDays <= 0) return null

  const daysElapsed = Math.min(daysBetween(start, now), totalDays)
  const paceTarget = Math.round(targetJoins * (daysElapsed / totalDays))
  const progressPct = Math.min(100, (actualJoins / targetJoins) * 100)
  const pacePct = Math.min(100, (paceTarget / targetJoins) * 100)
  const ahead = actualJoins >= paceTarget

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[11px] text-muted-foreground">
        <span>{actualJoins.toLocaleString('th-TH')} / {targetJoins.toLocaleString('th-TH')} joins</span>
        <span className={ahead ? 'text-green-500' : 'text-yellow-500'}>
          {ahead ? 'ahead' : 'behind'} pace ({paceTarget.toLocaleString('th-TH')} expected)
        </span>
      </div>
      <div className="relative h-2 bg-muted rounded-full overflow-visible">
        <div
          className={`h-full rounded-full transition-all ${ahead ? 'bg-green-500' : 'bg-yellow-400'}`}
          style={{ width: `${progressPct}%` }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-0.5 h-4 bg-foreground/40 rounded-full"
          style={{ left: `${pacePct}%` }}
        />
      </div>
      <div className="text-[10px] text-muted-foreground text-right">
        เส้นตาย: {new Date(targetDate!).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}
        {' · '}เหลือ {Math.max(0, daysBetween(now, end))} วัน
      </div>
    </div>
  )
}

function CampaignGoalCard({ campaign, onSaved }: { campaign: CampaignGoal; onSaved: () => void }) {
  const [editing, setEditing] = useState(false)
  const [goalText, setGoalText] = useState(campaign.goalText ?? '')
  const [planText, setPlanText] = useState(campaign.planText ?? '')
  const [targetJoins, setTargetJoins] = useState(campaign.targetJoins?.toString() ?? '')
  const [targetDate, setTargetDate] = useState(
    campaign.targetDate ? campaign.targetDate.slice(0, 10) : ''
  )
  const [saving, setSaving] = useState(false)

  const joinsLabel = campaign.targetType === 'BOT' ? 'Startbot' : 'Joins'
  const hasGoal = campaign.goalText || campaign.planText || campaign.targetJoins

  async function save() {
    setSaving(true)
    try {
      const res = await fetch(`/api/campaigns/${campaign.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: campaign.name,
          targetType: campaign.targetType,
          status: campaign.status,
          startDate: campaign.startDate,
          endDate: campaign.endDate,
          goalText: goalText.trim() || null,
          planText: planText.trim() || null,
          targetJoins: targetJoins ? Number(targetJoins) : null,
          targetDate: targetDate || null,
        }),
      })
      if (res.ok) {
        setEditing(false)
        onSaved()
      }
    } finally {
      setSaving(false)
    }
  }

  function cancel() {
    setGoalText(campaign.goalText ?? '')
    setPlanText(campaign.planText ?? '')
    setTargetJoins(campaign.targetJoins?.toString() ?? '')
    setTargetDate(campaign.targetDate ? campaign.targetDate.slice(0, 10) : '')
    setEditing(false)
  }

  return (
    <div className="border border-border rounded-lg p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-medium text-sm">{campaign.name}</div>
          <div className="text-[11px] text-muted-foreground">{campaign.status} · {campaign.targetType}</div>
        </div>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="text-muted-foreground hover:text-foreground p-1 rounded"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-3">
          <div>
            <label className="text-[11px] text-muted-foreground">เป้าหมาย</label>
            <textarea
              value={goalText}
              onChange={e => setGoalText(e.target.value)}
              placeholder="เป้าหมายของแคมเปญนี้..."
              rows={2}
              className="w-full mt-1 text-sm border border-border rounded-md px-3 py-2 bg-background resize-none focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground">แผน / วิธีการ</label>
            <textarea
              value={planText}
              onChange={e => setPlanText(e.target.value)}
              placeholder="จะทำอย่างไรต่อ..."
              rows={3}
              className="w-full mt-1 text-sm border border-border rounded-md px-3 py-2 bg-background resize-none focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-[11px] text-muted-foreground">เป้า {joinsLabel}</label>
              <input
                type="number"
                value={targetJoins}
                onChange={e => setTargetJoins(e.target.value)}
                placeholder="0"
                min={1}
                className="w-full mt-1 text-sm border border-border rounded-md px-3 py-2 bg-background focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div className="flex-1">
              <label className="text-[11px] text-muted-foreground">เส้นตาย</label>
              <input
                type="date"
                value={targetDate}
                onChange={e => setTargetDate(e.target.value)}
                className="w-full mt-1 text-sm border border-border rounded-md px-3 py-2 bg-background focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" onClick={cancel} disabled={saving}>
              <X className="w-3.5 h-3.5 mr-1" /> ยกเลิก
            </Button>
            <Button size="sm" onClick={save} disabled={saving}>
              <Check className="w-3.5 h-3.5 mr-1" /> {saving ? 'กำลังบันทึก...' : 'บันทึก'}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {!hasGoal && (
            <p className="text-[12px] text-muted-foreground italic">ยังไม่มีเป้าหมาย — กด ✏️ เพื่อเพิ่ม</p>
          )}
          {campaign.goalText && (
            <div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">เป้าหมาย</div>
              <p className="text-sm whitespace-pre-wrap">{campaign.goalText}</p>
            </div>
          )}
          {campaign.planText && (
            <div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">แผน</div>
              <p className="text-sm whitespace-pre-wrap">{campaign.planText}</p>
            </div>
          )}
          {campaign.targetJoins && (
            <PaceBar
              startDate={campaign.startDate}
              targetDate={campaign.targetDate}
              targetJoins={campaign.targetJoins}
              actualJoins={campaign.totalJoins}
            />
          )}
        </div>
      )}
    </div>
  )
}

export function GoalsClient({ globalNote, campaigns }: Props) {
  const router = useRouter()
  const [note, setNote] = useState(globalNote ?? '')
  const [noteSaving, setNoteSaving] = useState(false)
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const saveNote = useCallback(async (value: string) => {
    setNoteSaving(true)
    try {
      await fetch('/api/goals/global', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: value.trim() || null }),
      })
    } finally {
      setNoteSaving(false)
    }
  }, [])

  function handleNoteChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const value = e.target.value
    setNote(value)
    if (saveTimeout.current) clearTimeout(saveTimeout.current)
    saveTimeout.current = setTimeout(() => saveNote(value), 1000)
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">เป้าหมาย</h1>
      </div>

      {/* Global note */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">บันทึกรวม</h2>
          {noteSaving && <span className="text-[11px] text-muted-foreground">กำลังบันทึก...</span>}
        </div>
        <textarea
          value={note}
          onChange={handleNoteChange}
          placeholder="จดเป้าหมายโดยรวมของการยิงโฆษณา วิธีคิด แนวทาง..."
          rows={5}
          className="w-full text-sm border border-border rounded-lg px-4 py-3 bg-background resize-y focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      {/* Per-campaign goals */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          เป้าหมายรายแคมเปญ
          <span className="ml-2 font-normal">· {campaigns.length} แคมเปญที่ active</span>
        </h2>
        {campaigns.length === 0 ? (
          <p className="text-sm text-muted-foreground">ไม่มีแคมเปญที่กำลังทำงานอยู่</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {campaigns.map(c => (
              <CampaignGoalCard
                key={c.id}
                campaign={c}
                onSaved={() => router.refresh()}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
