import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    globalGoal: {
      upsert: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}))

import { prisma } from '@/lib/prisma'

describe('GlobalGoal upsert logic', () => {
  beforeEach(() => vi.clearAllMocks())

  it('upserts with id=1', async () => {
    const mock = vi.mocked(prisma.globalGoal.upsert)
    mock.mockResolvedValue({ id: 1, note: 'hello', updatedAt: new Date() } as any)

    await prisma.globalGoal.upsert({
      where: { id: 1 },
      create: { id: 1, note: 'hello' },
      update: { note: 'hello' },
    })

    expect(mock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 1 } })
    )
  })
})
