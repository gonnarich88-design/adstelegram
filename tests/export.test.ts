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
    dailyConversion: {
      findMany: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    campaignChangeLog: {
      findMany: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn(async (fn: (tx: any) => Promise<void>) =>
      fn({
        campaign: { create: vi.fn(), deleteMany: vi.fn() },
        performanceEntry: { deleteMany: vi.fn() },
        walletDeposit: { create: vi.fn(), deleteMany: vi.fn() },
        campaignAllocation: { create: vi.fn(), deleteMany: vi.fn() },
        dailyConversion: { create: vi.fn(), deleteMany: vi.fn() },
        campaignChangeLog: { deleteMany: vi.fn(), create: vi.fn() },
      })
    ),
  },
}))

describe('importData backward compat', () => {
  it('accepts campaign without bidCpmTon (old JSON) and stores null', async () => {
    const { prisma } = await import('@/lib/prisma')
    const mockTx = {
      campaignChangeLog: { deleteMany: vi.fn(), create: vi.fn() },
      campaignAllocation: { deleteMany: vi.fn() },
      performanceEntry: { deleteMany: vi.fn() },
      campaign: { deleteMany: vi.fn(), create: vi.fn() },
      walletDeposit: { deleteMany: vi.fn(), create: vi.fn() },
      dailyConversion: { deleteMany: vi.fn(), create: vi.fn() },
    }
    vi.mocked(prisma.$transaction).mockImplementationOnce((fn: any) => fn(mockTx))

    const { importData } = await import('@/lib/export')
    await importData({
      version: 2,
      exportedAt: new Date().toISOString(),
      campaigns: [{
        id: 'c1',
        name: 'Old Campaign',
        targetType: 'CHANNEL',
        targetName: '@test',
        startDate: new Date().toISOString(),
        endDate: null,
        dailyBudgetTon: '5',
        budgetTon: null,
        // bidCpmTon intentionally missing (old JSON)
        status: 'ACTIVE',
        placementName: null,
        note: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        entries: [],
      }],
    })

    expect(mockTx.campaign.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ bidCpmTon: null }) })
    )
  })
})

describe('exportData', () => {
  it('returns version 2, exportedAt, campaigns, walletDeposits, campaignAllocations', async () => {
    const { prisma } = await import('@/lib/prisma')
    vi.mocked(prisma.campaign.findMany).mockResolvedValueOnce([])
    vi.mocked(prisma.walletDeposit.findMany).mockResolvedValueOnce([])
    vi.mocked(prisma.campaignAllocation.findMany).mockResolvedValueOnce([])
    vi.mocked(prisma.dailyConversion.findMany).mockResolvedValueOnce([])
    vi.mocked(prisma.campaignChangeLog.findMany).mockResolvedValueOnce([])

    const { exportData } = await import('@/lib/export')
    const result = await exportData()

    expect(result.version).toBe(2)
    expect(result.exportedAt).toBeTruthy()
    expect(result.campaigns).toEqual([])
    expect(result.walletDeposits).toEqual([])
    expect(result.campaignAllocations).toEqual([])
  })
})

describe('exportData includes dailyConversions', () => {
  it('returns dailyConversions array with serialized records', async () => {
    const { prisma } = await import('@/lib/prisma')
    vi.mocked(prisma.campaign.findMany).mockResolvedValueOnce([])
    vi.mocked(prisma.walletDeposit.findMany).mockResolvedValueOnce([])
    vi.mocked(prisma.campaignAllocation.findMany).mockResolvedValueOnce([])
    vi.mocked(prisma.campaignChangeLog.findMany).mockResolvedValueOnce([])
    vi.mocked(prisma.dailyConversion.findMany).mockResolvedValueOnce([
      {
        id: 'dc1',
        date: new Date('2026-05-28'),
        registrations: 42,
        depositCount: 18,
        depositAmountThb: { toString: () => '54000.00' } as any,
        note: 'test',
        createdAt: new Date('2026-05-28T10:00:00Z'),
        updatedAt: new Date('2026-05-28T10:00:00Z'),
      },
    ])

    const { exportData } = await import('@/lib/export')
    const result = await exportData()

    expect(result.dailyConversions).toHaveLength(1)
    expect(result.dailyConversions![0]).toMatchObject({
      id: 'dc1',
      date: '2026-05-28',
      registrations: 42,
      depositCount: 18,
      depositAmountThb: '54000.00',
      note: 'test',
    })
  })
})

describe('importData backward compat — missing dailyConversions', () => {
  it('handles JSON without dailyConversions field gracefully', async () => {
    const { prisma } = await import('@/lib/prisma')
    const mockTx = {
      campaignChangeLog: { deleteMany: vi.fn(), create: vi.fn() },
      campaignAllocation: { deleteMany: vi.fn() },
      performanceEntry: { deleteMany: vi.fn() },
      campaign: { deleteMany: vi.fn(), create: vi.fn() },
      walletDeposit: { deleteMany: vi.fn(), create: vi.fn() },
      dailyConversion: { deleteMany: vi.fn(), create: vi.fn() },
    }
    vi.mocked(prisma.$transaction).mockImplementationOnce((fn: any) => fn(mockTx))

    const { importData } = await import('@/lib/export')
    await importData({
      version: 2,
      exportedAt: new Date().toISOString(),
      campaigns: [],
      // dailyConversions intentionally absent
    })

    expect(mockTx.dailyConversion.deleteMany).toHaveBeenCalled()
    expect(mockTx.dailyConversion.create).not.toHaveBeenCalled()
  })
})

describe('importData backward compat — missing campaignChangeLogs', () => {
  it('handles JSON without campaignChangeLogs field gracefully', async () => {
    const { prisma } = await import('@/lib/prisma')
    const mockTx = {
      campaignChangeLog: { deleteMany: vi.fn(), create: vi.fn() },
      campaignAllocation: { deleteMany: vi.fn() },
      performanceEntry: { deleteMany: vi.fn() },
      campaign: { deleteMany: vi.fn(), create: vi.fn() },
      walletDeposit: { deleteMany: vi.fn(), create: vi.fn() },
      dailyConversion: { deleteMany: vi.fn(), create: vi.fn() },
    }
    vi.mocked(prisma.$transaction).mockImplementationOnce((fn: any) => fn(mockTx))
    const { importData } = await import('@/lib/export')
    await importData({ version: 2, exportedAt: new Date().toISOString(), campaigns: [] })
    expect(mockTx.campaignChangeLog.deleteMany).toHaveBeenCalled()
    expect(mockTx.campaignChangeLog.create).not.toHaveBeenCalled()
  })
})

describe('exportData includes campaignChangeLogs', () => {
  it('returns campaignChangeLogs array with serialized records', async () => {
    const { prisma } = await import('@/lib/prisma')
    vi.mocked(prisma.campaign.findMany).mockResolvedValueOnce([])
    vi.mocked(prisma.walletDeposit.findMany).mockResolvedValueOnce([])
    vi.mocked(prisma.campaignAllocation.findMany).mockResolvedValueOnce([])
    vi.mocked(prisma.dailyConversion.findMany).mockResolvedValueOnce([])
    vi.mocked(prisma.campaignChangeLog.findMany).mockResolvedValueOnce([
      { id: 'log1', campaignId: 'c1', changedAt: new Date('2026-05-29T10:00:00Z'), field: 'dailyBudgetTon', oldValue: '5.00000000', newValue: '7.00000000', note: null } as any,
    ])
    const { exportData } = await import('@/lib/export')
    const result = await exportData()
    expect(result.campaignChangeLogs).toHaveLength(1)
    expect(result.campaignChangeLogs![0]).toMatchObject({ id: 'log1', campaignId: 'c1', field: 'dailyBudgetTon', oldValue: '5.00000000', newValue: '7.00000000', note: null })
  })
})
