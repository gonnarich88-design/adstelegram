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
