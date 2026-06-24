import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const placements = await prisma.placement.findMany({
    include: {
      campaigns: {
        include: {
          campaign: { select: { id: true, name: true, status: true } },
        },
      },
    },
    orderBy: { name: 'asc' },
  })
  return NextResponse.json(placements)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const name = body.name?.trim()
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })

  const placement = await prisma.placement.upsert({
    where: { name },
    create: { name, type: body.type ?? null, note: body.note ?? null },
    update: {},
    include: { campaigns: true },
  })
  return NextResponse.json(placement, { status: 201 })
}
