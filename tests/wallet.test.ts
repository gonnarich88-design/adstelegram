import { describe, it, expect } from 'vitest'
import { computeWalletBalance, findCurrentRate, computeFifoRate } from '@/lib/wallet'

describe('computeWalletBalance', () => {
  it('returns 0 when no deposits', () => {
    expect(computeWalletBalance([], [])).toBe(0)
  })

  it('returns full deposit amount when no allocations', () => {
    expect(computeWalletBalance([{ amountTon: 1000 }, { amountTon: 500 }], [])).toBe(1500)
  })

  it('subtracts total allocations from total deposits', () => {
    expect(
      computeWalletBalance([{ amountTon: 2000 }], [{ amountTon: 300 }, { amountTon: 200 }])
    ).toBe(1500)
  })

  it('returns 0 when fully allocated', () => {
    expect(computeWalletBalance([{ amountTon: 500 }], [{ amountTon: 500 }])).toBe(0)
  })

  it('includes REFUND deposits in total (same as DEPOSIT)', () => {
    // REFUND deposit เพิ่ม balance เหมือน DEPOSIT ปกติ — สูตรไม่เปลี่ยน
    expect(
      computeWalletBalance(
        [{ amountTon: 1000 }, { amountTon: 4.041 }],
        [{ amountTon: 5 }]
      )
    ).toBeCloseTo(999.041)
  })

  it('net balance after refund equals original deposit minus actual spend', () => {
    // deposit 1000, allocate 5, refund 4.041, spend tracked = 0.959
    // balance = 1000 + 4.041 - 5 = 999.041
    expect(
      computeWalletBalance(
        [{ amountTon: 1000 }, { amountTon: 4.041 }],
        [{ amountTon: 5 }]
      )
    ).toBeCloseTo(999.041, 3)
  })
})

describe('findCurrentRate', () => {
  const deposit = (id: string, date: string, amount: number, tonUsd: number, usdThb: number) => ({
    id,
    amountTon: amount,
    depositedAt: new Date(date),
    tonPriceUsd: tonUsd,
    usdThbRate: usdThb,
  })

  it('returns null when no deposits', () => {
    expect(findCurrentRate([], [])).toBeNull()
  })

  it('returns null when all deposits are fully allocated', () => {
    const deposits = [deposit('d1', '2026-01-01', 100, 3, 100)]
    const allocations = [{ depositId: 'd1', amountTon: 100 }]
    expect(findCurrentRate(deposits, allocations)).toBeNull()
  })

  it('returns the only deposit when no allocations exist', () => {
    const deposits = [deposit('d1', '2026-01-01', 100, 3.21, 105.5)]
    const result = findCurrentRate(deposits, [])
    expect(result).toEqual({ tonPriceUsd: 3.21, usdThbRate: 105.5 })
  })

  it('returns oldest deposit with remaining balance (FIFO)', () => {
    const deposits = [
      deposit('d2', '2026-02-01', 200, 4.0, 110),
      deposit('d1', '2026-01-01', 100, 3.0, 100),
    ]
    const allocations = [{ depositId: 'd1', amountTon: 100 }]
    const result = findCurrentRate(deposits, allocations)
    expect(result?.tonPriceUsd).toBe(4.0)
    expect(result?.usdThbRate).toBe(110)
  })

  it('returns oldest deposit when multiple have remaining balance', () => {
    const deposits = [
      deposit('d2', '2026-02-01', 200, 4.0, 110),
      deposit('d1', '2026-01-01', 100, 3.0, 100),
    ]
    const result = findCurrentRate(deposits, [])
    expect(result?.tonPriceUsd).toBe(3.0)
    expect(result?.usdThbRate).toBe(100)
  })
})

describe('computeFifoRate', () => {
  const alloc = (
    amountTon: number,
    allocatedAt: string,
    tonUsd: number,
    usdThb: number,
    depositedAt?: string
  ) => ({
    amountTon,
    allocatedAt: new Date(allocatedAt),
    deposit: {
      tonPriceUsd: tonUsd,
      usdThbRate: usdThb,
      depositedAt: new Date(depositedAt ?? allocatedAt),
    },
  })

  it('returns null for empty allocations', () => {
    expect(computeFifoRate([], 0)).toBeNull()
  })

  it('returns batch rate and full remaining when spend=0', () => {
    const result = computeFifoRate([alloc(10, '2026-01-01', 1.5, 100)], 0)
    expect(result?.tonPriceUsd).toBe(1.5)
    expect(result?.usdThbRate).toBe(100)
    expect(result?.remainingTon).toBe(10)
  })

  it('returns batch1 rate when spend is within batch1', () => {
    const result = computeFifoRate([
      alloc(10, '2026-01-01', 1.5, 100),
      alloc(5,  '2026-02-01', 2.5, 110),
    ], 5)
    expect(result?.tonPriceUsd).toBe(1.5)
    expect(result?.remainingTon).toBe(5)
  })

  it('returns batch2 rate when spend exactly equals batch1 amountTon', () => {
    const result = computeFifoRate([
      alloc(10, '2026-01-01', 1.5, 100),
      alloc(5,  '2026-02-01', 2.5, 110),
    ], 10)
    expect(result?.tonPriceUsd).toBe(2.5)
    expect(result?.remainingTon).toBe(5)
  })

  it('returns batch1 rate and remaining=0 when spend equals batch1 and no batch2', () => {
    const result = computeFifoRate([alloc(10, '2026-01-01', 1.5, 100)], 10)
    expect(result?.tonPriceUsd).toBe(1.5)
    expect(result?.remainingTon).toBe(0)
  })

  it('returns batch2 rate when spend is within batch2', () => {
    const result = computeFifoRate([
      alloc(10, '2026-01-01', 1.5, 100),
      alloc(5,  '2026-02-01', 2.5, 110),
    ], 12)
    expect(result?.tonPriceUsd).toBe(2.5)
    expect(result?.remainingTon).toBe(3)
  })

  it('returns last batch rate and remaining=0 when overspend', () => {
    const result = computeFifoRate([
      alloc(10, '2026-01-01', 1.5, 100),
      alloc(5,  '2026-02-01', 2.5, 110),
    ], 20)
    expect(result?.tonPriceUsd).toBe(2.5)
    expect(result?.remainingTon).toBe(0)
  })

  it('sorts allocations by allocatedAt ASC regardless of input order', () => {
    const result = computeFifoRate([
      alloc(5,  '2026-02-01', 2.5, 110), // newer — sent first
      alloc(10, '2026-01-01', 1.5, 100), // older — sent last
    ], 5)
    expect(result?.tonPriceUsd).toBe(1.5) // must use oldest batch first
    expect(result?.remainingTon).toBe(5)
  })
})
