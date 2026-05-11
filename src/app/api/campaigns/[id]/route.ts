import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: { entries: { orderBy: { date: 'desc' } } },
  })
  if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(campaign)
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await req.json()
  const campaign = await prisma.campaign.update({
    where: { id },
    data: {
      name: body.name,
      targetType: body.targetType,
      targetName: body.targetName,
      startDate: new Date(body.startDate),
      endDate: body.endDate ? new Date(body.endDate) : null,
      budgetTon: body.budgetTon,
      status: body.status,
      note: body.note ?? null,
    },
  })
  return NextResponse.json(campaign)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  await prisma.campaign.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
