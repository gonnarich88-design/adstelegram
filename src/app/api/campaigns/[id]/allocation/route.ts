import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const allocations = await prisma.campaignAllocation.findMany({
      where: { campaignId: id },
      include: { deposit: true },
      orderBy: { allocatedAt: 'asc' },
    })

    if (allocations.length === 0) return NextResponse.json(null)

    return NextResponse.json(
      allocations.map(a => ({
        id: a.id,
        amountTon: Number(a.amountTon),
        depositId: a.depositId,
        allocatedAt: a.allocatedAt.toISOString(),
        tonPriceUsd: Number(a.deposit.tonPriceUsd),
        usdThbRate: Number(a.deposit.usdThbRate),
        depositedAt: a.deposit.depositedAt.toISOString(),
      }))
    )
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
      await prisma.campaign.updateMany({
        where: { id: campaignId, status: 'STOPPED' },
        data: { status: 'ACTIVE' },
      })
      return NextResponse.json({ ok: true }, { status: 201 })
    }

    // FIFO: drain oldest deposits first, split across deposits if needed
    const deposits = await prisma.walletDeposit.findMany({
      include: { allocations: true },
      orderBy: { depositedAt: 'asc' },
    })

    const totalAvailable = deposits.reduce((sum, d) => {
      const allocated = d.allocations.reduce((s, a) => s + Number(a.amountTon), 0)
      return sum + Number(d.amountTon) - allocated
    }, 0)

    if (totalAvailable < amountTon) {
      return NextResponse.json({ error: 'INSUFFICIENT_BALANCE' }, { status: 400 })
    }

    const records: { depositId: string; campaignId: string; amountTon: number; allocatedAt?: Date }[] = []
    let remaining = amountTon
    for (const d of deposits) {
      if (remaining <= 0) break
      const allocated = d.allocations.reduce((s, a) => s + Number(a.amountTon), 0)
      const depositRemaining = Number(d.amountTon) - allocated
      if (depositRemaining <= 0) continue
      const use = Math.min(remaining, depositRemaining)
      records.push({ depositId: d.id, campaignId, amountTon: use, ...(allocatedAt ? { allocatedAt } : {}) })
      remaining -= use
    }

    await prisma.campaignAllocation.createMany({ data: records })
    await prisma.campaign.updateMany({
      where: { id: campaignId, status: 'STOPPED' },
      data: { status: 'ACTIVE' },
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
    const count = await prisma.campaignAllocation.count({ where: { campaignId } })

    if (count === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    await prisma.campaignAllocation.deleteMany({ where: { campaignId } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
