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
    planText: e.planText,
    targetText: e.targetText,
    deadline: e.deadline?.toISOString() ?? null,
    createdAt: e.createdAt.toISOString(),
  })))
}

export async function POST(req: Request) {
  const body = await req.json()
  const { date, goalText, planText, targetText, deadline } = body

  if (!date) return NextResponse.json({ error: 'date required' }, { status: 400 })

  const entry = await prisma.globalGoalEntry.create({
    data: {
      date: new Date(date),
      goalText: goalText?.trim() || null,
      planText: planText?.trim() || null,
      targetText: targetText?.trim() || null,
      deadline: deadline ? new Date(deadline) : null,
    },
  })

  return NextResponse.json({
    id: entry.id,
    date: entry.date.toISOString(),
    goalText: entry.goalText,
    planText: entry.planText,
    targetText: entry.targetText,
    deadline: entry.deadline?.toISOString() ?? null,
    createdAt: entry.createdAt.toISOString(),
  }, { status: 201 })
}
