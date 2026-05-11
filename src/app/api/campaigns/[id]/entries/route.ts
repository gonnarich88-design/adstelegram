import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const campaign = await prisma.campaign.findUnique({ where: { id } })
    if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const entries = await prisma.performanceEntry.findMany({
      where: { campaignId: id },
      orderBy: { date: 'desc' },
    })
    return NextResponse.json(entries)
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()

    if (!body.date || body.spendTon == null || body.dailyBudgetTon == null) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const entry = await prisma.performanceEntry.create({
      data: {
        campaignId: id,
        date: new Date(body.date),
        spendTon: body.spendTon,
        dailyBudgetTon: body.dailyBudgetTon,
        tonPriceUsd: body.tonPriceUsd,
        usdThbRate: body.usdThbRate,
        impressions: Number(body.impressions),
        views: Number(body.views),
        clicks: Number(body.clicks),
        joins: Number(body.joins),
        note: body.note ?? null,
      },
    })
    return NextResponse.json(entry, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
