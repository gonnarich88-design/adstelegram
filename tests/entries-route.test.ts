import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockFindUnique = vi.fn()
const mockUpdate = vi.fn()
const mockDelete = vi.fn()

vi.mock('@/lib/prisma', () => ({
  prisma: {
    performanceEntry: {
      findUnique: mockFindUnique,
      update: mockUpdate,
      delete: mockDelete,
    },
  },
}))

const VALID_BODY = {
  date: '2026-05-21',
  spendTon: 8.5,
  dailyBudgetTon: 10,
  tonPriceUsd: 3.18,
  usdThbRate: 32.45,
  impressions: 0,
  views: 9800,
  clicks: 384,
  joins: 69,
  note: null,
}

function makeReq(method: string, body?: object) {
  return new NextRequest('http://localhost/api/campaigns/c1/entries/e1', {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('PATCH /api/campaigns/[id]/entries/[entryId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 404 when entry not found', async () => {
    mockFindUnique.mockResolvedValue(null)
    const { PATCH } = await import('@/app/api/campaigns/[id]/entries/[entryId]/route')
    const res = await PATCH(makeReq('PATCH', VALID_BODY), {
      params: Promise.resolve({ id: 'c1', entryId: 'e1' }),
    })
    expect(res.status).toBe(404)
  })

  it('returns 404 when entry belongs to different campaign', async () => {
    mockFindUnique.mockResolvedValue({ id: 'e1', campaignId: 'other' })
    const { PATCH } = await import('@/app/api/campaigns/[id]/entries/[entryId]/route')
    const res = await PATCH(makeReq('PATCH', VALID_BODY), {
      params: Promise.resolve({ id: 'c1', entryId: 'e1' }),
    })
    expect(res.status).toBe(404)
  })

  it('returns 400 when required fields missing', async () => {
    mockFindUnique.mockResolvedValue({ id: 'e1', campaignId: 'c1' })
    const { PATCH } = await import('@/app/api/campaigns/[id]/entries/[entryId]/route')
    const res = await PATCH(makeReq('PATCH', { date: '2026-05-21' }), {
      params: Promise.resolve({ id: 'c1', entryId: 'e1' }),
    })
    expect(res.status).toBe(400)
  })

  it('updates entry and returns 200 on success', async () => {
    mockFindUnique.mockResolvedValue({ id: 'e1', campaignId: 'c1' })
    mockUpdate.mockResolvedValue({ id: 'e1', ...VALID_BODY })
    const { PATCH } = await import('@/app/api/campaigns/[id]/entries/[entryId]/route')
    const res = await PATCH(makeReq('PATCH', VALID_BODY), {
      params: Promise.resolve({ id: 'c1', entryId: 'e1' }),
    })
    expect(res.status).toBe(200)
    expect(mockUpdate).toHaveBeenCalledOnce()
  })
})

describe('DELETE /api/campaigns/[id]/entries/[entryId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 404 when entry not found', async () => {
    mockFindUnique.mockResolvedValue(null)
    const { DELETE } = await import('@/app/api/campaigns/[id]/entries/[entryId]/route')
    const res = await DELETE(makeReq('DELETE'), {
      params: Promise.resolve({ id: 'c1', entryId: 'e1' }),
    })
    expect(res.status).toBe(404)
  })

  it('returns 404 when entry belongs to different campaign', async () => {
    mockFindUnique.mockResolvedValue({ id: 'e1', campaignId: 'other' })
    const { DELETE } = await import('@/app/api/campaigns/[id]/entries/[entryId]/route')
    const res = await DELETE(makeReq('DELETE'), {
      params: Promise.resolve({ id: 'c1', entryId: 'e1' }),
    })
    expect(res.status).toBe(404)
  })

  it('deletes entry and returns 204 on success', async () => {
    mockFindUnique.mockResolvedValue({ id: 'e1', campaignId: 'c1' })
    mockDelete.mockResolvedValue({})
    const { DELETE } = await import('@/app/api/campaigns/[id]/entries/[entryId]/route')
    const res = await DELETE(makeReq('DELETE'), {
      params: Promise.resolve({ id: 'c1', entryId: 'e1' }),
    })
    expect(res.status).toBe(204)
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: 'e1' } })
  })
})
