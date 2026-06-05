import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const { date, campaignScope, baseline, goalText, successCriteria, constraints, planText, risks, doneCriteria, targetText, deadline } = body

  const entry = await prisma.globalGoalEntry.update({
    where: { id },
    data: {
      ...(date ? { date: new Date(date) } : {}),
      campaignScope: campaignScope?.trim() || null,
      baseline: baseline?.trim() || null,
      goalText: goalText?.trim() || null,
      successCriteria: successCriteria?.trim() || null,
      constraints: constraints?.trim() || null,
      planText: planText?.trim() || null,
      risks: risks?.trim() || null,
      doneCriteria: doneCriteria?.trim() || null,
      targetText: targetText?.trim() || null,
      deadline: deadline ? new Date(deadline) : null,
    },
  })

  return NextResponse.json({
    id: entry.id,
    date: entry.date.toISOString(),
    campaignScope: entry.campaignScope,
    baseline: entry.baseline,
    goalText: entry.goalText,
    successCriteria: entry.successCriteria,
    constraints: entry.constraints,
    planText: entry.planText,
    risks: entry.risks,
    doneCriteria: entry.doneCriteria,
    targetText: entry.targetText,
    deadline: entry.deadline?.toISOString() ?? null,
    createdAt: entry.createdAt.toISOString(),
  })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await prisma.globalGoalEntry.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
