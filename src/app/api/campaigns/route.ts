import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const campaigns = await prisma.campaign.findMany({
      include: { entries: { orderBy: { date: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(campaigns)
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    if (!body.name || !body.targetType || !body.targetName || !body.startDate || !body.budgetTon) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
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
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
