import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()

    const amountTon = Number(body.amountTon)
    const tonPriceUsd = Number(body.tonPriceUsd)
    const usdThbRate = Number(body.usdThbRate)

    if (isNaN(amountTon) || amountTon <= 0)
      return NextResponse.json({ error: 'amountTon must be > 0' }, { status: 400 })
    if (isNaN(tonPriceUsd) || tonPriceUsd <= 0)
      return NextResponse.json({ error: 'tonPriceUsd must be > 0' }, { status: 400 })
    if (isNaN(usdThbRate) || usdThbRate <= 0)
      return NextResponse.json({ error: 'usdThbRate must be > 0' }, { status: 400 })
    if (!body.refundedAt)
      return NextResponse.json({ error: 'refundedAt is required' }, { status: 400 })

    const campaign = await prisma.campaign.findUnique({ where: { id } })
    if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    if (campaign.status === 'CANCELLED')
      return NextResponse.json({ error: 'Campaign already cancelled' }, { status: 409 })

    const [deposit, updatedCampaign] = await prisma.$transaction([
      prisma.walletDeposit.create({
        data: {
          type: 'REFUND',
          refundCampaignId: id,
          amountTon,
          tonPriceUsd,
          usdThbRate,
          depositedAt: new Date(body.refundedAt),
          note: body.note ?? null,
        },
      }),
      prisma.campaign.update({
        where: { id },
        data: {
          status:
            campaign.status === 'ACTIVE' || campaign.status === 'PAUSED'
              ? 'CANCELLED'
              : campaign.status,
        },
      }),
    ])

    return NextResponse.json({ deposit: { id: deposit.id }, campaign: { id: updatedCampaign.id, status: updatedCampaign.status } }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
