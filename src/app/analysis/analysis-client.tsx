'use client'

import { useState } from 'react'
import { RefreshCw, Bot, ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { AnalysisResult } from '@/lib/analysis'

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

export function AnalysisClient({ initialOverview, campaigns }: Props) {
  const [overviewAnalysis, setOverviewAnalysis] = useState<StoredAnalysis | null>(initialOverview)
  const [overviewLoading, setOverviewLoading] = useState(false)
  const [overviewError, setOverviewError] = useState<string | null>(null)

  const [campaignAnalyses, setCampaignAnalyses] = useState<Record<string, StoredAnalysis>>(
    Object.fromEntries(campaigns.flatMap(c => c.latestAnalysis ? [[c.id, c.latestAnalysis]] : []))
  )
  const [campaignLoading, setCampaignLoading] = useState<Record<string, boolean>>({})
  const [campaignErrors, setCampaignErrors] = useState<Record<string, string>>({})
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  async function triggerOverview() {
    setOverviewLoading(true)
    setOverviewError(null)
    try {
      const res = await fetch('/api/analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'OVERVIEW' }),
      })
      const data = await res.json()
      if (!res.ok) {
        setOverviewError(data.error ?? 'เกิดข้อผิดพลาด')
        return
      }
      setOverviewAnalysis({ id: data.id, createdAt: data.createdAt, result: data.result, model: data.model })
    } catch {
      setOverviewError('เกิดข้อผิดพลาด กรุณาลองใหม่')
    } finally {
      setOverviewLoading(false)
    }
  }

  async function triggerCampaign(campaignId: string) {
    setCampaignLoading(p => ({ ...p, [campaignId]: true }))
    setCampaignErrors(p => ({ ...p, [campaignId]: '' }))
    try {
      const res = await fetch('/api/analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'CAMPAIGN', campaignId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setCampaignErrors(p => ({ ...p, [campaignId]: data.error ?? 'เกิดข้อผิดพลาด' }))
        return
      }
      setCampaignAnalyses(p => ({ ...p, [campaignId]: { id: data.id, createdAt: data.createdAt, result: data.result, model: data.model } }))
      setExpanded(p => new Set([...p, campaignId]))
    } catch {
      setCampaignErrors(p => ({ ...p, [campaignId]: 'เกิดข้อผิดพลาด กรุณาลองใหม่' }))
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
              onClick={triggerOverview}
              disabled={overviewLoading}
              className="gap-1.5"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${overviewLoading ? 'animate-spin' : ''}`} />
              {overviewLoading ? 'กำลังวิเคราะห์...' : 'วิเคราะห์ใหม่'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {overviewError && <p className="text-sm text-destructive">{overviewError}</p>}
          {!overviewResult && !overviewError && (
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
            const error = campaignErrors[c.id]
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
                      onClick={() => triggerCampaign(c.id)}
                      disabled={loading}
                    >
                      <Bot className={`h-3.5 w-3.5 ${loading ? 'animate-pulse' : ''}`} />
                      {loading ? '...' : analysis ? '🔄' : 'วิเคราะห์'}
                    </Button>
                  </div>
                </CardHeader>
                {isExpanded && parsedResult && (
                  <CardContent className="pt-0 px-4 pb-4">
                    <ResultDisplay result={parsedResult} />
                  </CardContent>
                )}
                {error && (
                  <CardContent className="pt-0 px-4 pb-3">
                    <p className="text-xs text-destructive">{error}</p>
                  </CardContent>
                )}
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}
