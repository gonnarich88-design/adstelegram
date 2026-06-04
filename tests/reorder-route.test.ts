import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockCampaignUpdate = vi.fn()
const mockTransaction = vi.fn()

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: mockTransaction,
    campaign: { update: mockCampaignUpdate },
  },
}))

function makeReq(body: unknown) {
  return new NextRequest('http://localhost/api/campaigns/reorder', {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('PATCH /api/campaigns/reorder', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 400 when body is not an array', async () => {
    const { PATCH } = await import('@/app/api/campaigns/reorder/route')
    const res = await PATCH(makeReq({ id: 'x', sortOrder: 0 }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when body is empty array', async () => {
    const { PATCH } = await import('@/app/api/campaigns/reorder/route')
    const res = await PATCH(makeReq([]))
    expect(res.status).toBe(400)
  })

  it('calls prisma.$transaction and returns 200', async () => {
    mockTransaction.mockResolvedValueOnce(undefined)
    const { PATCH } = await import('@/app/api/campaigns/reorder/route')
    const res = await PATCH(makeReq([
      { id: 'c1', sortOrder: 0 },
      { id: 'c2', sortOrder: 1 },
    ]))
    expect(res.status).toBe(200)
    expect(mockTransaction).toHaveBeenCalledOnce()
  })
})
