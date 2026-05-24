import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

async function getOwned(entryId: string, campaignId: string) {
  const entry = await prisma.performanceEntry.findUnique({ where: { id: entryId } })
  if (!entry || entry.campaignId !== campaignId) return null
  return entry
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; entryId: string }> }
) {
  try {
    const { id, entryId } = await params
    const existing = await getOwned(entryId, id)
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const body = await req.json()
    if (
      !body.date ||
      body.spendTon == null ||
      body.dailyBudgetTon == null ||
      body.tonPriceUsd == null ||
      body.usdThbRate == null ||
      body.views == null ||
      body.clicks == null ||
      body.joins == null
    ) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const updated = await prisma.performanceEntry.update({
      where: { id: entryId },
      data: {
        date: new Date(body.date),
        spendTon: body.spendTon,
        dailyBudgetTon: body.dailyBudgetTon,
        tonPriceUsd: body.tonPriceUsd,
        usdThbRate: body.usdThbRate,
        impressions: Number(body.impressions ?? 0),
        views: Number(body.views),
        clicks: Number(body.clicks),
        joins: Number(body.joins),
        note: body.note ?? null,
      },
    })
    return NextResponse.json(updated)
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; entryId: string }> }
) {
  try {
    const { id, entryId } = await params
    const existing = await getOwned(entryId, id)
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await prisma.performanceEntry.delete({ where: { id: entryId } })
    return new NextResponse(null, { status: 204 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
