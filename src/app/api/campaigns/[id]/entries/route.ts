import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

async function autoStopIfDepleted(campaignId: string) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: {
      status: true,
      allocations: { select: { amountTon: true } },
      entries: { select: { spendTon: true } },
    },
  })
  if (!campaign || campaign.status !== 'ACTIVE') return
  const totalAllocated = campaign.allocations.reduce((s, a) => s + Number(a.amountTon), 0)
  if (totalAllocated === 0) return
  const totalSpent = campaign.entries.reduce((s, e) => s + Number(e.spendTon), 0)
  if (totalSpent >= totalAllocated) {
    await prisma.campaign.update({ where: { id: campaignId }, data: { status: 'STOPPED' } })
  }
}

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

    const upsertFields = (row: typeof body) => ({
      spendTon: row.spendTon,
      dailyBudgetTon: row.dailyBudgetTon,
      tonPriceUsd: row.tonPriceUsd,
      usdThbRate: row.usdThbRate,
      impressions: Number(row.impressions),
      views: Number(row.views),
      clicks: Number(row.clicks),
      joins: Number(row.joins),
      note: row.note ?? null,
    })

    // bulk upsert
    if (Array.isArray(body)) {
      const created = await prisma.$transaction(
        body.map(row =>
          prisma.performanceEntry.upsert({
            where: { campaignId_date: { campaignId: id, date: new Date(row.date) } },
            create: { campaignId: id, date: new Date(row.date), ...upsertFields(row) },
            update: upsertFields(row),
          })
        )
      )
      await autoStopIfDepleted(id)
      return NextResponse.json(created, { status: 201 })
    }

    if (!body.date || body.spendTon == null || body.dailyBudgetTon == null) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const entry = await prisma.performanceEntry.upsert({
      where: { campaignId_date: { campaignId: id, date: new Date(body.date) } },
      create: { campaignId: id, date: new Date(body.date), ...upsertFields(body) },
      update: upsertFields(body),
    })
    await autoStopIfDepleted(id)
    return NextResponse.json(entry, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
