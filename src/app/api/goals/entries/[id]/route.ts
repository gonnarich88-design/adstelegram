import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const { date, goalText, planText, targetText, deadline } = body

  const entry = await prisma.globalGoalEntry.update({
    where: { id },
    data: {
      ...(date ? { date: new Date(date) } : {}),
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
  })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await prisma.globalGoalEntry.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
