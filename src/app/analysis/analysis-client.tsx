'use client'

import { useState, useEffect } from 'react'
import { RefreshCw, Bot, ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog } from '@base-ui/react/dialog'
import type { AnalysisResult, OverviewContext, CampaignContext } from '@/lib/analysis'

interface StoredAnalysis {
  id: string
  createdAt: string
  result: string
  model: string
}

interface CampaignItem {
  id: string
  name: string
  status: string
  targetType: string
  latestAnalysis: StoredAnalysis | null
}

interface Props {
  initialOverview: StoredAnalysis | null
  campaigns: CampaignItem[]
}

function formatThaiDate(iso: string) {
  return new Intl.DateTimeFormat('th-TH', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Bangkok',
  }).format(new Date(iso))
}

function ResultDisplay({ result }: { result: AnalysisResult }) {
  return (
    <div className="space-y-3 mt-3">
      <p className="text-sm">{result.status}</p>
      {[
        { label: 'ทำเลย', items: result.immediate },
        { label: 'อาทิตย์นี้', items: result.weekly },
        { label: 'เดือนนี้', items: result.monthly },
      ].filter(s => s.items.length > 0).map(s => (
        <div key={s.label}>
          <p className="text-xs font-medium text-muted-foreground mb-1">{s.label}</p>
          <ul className="space-y-1">
            {s.items.map((item, i) => (
              <li key={i} className="text-sm flex gap-2">
                <span className="text-muted-foreground">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
      {result.assumptions.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">สมมติฐาน</p>
          <ul className="space-y-1">
            {result.assumptions.map((item, i) => (
              <li key={i} className="text-xs text-muted-foreground flex gap-2">
                <span>•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function AnalysisDialog({
  open,
  onOpenChange,
  target,
  campaigns,
  loading,
  error,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  target: 'overview' | string
  campaigns: CampaignItem[]
  loading: boolean
  error: string | null
  onSubmit: (ctx: { problems: string[]; question: string; budgetDepletionTime: string; bidInfo: string }) => void
}) {
  const [problems, setProblems] = useState<string[]>([])
  const [budgetDepletionTime, setBudgetDepletionTime] = useState('')
  const [bidInfo, setBidInfo] = useState('')
  const [question, setQuestion] = useState('')

  useEffect(() => {
    if (open) {
      setProblems([])
      setBudgetDepletionTime('')
      setBidInfo('')
      setQuestion('')
    }
  }, [open, target])

  const isOverview = target === 'overview'
  const options = isOverview
    ? ['งบไม่เต็ม', 'CTR ต่ำ', 'Joins น้อย', 'CPS สูง']
    : ['งบไม่เต็ม', 'งบหมดเร็ว', 'CTR ต่ำ', 'Joins น้อย', 'CPS สูง']
  const campaignName = isOverview ? null : campaigns.find(c => c.id === target)?.name

  function toggleProblem(p: string) {
    setProblems(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 bg-black/50 z-40" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-background border rounded-lg shadow-lg p-6 w-full max-w-md">
          <Dialog.Title className="text-base font-semibold mb-4">
            {isOverview ? 'วิเคราะห์ภาพรวม' : `วิเคราะห์: ${campaignName}`}
          </Dialog.Title>

          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium mb-2">ปัญหาที่เจออยู่</p>
              <div className="flex flex-wrap gap-2">
                {options.map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => toggleProblem(p)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                      problems.includes(p)
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'border-border hover:bg-muted'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {!isOverview && (
              <>
                <div>
                  <label className="text-sm font-medium block mb-1">งบหมดประมาณกี่โมง</label>
                  <Input
                    placeholder="เช่น 10:00"
                    value={budgetDepletionTime}
                    onChange={e => setBudgetDepletionTime(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1">Bid / Floor bid</label>
                  <Input
                    placeholder="เช่น bid 0.5, floor 0.3 TON"
                    value={bidInfo}
                    onChange={e => setBidInfo(e.target.value)}
                  />
                </div>
              </>
            )}

            <div>
              <label className="text-sm font-medium block mb-1">โจทย์เพิ่มเติม</label>
              <Textarea
                placeholder="เช่น ควรปรับ campaign ไหนก่อน?"
                value={question}
                onChange={e => setQuestion(e.target.value)}
                rows={3}
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <Dialog.Close render={<Button variant="outline">ยกเลิก</Button>} />
            <Button
              onClick={() => onSubmit({ problems, question, budgetDepletionTime, bidInfo })}
              disabled={loading}
            >
              {loading ? 'กำลังวิเคราะห์...' : 'เริ่มวิเคราะห์'}
            </Button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export function AnalysisClient({ initialOverview, campaigns }: Props) {
  const [overviewAnalysis, setOverviewAnalysis] = useState<StoredAnalysis | null>(initialOverview)
  const [overviewLoading, setOverviewLoading] = useState(false)

  const [campaignAnalyses, setCampaignAnalyses] = useState<Record<string, StoredAnalysis>>(
    Object.fromEntries(campaigns.flatMap(c => c.latestAnalysis ? [[c.id, c.latestAnalysis]] : []))
  )
  const [campaignLoading, setCampaignLoading] = useState<Record<string, boolean>>({})
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogTarget, setDialogTarget] = useState<'overview' | string>('overview')
  const [dialogError, setDialogError] = useState<string | null>(null)

  function openDialog(target: 'overview' | string) {
    setDialogTarget(target)
    setDialogError(null)
    setDialogOpen(true)
  }

  async function triggerOverview(ctx: OverviewContext) {
    setOverviewLoading(true)
    setDialogError(null)
    try {
      const res = await fetch('/api/analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'OVERVIEW', context: ctx }),
      })
      const data = await res.json()
      if (!res.ok) {
        setDialogError(data.error ?? 'เกิดข้อผิดพลาด')
        return
      }
      setOverviewAnalysis({ id: data.id, createdAt: data.createdAt, result: data.result, model: data.model })
      setDialogOpen(false)
    } catch {
      setDialogError('เกิดข้อผิดพลาด กรุณาลองใหม่')
    } finally {
      setOverviewLoading(false)
    }
  }

  async function triggerCampaign(campaignId: string, ctx: CampaignContext) {
    setCampaignLoading(p => ({ ...p, [campaignId]: true }))
    setDialogError(null)
    try {
      const res = await fetch('/api/analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'CAMPAIGN', campaignId, context: ctx }),
      })
      const data = await res.json()
      if (!res.ok) {
        setDialogError(data.error ?? 'เกิดข้อผิดพลาด')
        return
      }
      setCampaignAnalyses(p => ({ ...p, [campaignId]: { id: data.id, createdAt: data.createdAt, result: data.result, model: data.model } }))
      setExpanded(p => new Set([...p, campaignId]))
      setDialogOpen(false)
    } catch {
      setDialogError('เกิดข้อผิดพลาด กรุณาลองใหม่')
    } finally {
      setCampaignLoading(p => ({ ...p, [campaignId]: false }))
    }
  }

  function toggleExpand(campaignId: string) {
    setExpanded(p => {
      const next = new Set(p)
      if (next.has(campaignId)) next.delete(campaignId)
      else next.add(campaignId)
      return next
    })
  }

  let overviewResult: AnalysisResult | null = null
  if (overviewAnalysis) {
    try { overviewResult = JSON.parse(overviewAnalysis.result) as AnalysisResult } catch { /* malformed stored result */ }
  }

  return (
    <>
      <AnalysisDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        target={dialogTarget}
        campaigns={campaigns}
        loading={dialogTarget === 'overview' ? overviewLoading : (campaignLoading[dialogTarget] ?? false)}
        error={dialogError}
        onSubmit={ctx => {
          if (dialogTarget === 'overview') {
            triggerOverview({ problems: ctx.problems, question: ctx.question })
          } else {
            triggerCampaign(dialogTarget, {
              problems: ctx.problems,
              budgetDepletionTime: ctx.budgetDepletionTime,
              bidInfo: ctx.bidInfo,
              question: ctx.question,
            })
          }
        }}
      />
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Overview Section */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">ภาพรวมทุกแคมเปญ</CardTitle>
            <div className="flex items-center gap-3">
              {overviewAnalysis && (
                <span className="text-xs text-muted-foreground">
                  วิเคราะห์ล่าสุด: {formatThaiDate(overviewAnalysis.createdAt)}
                </span>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() => openDialog('overview')}
                className="gap-1.5"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                วิเคราะห์ใหม่
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {!overviewResult && (
              <p className="text-sm text-muted-foreground">ยังไม่มีการวิเคราะห์ กดปุ่มเพื่อเริ่ม</p>
            )}
            {overviewResult && <ResultDisplay result={overviewResult} />}
            {overviewResult?.perCampaign && overviewResult.perCampaign.length > 0 && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-xs font-medium text-muted-foreground mb-2">สรุปรายแคมเปญ</p>
                <div className="space-y-1.5">
                  {overviewResult.perCampaign.map(p => (
                    <div key={p.campaignId} className="flex items-start gap-2 text-sm">
                      <span className={`shrink-0 text-xs px-1.5 py-0.5 rounded font-medium ${
                        p.status === 'ดีมาก' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' :
                        p.status === 'ต้องระวัง' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' :
                        p.status === 'วิกฤต' ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' :
                        'bg-muted text-muted-foreground'
                      }`}>{p.status}</span>
                      <span className="font-medium">{p.name}</span>
                      <span className="text-muted-foreground">{p.highlight}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Per-Campaign Section */}
        <div>
          <h2 className="text-sm font-semibold mb-3">วิเคราะห์รายแคมเปญ</h2>
          <div className="space-y-2">
            {campaigns.map(c => {
              const analysis = campaignAnalyses[c.id]
              const loading = campaignLoading[c.id] ?? false
              const isExpanded = expanded.has(c.id)
              let parsedResult: AnalysisResult | null = null
              if (analysis) {
                try { parsedResult = JSON.parse(analysis.result) as AnalysisResult } catch { /* malformed stored result */ }
              }

              return (
                <Card key={c.id}>
                  <CardHeader className="flex flex-row items-center justify-between py-3 px-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{c.name}</span>
                      <span className="text-xs text-muted-foreground">[{c.status}]</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {analysis && (
                        <span className="text-xs text-muted-foreground">
                          {formatThaiDate(analysis.createdAt)}
                        </span>
                      )}
                      {analysis && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 gap-1"
                          onClick={() => toggleExpand(c.id)}
                        >
                          {isExpanded
                            ? <ChevronDown className="h-3.5 w-3.5" />
                            : <ChevronRight className="h-3.5 w-3.5" />}
                          ดูผล
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 gap-1"
                        onClick={() => openDialog(c.id)}
                      >
                        <Bot className={`h-3.5 w-3.5 ${loading ? 'animate-pulse' : ''}`} />
                        {analysis ? '🔄' : 'วิเคราะห์'}
                      </Button>
                    </div>
                  </CardHeader>
                  {isExpanded && parsedResult && (
                    <CardContent className="pt-0 px-4 pb-4">
                      <ResultDisplay result={parsedResult} />
                    </CardContent>
                  )}
                </Card>
              )
            })}
          </div>
        </div>
      </div>
    </>
  )
}
