import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const existing = await prisma.campaignAllocation.findUnique({
      where: { id },
      include: { deposit: { include: { allocations: true } } },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const body = await req.json()
    const amountTon = Number(body.amountTon)
    let allocatedAt: Date | undefined
    if (body.allocatedAt) {
      const d = new Date(body.allocatedAt)
      if (isNaN(d.getTime())) {
        return NextResponse.json({ error: 'allocatedAt must be a valid ISO date' }, { status: 400 })
      }
      allocatedAt = d
    }

    if (isNaN(amountTon) || amountTon <= 0) {
      return NextResponse.json({ error: 'amountTon must be > 0' }, { status: 400 })
    }

    const depositTotal = Number(existing.deposit.amountTon)
    const depositAllocated = existing.deposit.allocations.reduce((s, a) => s + Number(a.amountTon), 0)
    const depositRemaining = depositTotal - depositAllocated
    const currentAmount = Number(existing.amountTon)
    const maxAllowed = depositRemaining + currentAmount

    if (amountTon > maxAllowed) {
      return NextResponse.json({ error: 'INSUFFICIENT_BALANCE' }, { status: 400 })
    }

    await prisma.campaignAllocation.update({
      where: { id },
      data: { amountTon, ...(allocatedAt ? { allocatedAt } : {}) },
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
    const existing = await prisma.campaignAllocation.findUnique({ where: { id } })

    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    await prisma.campaignAllocation.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
