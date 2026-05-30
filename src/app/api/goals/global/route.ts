import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const putSchema = z.object({
  note: z.string().nullable().optional(),
})

export async function GET() {
  try {
    const record = await prisma.globalGoal.findUnique({ where: { id: 1 } })
    return NextResponse.json({ note: record?.note ?? null })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = putSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
    }
    const note = parsed.data.note ?? null
    const record = await prisma.globalGoal.upsert({
      where: { id: 1 },
      create: { id: 1, note },
      update: { note },
    })
    return NextResponse.json({ note: record.note })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
