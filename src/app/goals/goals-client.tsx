'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Check, X, Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
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
  budgetTon: number | null
  dailyBudgetTon: number
  totalJoins: number
  lastBsp: number | null
  lastCpm: number | null
  lastCps: number | null
}

interface GoalEntry {
  id: string
  date: string
  baseline: string | null
  goalText: string | null
  successCriteria: string | null
  constraints: string | null
  planText: string | null
  risks: string | null
  doneCriteria: string | null
  targetText: string | null
  deadline: string | null
  campaignIds: string[]
  createdAt: string
}

interface Props {
  globalNote: string | null
  campaigns: CampaignGoal[]
  goalEntries: GoalEntry[]
}

function statusColor(status: string) {
  if (status === 'ACTIVE') return 'bg-green-500/10 text-green-600 dark:text-green-400'
  if (status === 'PAUSED') return 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400'
  return 'bg-muted text-muted-foreground'
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

function CampaignGoalCard({ campaign, linkedPlanners, onSaved }: { campaign: CampaignGoal; linkedPlanners: GoalEntry[]; onSaved: () => void }) {
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

      {linkedPlanners.length > 0 && (
        <div className="border-t border-border pt-3 mt-1 space-y-1.5">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider">แพลนที่เชื่อม · {linkedPlanners.length}</div>
          {linkedPlanners.map(p => (
            <div key={p.id} className="flex items-start gap-2 text-[12px]">
              <span className="text-muted-foreground shrink-0 mt-0.5">{formatDate(p.date)}</span>
              {p.goalText
                ? <span className="text-foreground/80 line-clamp-1">{p.goalText}</span>
                : <span className="text-muted-foreground italic">ไม่มีเป้าหมาย</span>
              }
            </div>
          ))}
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

function GoalEntryItem({ entry, campaigns, onSaved, onDeleted }: {
  entry: GoalEntry
  campaigns: CampaignGoal[]
  onSaved: () => void
  onDeleted: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [form, setForm] = useState({
    date: entry.date.slice(0, 10),
    campaignIds: entry.campaignIds,
    baseline: entry.baseline ?? '',
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
          baseline: form.baseline,
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
      campaignIds: entry.campaignIds,
      baseline: entry.baseline ?? '',
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
        {/* Context section */}
        <div className="rounded-md bg-muted/50 border border-border p-3 space-y-3">
          <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">บริบทก่อนรัน</div>
          <div>
            <label className="text-[11px] text-muted-foreground">แคมเปญที่จะรัน</label>
            <div className="mt-1 border border-border rounded-md overflow-hidden divide-y divide-border bg-background">
              {campaigns.length === 0
                ? <p className="px-3 py-2 text-sm text-muted-foreground italic">ไม่มีแคมเปญที่ active</p>
                : campaigns.map(c => {
                    const checked = form.campaignIds.includes(c.id)
                    return (
                      <label key={c.id} className={`flex items-start gap-3 px-3 py-2.5 cursor-pointer transition-colors ${checked ? 'bg-primary/5' : 'hover:bg-muted/40'}`}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => setForm(f => ({
                            ...f,
                            campaignIds: checked
                              ? f.campaignIds.filter(id => id !== c.id)
                              : [...f.campaignIds, c.id],
                          }))}
                          className="mt-0.5 shrink-0"
                        />
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium leading-tight">{c.name}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${statusColor(c.status)}`}>{c.status}</span>
                          </div>
                          {checked && (
                            <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-muted-foreground">
                              {c.budgetTon != null && <span>งบ {c.budgetTon.toFixed(2)} TON</span>}
                              {c.lastBsp != null && <span>BSP {c.lastBsp.toFixed(0)}%</span>}
                              {c.lastCpm != null && <span>CPM ${c.lastCpm.toFixed(4)}</span>}
                              {c.lastCps != null && <span>CPS ${c.lastCps.toFixed(4)}</span>}
                            </div>
                          )}
                        </div>
                      </label>
                    )
                  })
              }
            </div>
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground">Baseline (ก่อนรัน)</label>
            <textarea value={form.baseline} onChange={e => setForm(f => ({ ...f, baseline: e.target.value }))}
              placeholder={"BSP: __% · CPM: __ TON · Cost-per-start: __ TON"} rows={2}
              className="w-full mt-1 text-sm border border-border rounded-md px-3 py-2 bg-background resize-none focus:outline-none focus:ring-1 focus:ring-ring font-mono" />
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
    <div className="border border-border rounded-lg overflow-hidden">
      {/* Cover — always visible, click to toggle */}
      <button
        className="w-full text-left p-4 flex items-start justify-between gap-2 hover:bg-muted/40 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground">{formatDate(entry.date)}</span>
            {entry.deadline && (
              <span className="text-[11px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                ถึง {formatDate(entry.deadline)}
              </span>
            )}
            {entry.campaignIds.map(cid => {
              const c = campaigns.find(x => x.id === cid)
              if (!c) return null
              return (
                <span key={cid} className="text-[11px] bg-blue-500/10 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded border border-blue-500/20">
                  {c.name}
                </span>
              )
            })}
          </div>
          {entry.goalText
            ? <p className="text-sm font-medium leading-snug">{entry.goalText}</p>
            : <p className="text-sm text-muted-foreground italic">ยังไม่มีเป้าหมาย</p>
          }
        </div>
        <div className="flex items-center gap-1 shrink-0 mt-0.5">
          {expanded
            ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
            : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
          }
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-border px-4 pb-4 pt-3 space-y-2">
          <div className="flex justify-end gap-1 mb-1">
            <button onClick={() => setEditing(true)} className="text-muted-foreground hover:text-foreground p-1 rounded">
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button onClick={remove} disabled={deleting} className="text-muted-foreground hover:text-destructive p-1 rounded">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
          {(entry.campaignIds.length > 0 || entry.baseline) && (
            <div className="rounded-md bg-muted/50 border border-border p-3 space-y-2">
              <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">บริบทก่อนรัน</div>
              {entry.campaignIds.length > 0 && (
                <div>
                  <div className="text-[10px] text-muted-foreground mb-1.5">แคมเปญที่รัน</div>
                  <div className="space-y-1.5">
                    {entry.campaignIds.map(cid => {
                      const c = campaigns.find(x => x.id === cid)
                      if (!c) return null
                      return (
                        <div key={cid} className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium">{c.name}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${statusColor(c.status)}`}>{c.status}</span>
                          {c.budgetTon != null && <span className="text-[11px] text-muted-foreground">งบ {c.budgetTon.toFixed(2)} TON</span>}
                          {c.lastBsp != null && <span className="text-[11px] text-muted-foreground">BSP {c.lastBsp.toFixed(0)}%</span>}
                          {c.lastCpm != null && <span className="text-[11px] text-muted-foreground">CPM ${c.lastCpm.toFixed(4)}</span>}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
              {entry.baseline && (
                <div>
                  <div className="text-[10px] text-muted-foreground mb-0.5">Baseline</div>
                  <p className="text-sm font-mono whitespace-pre-wrap">{entry.baseline}</p>
                </div>
              )}
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
      )}
    </div>
  )
}

function AddEntryForm({ campaigns, onSaved, onCancel }: { campaigns: CampaignGoal[]; onSaved: () => void; onCancel: () => void }) {
  const [form, setForm] = useState(() => ({
    date: today(),
    campaignIds: [] as string[],
    baseline: '',
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
          campaignIds: form.campaignIds,
          baseline: form.baseline,
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
      {/* Context section */}
      <div className="rounded-md bg-muted/50 border border-border p-3 space-y-3">
        <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">บริบทก่อนรัน</div>
        <div>
          <label className="text-[11px] text-muted-foreground">แคมเปญที่จะรัน</label>
          <div className="mt-1 border border-border rounded-md overflow-hidden divide-y divide-border bg-background">
            {campaigns.length === 0
              ? <p className="px-3 py-2 text-sm text-muted-foreground italic">ไม่มีแคมเปญที่ active</p>
              : campaigns.map(c => {
                  const checked = form.campaignIds.includes(c.id)
                  return (
                    <label key={c.id} className={`flex items-start gap-3 px-3 py-2.5 cursor-pointer transition-colors ${checked ? 'bg-primary/5' : 'hover:bg-muted/40'}`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => setForm(f => ({
                          ...f,
                          campaignIds: checked
                            ? f.campaignIds.filter(id => id !== c.id)
                            : [...f.campaignIds, c.id],
                        }))}
                        className="mt-0.5 shrink-0"
                      />
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium leading-tight">{c.name}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${statusColor(c.status)}`}>{c.status}</span>
                        </div>
                        {checked && (
                          <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-muted-foreground">
                            {c.budgetTon != null && <span>งบ {c.budgetTon.toFixed(2)} TON</span>}
                            {c.lastBsp != null && <span>BSP {c.lastBsp.toFixed(0)}%</span>}
                            {c.lastCpm != null && <span>CPM ${c.lastCpm.toFixed(4)}</span>}
                            {c.lastCps != null && <span>CPS ${c.lastCps.toFixed(4)}</span>}
                          </div>
                        )}
                      </div>
                    </label>
                  )
                })
            }
          </div>
        </div>
        <div>
          <label className="text-[11px] text-muted-foreground">Baseline (ก่อนรัน)</label>
          <textarea value={form.baseline} onChange={e => setForm(f => ({ ...f, baseline: e.target.value }))}
            placeholder={"BSP: __% · CPM: __ TON · Cost-per-start: __ TON"} rows={2}
            className="w-full mt-1 text-sm border border-border rounded-md px-3 py-2 bg-background resize-none focus:outline-none focus:ring-1 focus:ring-ring font-mono" />
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
              campaigns={campaigns}
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
                campaigns={campaigns}
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
                linkedPlanners={entries.filter(e => e.campaignIds.includes(c.id))}
                onSaved={() => router.refresh()}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
