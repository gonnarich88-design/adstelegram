import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    campaign: {
      findMany: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    walletDeposit: {
      findMany: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    campaignAllocation: {
      findMany: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    performanceEntry: {
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn(async (fn: (tx: any) => Promise<void>) =>
      fn({
        campaign: { create: vi.fn(), deleteMany: vi.fn() },
        performanceEntry: { deleteMany: vi.fn() },
        walletDeposit: { create: vi.fn(), deleteMany: vi.fn() },
        campaignAllocation: { create: vi.fn(), deleteMany: vi.fn() },
      })
    ),
  },
}))

describe('exportData', () => {
  it('returns version 2, exportedAt, campaigns, walletDeposits, campaignAllocations', async () => {
    const { prisma } = await import('@/lib/prisma')
    vi.mocked(prisma.campaign.findMany).mockResolvedValueOnce([])
    vi.mocked(prisma.walletDeposit.findMany).mockResolvedValueOnce([])
    vi.mocked(prisma.campaignAllocation.findMany).mockResolvedValueOnce([])

    const { exportData } = await import('@/lib/export')
    const result = await exportData()

    expect(result.version).toBe(2)
    expect(result.exportedAt).toBeTruthy()
    expect(result.campaigns).toEqual([])
    expect(result.walletDeposits).toEqual([])
    expect(result.campaignAllocations).toEqual([])
  })
})
