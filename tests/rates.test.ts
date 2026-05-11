import { describe, it, expect, vi } from 'vitest'

global.fetch = vi.fn()

describe('fetchRates', () => {
  it('returns tonUsd and usdThb from APIs', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ 'the-open-network': { usd: 3.18 } }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ conversion_rate: 32.45 }),
      } as Response)

    process.env.EXCHANGE_RATE_API_KEY = 'test-key'

    const { fetchRates } = await import('@/lib/rates')
    const rates = await fetchRates()

    expect(rates.tonUsd).toBe(3.18)
    expect(rates.usdThb).toBe(32.45)
    expect(rates.fetchedAt).toBeTruthy()
  })

  it('throws when API fails', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: false } as Response)

    process.env.EXCHANGE_RATE_API_KEY = 'test-key'

    const { fetchRates } = await import('@/lib/rates')
    await expect(fetchRates()).rejects.toThrow('Failed to fetch rates')
  })
})
