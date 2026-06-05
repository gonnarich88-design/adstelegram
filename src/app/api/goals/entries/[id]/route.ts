import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const { date, baseline, goalText, successCriteria, constraints, planText, risks, doneCriteria, targetText, deadline, campaignIds } = body

  const entry = await prisma.$transaction(async tx => {
    if (Array.isArray(campaignIds)) {
      await tx.globalGoalEntryCampaign.deleteMany({ where: { entryId: id } })
    }
    return tx.globalGoalEntry.update({
      where: { id },
      data: {
        ...(date ? { date: new Date(date) } : {}),
        baseline: baseline?.trim() || null,
        goalText: goalText?.trim() || null,
        successCriteria: successCriteria?.trim() || null,
        constraints: constraints?.trim() || null,
        planText: planText?.trim() || null,
        risks: risks?.trim() || null,
        doneCriteria: doneCriteria?.trim() || null,
        targetText: targetText?.trim() || null,
        deadline: deadline ? new Date(deadline) : null,
        ...(Array.isArray(campaignIds) && campaignIds.length > 0
          ? { campaigns: { create: campaignIds.map((cid: string) => ({ campaignId: cid })) } }
          : {}),
      },
      include: { campaigns: true },
    })
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
  })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await prisma.globalGoalEntry.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
