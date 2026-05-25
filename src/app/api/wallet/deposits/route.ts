import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const deposits = await prisma.walletDeposit.findMany({
      include: {
        allocations: {
          include: { campaign: { select: { id: true, name: true } } },
        },
      },
      orderBy: { depositedAt: 'desc' },
    })

    return NextResponse.json(
      deposits.map(d => ({
        id: d.id,
        amountTon: Number(d.amountTon),
        tonPriceUsd: Number(d.tonPriceUsd),
        usdThbRate: Number(d.usdThbRate),
        depositedAt: d.depositedAt.toISOString(),
        note: d.note,
        createdAt: d.createdAt.toISOString(),
        allocations: d.allocations.map(a => ({
          id: a.id,
          campaignId: a.campaignId,
          campaignName: a.campaign.name,
          amountTon: Number(a.amountTon),
          allocatedAt: a.allocatedAt.toISOString(),
        })),
      }))
    )
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const amountTon = Number(body.amountTon)
    const tonPriceUsd = Number(body.tonPriceUsd)
    const usdThbRate = Number(body.usdThbRate)

    if (isNaN(amountTon) || amountTon <= 0) {
      return NextResponse.json({ error: 'amountTon must be > 0' }, { status: 400 })
    }
    if (isNaN(tonPriceUsd) || tonPriceUsd <= 0) {
      return NextResponse.json({ error: 'tonPriceUsd must be > 0' }, { status: 400 })
    }
    if (isNaN(usdThbRate) || usdThbRate <= 0) {
      return NextResponse.json({ error: 'usdThbRate must be > 0' }, { status: 400 })
    }
    if (!body.depositedAt) {
      return NextResponse.json({ error: 'depositedAt is required' }, { status: 400 })
    }

    const deposit = await prisma.walletDeposit.create({
      data: {
        amountTon,
        tonPriceUsd,
        usdThbRate,
        depositedAt: new Date(body.depositedAt),
        note: body.note ?? null,
      },
    })

    return NextResponse.json({ id: deposit.id }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
