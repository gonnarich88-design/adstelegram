import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { buildOverviewPrompt, buildCampaignPrompt, parseAnalysisResult } from '@/lib/analysis'
import type { CampaignSummary, EntryRow, OverviewContext, CampaignContext } from '@/lib/analysis'

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'ยังไม่ได้ตั้งค่า API key' }, { status: 500 })
  }

  let body: { type: string; campaignId?: string; context?: OverviewContext | CampaignContext }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { type, campaignId } = body
  if (type !== 'OVERVIEW' && type !== 'CAMPAIGN') {
    return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
  }
  if (type === 'CAMPAIGN' && !campaignId) {
    return NextResponse.json({ error: 'campaignId required for CAMPAIGN type' }, { status: 400 })
  }

  // Thai timezone date string e.g. "2026-06-04"
  const bangkokOffset = 7 * 60 * 60 * 1000
  const today = new Date(Date.now() + bangkokOffset).toISOString().split('T')[0]

  let prompt: { system: string; user: string }

  if (type === 'OVERVIEW') {
    const [globalGoal, campaigns] = await Promise.all([
      prisma.globalGoal.findUnique({ where: { id: 1 } }),
      prisma.campaign.findMany({
        where: { status: { notIn: ['CANCELLED'] } },
        include: {
          entries: { orderBy: { date: 'asc' } },
          allocations: true,
        },
      }),
    ])

    const summaries: CampaignSummary[] = campaigns.map(c => {
      const totalSpent = c.entries.reduce((s, e) => s + Number(e.spendTon), 0)
      const totalJoins = c.entries.reduce((s, e) => s + e.joins, 0)
      const totalSpentUsd = c.entries.reduce((s, e) => s + Number(e.spendTon) * Number(e.tonPriceUsd), 0)
      const totalViews = c.entries.reduce((s, e) => s + e.views, 0)
      const totalClicks = c.entries.reduce((s, e) => s + e.clicks, 0)
      const totalAllocated = c.allocations.reduce((s, a) => s + Number(a.amountTon), 0)
      return {
        id: c.id,
        name: c.name,
        status: c.status,
        targetType: c.targetType,
        dailyBudgetTon: Number(c.dailyBudgetTon),
        totalAllocated,
        totalSpent,
        budgetUsedPct: totalAllocated > 0 ? (totalSpent / totalAllocated) * 100 : 0,
        totalJoins,
        avgCPS: totalJoins > 0 ? totalSpentUsd / totalJoins : 0,
        ctr: totalViews > 0 ? (totalClicks / totalViews) * 100 : 0,
        goalText: c.goalText ?? null,
        planText: c.planText ?? null,
        targetJoins: c.targetJoins ?? null,
        targetDate: c.targetDate?.toISOString().split('T')[0] ?? null,
      }
    })

    prompt = buildOverviewPrompt(summaries, globalGoal?.note ?? null, today, body.context as OverviewContext | undefined)
  } else {
    const [globalGoal, campaign] = await Promise.all([
      prisma.globalGoal.findUnique({ where: { id: 1 } }),
      prisma.campaign.findUnique({
        where: { id: campaignId },
        include: {
          entries: { orderBy: { date: 'asc' } },
          allocations: true,
        },
      }),
    ])

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    const totalSpent = campaign.entries.reduce((s, e) => s + Number(e.spendTon), 0)
    const totalJoins = campaign.entries.reduce((s, e) => s + e.joins, 0)
    const totalSpentUsd = campaign.entries.reduce((s, e) => s + Number(e.spendTon) * Number(e.tonPriceUsd), 0)
    const totalViews = campaign.entries.reduce((s, e) => s + e.views, 0)
    const totalClicks = campaign.entries.reduce((s, e) => s + e.clicks, 0)
    const totalAllocated = campaign.allocations.reduce((s, a) => s + Number(a.amountTon), 0)

    const summary: CampaignSummary = {
      id: campaign.id,
      name: campaign.name,
      status: campaign.status,
      targetType: campaign.targetType,
      dailyBudgetTon: Number(campaign.dailyBudgetTon),
      totalAllocated,
      totalSpent,
      budgetUsedPct: totalAllocated > 0 ? (totalSpent / totalAllocated) * 100 : 0,
      totalJoins,
      avgCPS: totalJoins > 0 ? totalSpentUsd / totalJoins : 0,
      ctr: totalViews > 0 ? (totalClicks / totalViews) * 100 : 0,
      goalText: campaign.goalText ?? null,
      planText: campaign.planText ?? null,
      targetJoins: campaign.targetJoins ?? null,
      targetDate: campaign.targetDate?.toISOString().split('T')[0] ?? null,
    }

    const entryRows: EntryRow[] = campaign.entries.map(e => ({
      date: e.date.toISOString().split('T')[0],
      spendTon: Number(e.spendTon),
      views: e.views,
      clicks: e.clicks,
      joins: e.joins,
    }))

    prompt = buildCampaignPrompt(summary, entryRows, globalGoal?.note ?? null, today, body.context as CampaignContext | undefined)
  }

  let aiResponse: Response
  try {
    aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: prompt.system },
          { role: 'user', content: prompt.user },
        ],
      }),
      cache: 'no-store',
    })
  } catch {
    return NextResponse.json({ error: 'วิเคราะห์ไม่สำเร็จ ลองใหม่อีกครั้ง' }, { status: 502 })
  }

  if (aiResponse.status === 429) {
    return NextResponse.json({ error: 'กรุณารอสักครู่แล้วลองใหม่' }, { status: 429 })
  }
  if (!aiResponse.ok) {
    return NextResponse.json({ error: 'วิเคราะห์ไม่สำเร็จ ลองใหม่อีกครั้ง' }, { status: 502 })
  }

  const aiData = await aiResponse.json()
  const content: string = aiData.choices?.[0]?.message?.content ?? ''

  let result
  try {
    result = parseAnalysisResult(content)
  } catch {
    return NextResponse.json({ error: 'วิเคราะห์ไม่สำเร็จ — ผลลัพธ์ไม่ถูกต้อง' }, { status: 500 })
  }

  const analysis = await prisma.aiAnalysis.create({
    data: {
      type: type as 'OVERVIEW' | 'CAMPAIGN',
      campaignId: campaignId ?? null,
      result: JSON.stringify(result),
      model: 'gpt-4o',
    },
  })

  return NextResponse.json({ ...analysis, parsedResult: result }, { status: 201 })
}
