export function computeWalletBalance(
  deposits: Array<{ amountTon: number }>,
  allocations: Array<{ amountTon: number }>
): number {
  const totalDeposited = deposits.reduce((s, d) => s + d.amountTon, 0)
  const totalAllocated = allocations.reduce((s, a) => s + a.amountTon, 0)
  return totalDeposited - totalAllocated
}

export function findCurrentRate(
  deposits: Array<{ id: string; amountTon: number; depositedAt: Date; tonPriceUsd: number; usdThbRate: number }>,
  allocations: Array<{ depositId: string; amountTon: number }>
): { tonPriceUsd: number; usdThbRate: number } | null {
  const allocatedByDeposit = new Map<string, number>()
  for (const a of allocations) {
    allocatedByDeposit.set(a.depositId, (allocatedByDeposit.get(a.depositId) ?? 0) + a.amountTon)
  }

  const sorted = [...deposits].sort((a, b) => a.depositedAt.getTime() - b.depositedAt.getTime())

  for (const d of sorted) {
    const allocated = allocatedByDeposit.get(d.id) ?? 0
    if (d.amountTon - allocated > 0) {
      return { tonPriceUsd: d.tonPriceUsd, usdThbRate: d.usdThbRate }
    }
  }
  return null
}

export function computeFifoRate(
  allocations: Array<{
    amountTon: number
    allocatedAt: Date
    deposit: { tonPriceUsd: number; usdThbRate: number; depositedAt: Date }
  }>,
  totalSpentTon: number
): {
  tonPriceUsd: number
  usdThbRate: number
  depositedAt: Date
  remainingTon: number
} | null {
  if (allocations.length === 0) return null

  const sorted = [...allocations].sort((a, b) => a.allocatedAt.getTime() - b.allocatedAt.getTime())
  const lastAlloc = sorted[sorted.length - 1]
  let running = 0

  for (const alloc of sorted) {
    if (totalSpentTon < running + alloc.amountTon) {
      return {
        tonPriceUsd: alloc.deposit.tonPriceUsd,
        usdThbRate:  alloc.deposit.usdThbRate,
        depositedAt: alloc.deposit.depositedAt,
        remainingTon: alloc.amountTon - (totalSpentTon - running),
      }
    }
    running += alloc.amountTon
  }

  return {
    tonPriceUsd: lastAlloc.deposit.tonPriceUsd,
    usdThbRate:  lastAlloc.deposit.usdThbRate,
    depositedAt: lastAlloc.deposit.depositedAt,
    remainingTon: 0,
  }
}
