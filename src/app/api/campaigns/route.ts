import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const campaigns = await prisma.campaign.findMany({
    include: {
      entries: {
        orderBy: { date: 'asc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(campaigns)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const campaign = await prisma.campaign.create({
    data: {
      name: body.name,
      targetType: body.targetType,
      targetName: body.targetName,
      startDate: new Date(body.startDate),
      endDate: body.endDate ? new Date(body.endDate) : null,
      budgetTon: body.budgetTon,
      status: body.status ?? 'ACTIVE',
      note: body.note ?? null,
    },
  })
  return NextResponse.json(campaign, { status: 201 })
}
