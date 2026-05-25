import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

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
