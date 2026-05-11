import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const entries = await prisma.performanceEntry.findMany({
    where: { campaignId: id },
    orderBy: { date: 'desc' },
  })
  return NextResponse.json(entries)
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await req.json()

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
}
