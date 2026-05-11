import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    campaign: {
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
      })
    ),
  },
}))

describe('exportData', () => {
  it('returns version 1 and exportedAt', async () => {
    const { prisma } = await import('@/lib/prisma')
    vi.mocked(prisma.campaign.findMany).mockResolvedValueOnce([])

    const { exportData } = await import('@/lib/export')
    const result = await exportData()

    expect(result.version).toBe(1)
    expect(result.exportedAt).toBeTruthy()
    expect(result.campaigns).toEqual([])
  })
})
