import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()
    const { amountTon, tonPriceUsd, usdThbRate, depositedAt, note } = body

    if (!amountTon || amountTon <= 0 || !tonPriceUsd || tonPriceUsd <= 0 || !usdThbRate || usdThbRate <= 0 || !depositedAt) {
      return NextResponse.json({ error: 'Invalid values' }, { status: 400 })
    }

    const deposit = await prisma.walletDeposit.findUnique({
      where: { id },
      include: { allocations: true },
    })

    if (!deposit) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (deposit.type === 'REFUND') return NextResponse.json({ error: 'Cannot edit refund deposit' }, { status: 409 })

    const totalAllocated = deposit.allocations.reduce((s, a) => s + Number(a.amountTon), 0)
    if (amountTon < totalAllocated) {
      return NextResponse.json({
        error: 'AMOUNT_TOO_LOW',
        detail: `ต้องมากกว่าหรือเท่ากับยอดที่จัดสรรแล้ว (${totalAllocated.toFixed(4)} TON)`,
      }, { status: 422 })
    }

    await prisma.walletDeposit.update({
      where: { id },
      data: {
        amountTon,
        tonPriceUsd,
        usdThbRate,
        depositedAt: new Date(depositedAt),
        note: note ?? null,
      },
    })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const deposit = await prisma.walletDeposit.findUnique({
      where: { id },
      include: { allocations: true },
    })

    if (!deposit) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    if (deposit.type === 'REFUND') {
      return NextResponse.json({ error: 'Cannot delete refund deposit' }, { status: 409 })
    }

    if (deposit.allocations.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete deposit with existing allocations' },
        { status: 409 }
      )
    }

    await prisma.walletDeposit.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
