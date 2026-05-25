import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const allocation = await prisma.campaignAllocation.findUnique({
      where: { campaignId: id },
      include: { deposit: true },
    })

    if (!allocation) return NextResponse.json(null)

    return NextResponse.json({
      id: allocation.id,
      amountTon: Number(allocation.amountTon),
      depositId: allocation.depositId,
      allocatedAt: allocation.allocatedAt.toISOString(),
      tonPriceUsd: Number(allocation.deposit.tonPriceUsd),
      usdThbRate: Number(allocation.deposit.usdThbRate),
      depositedAt: allocation.deposit.depositedAt.toISOString(),
    })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: campaignId } = await params
    const body = await req.json()
    const amountTon = Number(body.amountTon)
    const depositId: string | undefined = body.depositId
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

    const existing = await prisma.campaignAllocation.findUnique({
      where: { campaignId },
      include: { deposit: { include: { allocations: true } } },
    })

    if (existing) {
      const depositTotal = Number(existing.deposit.amountTon)
      const depositAllocated = existing.deposit.allocations.reduce(
        (s, a) => s + Number(a.amountTon),
        0
      )
      const depositRemaining = depositTotal - depositAllocated
      const currentAmount = Number(existing.amountTon)
      const maxAllowed = depositRemaining + currentAmount

      if (amountTon > maxAllowed) {
        return NextResponse.json({ error: 'INSUFFICIENT_BALANCE' }, { status: 400 })
      }

      await prisma.campaignAllocation.update({
        where: { campaignId },
        data: { amountTon, ...(allocatedAt ? { allocatedAt } : {}) },
      })
      return NextResponse.json({ ok: true })
    }

    if (depositId) {
      const deposit = await prisma.walletDeposit.findUnique({
        where: { id: depositId },
        include: { allocations: true },
      })
      if (!deposit) {
        return NextResponse.json({ error: 'Deposit not found' }, { status: 404 })
      }
      const allocated = deposit.allocations.reduce((s, a) => s + Number(a.amountTon), 0)
      const remaining = Number(deposit.amountTon) - allocated
      if (remaining < amountTon) {
        return NextResponse.json({ error: 'INSUFFICIENT_BALANCE' }, { status: 400 })
      }
      await prisma.campaignAllocation.create({
        data: { depositId, campaignId, amountTon, ...(allocatedAt ? { allocatedAt } : {}) },
      })
      return NextResponse.json({ ok: true }, { status: 201 })
    }

    // FIFO fallback
    const deposits = await prisma.walletDeposit.findMany({
      include: { allocations: true },
      orderBy: { depositedAt: 'asc' },
    })

    const targetDeposit = deposits.find(d => {
      const allocated = d.allocations.reduce((s, a) => s + Number(a.amountTon), 0)
      return Number(d.amountTon) - allocated >= amountTon
    })

    if (!targetDeposit) {
      return NextResponse.json({ error: 'INSUFFICIENT_BALANCE' }, { status: 400 })
    }

    await prisma.campaignAllocation.create({
      data: {
        depositId: targetDeposit.id,
        campaignId,
        amountTon,
        ...(allocatedAt ? { allocatedAt } : {}),
      },
    })

    return NextResponse.json({ ok: true }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: campaignId } = await params
    const existing = await prisma.campaignAllocation.findUnique({
      where: { campaignId },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    await prisma.campaignAllocation.delete({ where: { campaignId } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
