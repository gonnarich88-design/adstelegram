import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { logCampaignChanges, diffCampaignFields } from '@/lib/changelog'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: { entries: { orderBy: { date: 'desc' } } },
    })
    if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(campaign)
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()
    const bidCpmTon = body.bidCpmTon != null ? Number(body.bidCpmTon) : null
    if (bidCpmTon !== null && (isNaN(bidCpmTon) || bidCpmTon <= 0)) {
      return NextResponse.json({ error: 'bidCpmTon must be > 0' }, { status: 400 })
    }

    const old = await prisma.campaign.findUnique({ where: { id } })
    if (!old) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const campaign = await prisma.campaign.update({
      where: { id },
      data: {
        name: body.name,
        targetType: body.targetType,
        targetName: body.targetName,
        startDate: new Date(body.startDate),
        endDate: body.endDate ? new Date(body.endDate) : null,
        budgetTon: body.budgetTon ?? null,
        dailyBudgetTon: body.dailyBudgetTon,
        bidCpmTon: bidCpmTon,
        status: body.status,
        placementName: body.placementName ?? null,
        placementType: body.placementType ?? null,
        note: body.note ?? null,
      },
    })

    const changes = diffCampaignFields(old, {
      name: body.name,
      targetType: body.targetType,
      targetName: body.targetName,
      startDate: body.startDate,
      endDate: body.endDate ?? null,
      budgetTon: body.budgetTon ?? null,
      dailyBudgetTon: body.dailyBudgetTon,
      bidCpmTon: bidCpmTon,
      status: body.status,
      placementName: body.placementName ?? null,
      placementType: body.placementType ?? null,
    })

    const changeNote = typeof body.changeNote === 'string' && body.changeNote.trim()
      ? body.changeNote.trim()
      : null

    if (changeNote) changes.push({ field: null, note: changeNote })
    await logCampaignChanges(id, changes)

    return NextResponse.json(campaign)
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await prisma.campaign.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
