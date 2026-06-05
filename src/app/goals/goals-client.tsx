'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Check, X, Plus, Trash2 } from 'lucide-react'
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

interface GoalEntry {
  id: string
  date: string
  goalText: string | null
  successCriteria: string | null
  constraints: string | null
  planText: string | null
  risks: string | null
  doneCriteria: string | null
  targetText: string | null
  deadline: string | null
  createdAt: string
}

interface Props {
  globalNote: string | null
  campaigns: CampaignGoal[]
  goalEntries: GoalEntry[]
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

function today() {
  return new Date().toISOString().slice(0, 10)
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })
}

function GoalEntryItem({ entry, onSaved, onDeleted }: {
  entry: GoalEntry
  onSaved: () => void
  onDeleted: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    date: entry.date.slice(0, 10),
    goalText: entry.goalText ?? '',
    successCriteria: entry.successCriteria ?? '',
    constraints: entry.constraints ?? '',
    planText: entry.planText ?? '',
    risks: entry.risks ?? '',
    doneCriteria: entry.doneCriteria ?? '',
    targetText: entry.targetText ?? '',
    deadline: entry.deadline ? entry.deadline.slice(0, 10) : '',
  })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function save() {
    setSaving(true)
    try {
      const res = await fetch(`/api/goals/entries/${entry.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: form.date,
          goalText: form.goalText,
          successCriteria: form.successCriteria,
          constraints: form.constraints,
          planText: form.planText,
          risks: form.risks,
          doneCriteria: form.doneCriteria,
          targetText: form.targetText,
          deadline: form.deadline || null,
        }),
      })
      if (res.ok) { setEditing(false); onSaved() }
    } finally { setSaving(false) }
  }

  async function remove() {
    if (!confirm('ลบรายการนี้?')) return
    setDeleting(true)
    try {
      await fetch(`/api/goals/entries/${entry.id}`, { method: 'DELETE' })
      onDeleted()
    } finally { setDeleting(false) }
  }

  function cancel() {
    setForm({
      date: entry.date.slice(0, 10),
      goalText: entry.goalText ?? '',
      successCriteria: entry.successCriteria ?? '',
      constraints: entry.constraints ?? '',
      planText: entry.planText ?? '',
      risks: entry.risks ?? '',
      doneCriteria: entry.doneCriteria ?? '',
      targetText: entry.targetText ?? '',
      deadline: entry.deadline ? entry.deadline.slice(0, 10) : '',
    })
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="border border-ring rounded-lg p-4 space-y-3 bg-background">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] text-muted-foreground">วันที่วางแพลน</label>
            <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
              className="w-full mt-1 text-sm border border-border rounded-md px-3 py-2 bg-background focus:outline-none focus:ring-1 focus:ring-ring" />
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground">กำหนดเสร็จ</label>
            <input type="date" value={form.deadline} onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))}
              className="w-full mt-1 text-sm border border-border rounded-md px-3 py-2 bg-background focus:outline-none focus:ring-1 focus:ring-ring" />
          </div>
        </div>
        <div>
          <label className="text-[11px] text-muted-foreground">1. เป้าหมาย</label>
          <textarea value={form.goalText} onChange={e => setForm(f => ({ ...f, goalText: e.target.value }))}
            placeholder="ยิงโฆษณาแล้วได้อะไร เช่น ได้ 500 joins ใน 30 วัน ด้วยงบ 10 TON" rows={2}
            className="w-full mt-1 text-sm border border-border rounded-md px-3 py-2 bg-background resize-none focus:outline-none focus:ring-1 focus:ring-ring" />
        </div>
        <div>
          <label className="text-[11px] text-muted-foreground">2. เกณฑ์วัดผล</label>
          <textarea value={form.successCriteria} onChange={e => setForm(f => ({ ...f, successCriteria: e.target.value }))}
            placeholder="เช่น CPM ≤ 0.05 TON, CTR > 1%, joins ≥ 500" rows={2}
            className="w-full mt-1 text-sm border border-border rounded-md px-3 py-2 bg-background resize-none focus:outline-none focus:ring-1 focus:ring-ring" />
        </div>
        <div>
          <label className="text-[11px] text-muted-foreground">3. งบ / ข้อจำกัด</label>
          <textarea value={form.constraints} onChange={e => setForm(f => ({ ...f, constraints: e.target.value }))}
            placeholder="เช่น งบ 10 TON, placement: @channelname, ห้ามเกิน 0.5 TON/วัน" rows={2}
            className="w-full mt-1 text-sm border border-border rounded-md px-3 py-2 bg-background resize-none focus:outline-none focus:ring-1 focus:ring-ring" />
        </div>
        <div>
          <label className="text-[11px] text-muted-foreground">4. แผนการยิง</label>
          <textarea value={form.planText} onChange={e => setForm(f => ({ ...f, planText: e.target.value }))}
            placeholder="bid strategy, ช่วงเวลา, targeting, เพิ่ม/ลด bid ยังไง..." rows={3}
            className="w-full mt-1 text-sm border border-border rounded-md px-3 py-2 bg-background resize-none focus:outline-none focus:ring-1 focus:ring-ring" />
        </div>
        <div>
          <label className="text-[11px] text-muted-foreground">5. ความเสี่ยง</label>
          <textarea value={form.risks} onChange={e => setForm(f => ({ ...f, risks: e.target.value }))}
            placeholder="เช่น CPM พุ่งสูง, joins ต่ำกว่าคาด, placement ไม่ active" rows={2}
            className="w-full mt-1 text-sm border border-border rounded-md px-3 py-2 bg-background resize-none focus:outline-none focus:ring-1 focus:ring-ring" />
        </div>
        <div>
          <label className="text-[11px] text-muted-foreground">6. รู้ว่าสำเร็จเมื่อ</label>
          <textarea value={form.doneCriteria} onChange={e => setForm(f => ({ ...f, doneCriteria: e.target.value }))}
            placeholder="เช่น ได้ครบ 500 joins หรือใช้ครบงบ 10 TON แล้ว CPM ≤ 0.05" rows={2}
            className="w-full mt-1 text-sm border border-border rounded-md px-3 py-2 bg-background resize-none focus:outline-none focus:ring-1 focus:ring-ring" />
        </div>
        <div>
          <label className="text-[11px] text-muted-foreground">เป้า (ตัวเลข)</label>
          <input type="text" value={form.targetText} onChange={e => setForm(f => ({ ...f, targetText: e.target.value }))}
            placeholder="เช่น 500 joins, 10 TON budget"
            className="w-full mt-1 text-sm border border-border rounded-md px-3 py-2 bg-background focus:outline-none focus:ring-1 focus:ring-ring" />
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" size="sm" onClick={cancel} disabled={saving}><X className="w-3.5 h-3.5 mr-1" /> ยกเลิก</Button>
          <Button size="sm" onClick={save} disabled={saving}><Check className="w-3.5 h-3.5 mr-1" /> {saving ? 'บันทึก...' : 'บันทึก'}</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="border border-border rounded-lg p-4 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="text-xs font-semibold text-muted-foreground">
          {formatDate(entry.date)}
          {entry.deadline && <span className="ml-2 font-normal">· กำหนด {formatDate(entry.deadline)}</span>}
        </div>
        <div className="flex gap-1">
          <button onClick={() => setEditing(true)} className="text-muted-foreground hover:text-foreground p-1 rounded">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button onClick={remove} disabled={deleting} className="text-muted-foreground hover:text-destructive p-1 rounded">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      {entry.goalText && (
        <div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">1. เป้าหมาย</div>
          <p className="text-sm whitespace-pre-wrap">{entry.goalText}</p>
        </div>
      )}
      {entry.successCriteria && (
        <div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">2. เกณฑ์วัดผล</div>
          <p className="text-sm whitespace-pre-wrap">{entry.successCriteria}</p>
        </div>
      )}
      {entry.constraints && (
        <div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">3. งบ / ข้อจำกัด</div>
          <p className="text-sm whitespace-pre-wrap">{entry.constraints}</p>
        </div>
      )}
      {entry.planText && (
        <div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">4. แผนการยิง</div>
          <p className="text-sm whitespace-pre-wrap">{entry.planText}</p>
        </div>
      )}
      {entry.risks && (
        <div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">5. ความเสี่ยง</div>
          <p className="text-sm whitespace-pre-wrap">{entry.risks}</p>
        </div>
      )}
      {entry.doneCriteria && (
        <div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">6. รู้ว่าสำเร็จเมื่อ</div>
          <p className="text-sm whitespace-pre-wrap">{entry.doneCriteria}</p>
        </div>
      )}
      {entry.targetText && (
        <div className="text-[11px] text-muted-foreground">เป้า: {entry.targetText}</div>
      )}
    </div>
  )
}

function AddEntryForm({ onSaved, onCancel }: { onSaved: () => void; onCancel: () => void }) {
  const [form, setForm] = useState(() => ({
    date: today(),
    goalText: '',
    successCriteria: '',
    constraints: '',
    planText: '',
    risks: '',
    doneCriteria: '',
    targetText: '',
    deadline: '',
  }))
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!form.date) return
    setSaving(true)
    try {
      const res = await fetch('/api/goals/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: form.date,
          goalText: form.goalText,
          successCriteria: form.successCriteria,
          constraints: form.constraints,
          planText: form.planText,
          risks: form.risks,
          doneCriteria: form.doneCriteria,
          targetText: form.targetText,
          deadline: form.deadline || null,
        }),
      })
      if (res.ok) { onSaved() }
    } finally { setSaving(false) }
  }

  return (
    <div className="border border-ring rounded-lg p-4 space-y-3 bg-background">
      <div className="text-xs font-semibold text-muted-foreground">แพลนการยิงโฆษณาใหม่</div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[11px] text-muted-foreground">วันที่วางแพลน</label>
          <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
            className="w-full mt-1 text-sm border border-border rounded-md px-3 py-2 bg-background focus:outline-none focus:ring-1 focus:ring-ring" />
        </div>
        <div>
          <label className="text-[11px] text-muted-foreground">กำหนดเสร็จ</label>
          <input type="date" value={form.deadline} onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))}
            className="w-full mt-1 text-sm border border-border rounded-md px-3 py-2 bg-background focus:outline-none focus:ring-1 focus:ring-ring" />
        </div>
      </div>
      <div>
        <label className="text-[11px] text-muted-foreground">1. เป้าหมาย</label>
        <textarea value={form.goalText} onChange={e => setForm(f => ({ ...f, goalText: e.target.value }))}
          placeholder="ยิงโฆษณาแล้วได้อะไร เช่น ได้ 500 joins ใน 30 วัน ด้วยงบ 10 TON" rows={2}
          className="w-full mt-1 text-sm border border-border rounded-md px-3 py-2 bg-background resize-none focus:outline-none focus:ring-1 focus:ring-ring" />
      </div>
      <div>
        <label className="text-[11px] text-muted-foreground">2. เกณฑ์วัดผล</label>
        <textarea value={form.successCriteria} onChange={e => setForm(f => ({ ...f, successCriteria: e.target.value }))}
          placeholder="เช่น CPM ≤ 0.05 TON, CTR > 1%, joins ≥ 500" rows={2}
          className="w-full mt-1 text-sm border border-border rounded-md px-3 py-2 bg-background resize-none focus:outline-none focus:ring-1 focus:ring-ring" />
      </div>
      <div>
        <label className="text-[11px] text-muted-foreground">3. งบ / ข้อจำกัด</label>
        <textarea value={form.constraints} onChange={e => setForm(f => ({ ...f, constraints: e.target.value }))}
          placeholder="เช่น งบ 10 TON, placement: @channelname, ห้ามเกิน 0.5 TON/วัน" rows={2}
          className="w-full mt-1 text-sm border border-border rounded-md px-3 py-2 bg-background resize-none focus:outline-none focus:ring-1 focus:ring-ring" />
      </div>
      <div>
        <label className="text-[11px] text-muted-foreground">4. แผนการยิง</label>
        <textarea value={form.planText} onChange={e => setForm(f => ({ ...f, planText: e.target.value }))}
          placeholder="bid strategy, ช่วงเวลา, targeting, เพิ่ม/ลด bid ยังไง..." rows={3}
          className="w-full mt-1 text-sm border border-border rounded-md px-3 py-2 bg-background resize-none focus:outline-none focus:ring-1 focus:ring-ring" />
      </div>
      <div>
        <label className="text-[11px] text-muted-foreground">5. ความเสี่ยง</label>
        <textarea value={form.risks} onChange={e => setForm(f => ({ ...f, risks: e.target.value }))}
          placeholder="เช่น CPM พุ่งสูง, joins ต่ำกว่าคาด, placement ไม่ active" rows={2}
          className="w-full mt-1 text-sm border border-border rounded-md px-3 py-2 bg-background resize-none focus:outline-none focus:ring-1 focus:ring-ring" />
      </div>
      <div>
        <label className="text-[11px] text-muted-foreground">6. รู้ว่าสำเร็จเมื่อ</label>
        <textarea value={form.doneCriteria} onChange={e => setForm(f => ({ ...f, doneCriteria: e.target.value }))}
          placeholder="เช่น ได้ครบ 500 joins หรือใช้ครบงบ 10 TON แล้ว CPM ≤ 0.05" rows={2}
          className="w-full mt-1 text-sm border border-border rounded-md px-3 py-2 bg-background resize-none focus:outline-none focus:ring-1 focus:ring-ring" />
      </div>
      <div>
        <label className="text-[11px] text-muted-foreground">เป้า (ตัวเลข)</label>
        <input type="text" value={form.targetText} onChange={e => setForm(f => ({ ...f, targetText: e.target.value }))}
          placeholder="เช่น 500 joins, 10 TON budget"
          className="w-full mt-1 text-sm border border-border rounded-md px-3 py-2 bg-background focus:outline-none focus:ring-1 focus:ring-ring" />
      </div>
      <div className="flex gap-2 justify-end">
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving}><X className="w-3.5 h-3.5 mr-1" /> ยกเลิก</Button>
        <Button size="sm" onClick={save} disabled={saving || !form.date}><Check className="w-3.5 h-3.5 mr-1" /> {saving ? 'บันทึก...' : 'บันทึก'}</Button>
      </div>
    </div>
  )
}

export function GoalsClient({ globalNote, campaigns, goalEntries: initialEntries }: Props) {
  const router = useRouter()
  const [note, setNote] = useState(globalNote ?? '')
  const [noteSaving, setNoteSaving] = useState(false)
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [entries, setEntries] = useState<GoalEntry[]>(initialEntries)
  const [addingEntry, setAddingEntry] = useState(false)

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

  async function refreshEntries() {
    const res = await fetch('/api/goals/entries')
    if (res.ok) setEntries(await res.json())
  }

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
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">บันทึกรวม</h2>
          {noteSaving && <span className="text-[11px] text-muted-foreground">กำลังบันทึก...</span>}
        </div>
        <textarea
          value={note}
          onChange={handleNoteChange}
          placeholder="จดเป้าหมายโดยรวมของการยิงโฆษณา วิธีคิด แนวทาง..."
          rows={4}
          className="w-full text-sm border border-border rounded-lg px-4 py-3 bg-background resize-y focus:outline-none focus:ring-1 focus:ring-ring"
        />

        {/* Dated goal entries */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground uppercase tracking-wide">บันทึกรายวัน · {entries.length} รายการ</span>
            {!addingEntry && (
              <Button size="sm" variant="outline" onClick={() => setAddingEntry(true)}>
                <Plus className="w-3.5 h-3.5 mr-1" /> เพิ่ม
              </Button>
            )}
          </div>
          {addingEntry && (
            <AddEntryForm
              onSaved={() => { setAddingEntry(false); refreshEntries() }}
              onCancel={() => setAddingEntry(false)}
            />
          )}
          {entries.length === 0 && !addingEntry && (
            <p className="text-[12px] text-muted-foreground italic">ยังไม่มีบันทึก — กด + เพิ่ม เพื่อสร้างรายการแรก</p>
          )}
          <div className="space-y-2">
            {entries.map(e => (
              <GoalEntryItem
                key={e.id}
                entry={e}
                onSaved={refreshEntries}
                onDeleted={refreshEntries}
              />
            ))}
          </div>
        </div>
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
