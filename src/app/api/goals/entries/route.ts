import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const entries = await prisma.globalGoalEntry.findMany({
    orderBy: { date: 'desc' },
  })

  return NextResponse.json(entries.map(e => ({
    id: e.id,
    date: e.date.toISOString(),
    goalText: e.goalText,
    successCriteria: e.successCriteria,
    constraints: e.constraints,
    planText: e.planText,
    risks: e.risks,
    doneCriteria: e.doneCriteria,
    targetText: e.targetText,
    deadline: e.deadline?.toISOString() ?? null,
    createdAt: e.createdAt.toISOString(),
  })))
}

export async function POST(req: Request) {
  const body = await req.json()
  const { date, goalText, successCriteria, constraints, planText, risks, doneCriteria, targetText, deadline } = body

  if (!date) return NextResponse.json({ error: 'date required' }, { status: 400 })

  const entry = await prisma.globalGoalEntry.create({
    data: {
      date: new Date(date),
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
    goalText: entry.goalText,
    successCriteria: entry.successCriteria,
    constraints: entry.constraints,
    planText: entry.planText,
    risks: entry.risks,
    doneCriteria: entry.doneCriteria,
    targetText: entry.targetText,
    deadline: entry.deadline?.toISOString() ?? null,
    createdAt: entry.createdAt.toISOString(),
  }, { status: 201 })
}
