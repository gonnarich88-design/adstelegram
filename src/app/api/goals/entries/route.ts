import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const entries = await prisma.globalGoalEntry.findMany({
    orderBy: { date: 'desc' },
    include: { campaigns: true },
  })

  return NextResponse.json(entries.map(e => ({
    id: e.id,
    date: e.date.toISOString(),
    baseline: e.baseline,
    goalText: e.goalText,
    successCriteria: e.successCriteria,
    constraints: e.constraints,
    planText: e.planText,
    risks: e.risks,
    doneCriteria: e.doneCriteria,
    targetText: e.targetText,
    deadline: e.deadline?.toISOString() ?? null,
    campaignIds: e.campaigns.map(c => c.campaignId),
    createdAt: e.createdAt.toISOString(),
  })))
}

export async function POST(req: Request) {
  const body = await req.json()
  const { date, baseline, goalText, successCriteria, constraints, planText, risks, doneCriteria, targetText, deadline, campaignIds } = body

  if (!date) return NextResponse.json({ error: 'date required' }, { status: 400 })

  const entry = await prisma.globalGoalEntry.create({
    data: {
      date: new Date(date),
      baseline: baseline?.trim() || null,
      goalText: goalText?.trim() || null,
      successCriteria: successCriteria?.trim() || null,
      constraints: constraints?.trim() || null,
      planText: planText?.trim() || null,
      risks: risks?.trim() || null,
      doneCriteria: doneCriteria?.trim() || null,
      targetText: targetText?.trim() || null,
      deadline: deadline ? new Date(deadline) : null,
      campaigns: Array.isArray(campaignIds) && campaignIds.length > 0
        ? { create: campaignIds.map((id: string) => ({ campaignId: id })) }
        : undefined,
    },
    include: { campaigns: true },
  })

  return NextResponse.json({
    id: entry.id,
    date: entry.date.toISOString(),
    baseline: entry.baseline,
    goalText: entry.goalText,
    successCriteria: entry.successCriteria,
    constraints: entry.constraints,
    planText: entry.planText,
    risks: entry.risks,
    doneCriteria: entry.doneCriteria,
    targetText: entry.targetText,
    deadline: entry.deadline?.toISOString() ?? null,
    campaignIds: entry.campaigns.map(c => c.campaignId),
    createdAt: entry.createdAt.toISOString(),
  }, { status: 201 })
}
