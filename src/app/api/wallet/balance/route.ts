import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { computeWalletBalance, findCurrentRate } from '@/lib/wallet'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const deposits = await prisma.walletDeposit.findMany({
      include: { allocations: true },
      orderBy: { depositedAt: 'asc' },
    })

    const allAllocations = deposits.flatMap(d =>
      d.allocations.map(a => ({ depositId: a.depositId, amountTon: Number(a.amountTon) }))
    )

    const depositsNormalized = deposits.map(d => ({
      id: d.id,
      amountTon: Number(d.amountTon),
      depositedAt: d.depositedAt,
      tonPriceUsd: Number(d.tonPriceUsd),
      usdThbRate: Number(d.usdThbRate),
    }))

    const totalDeposited = depositsNormalized.reduce((s, d) => s + d.amountTon, 0)
    const totalAllocated = allAllocations.reduce((s, a) => s + a.amountTon, 0)
    const balance = computeWalletBalance(depositsNormalized, allAllocations)
    const currentRate = findCurrentRate(depositsNormalized, allAllocations)

    return NextResponse.json({ totalDeposited, totalAllocated, balance, currentRate })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
