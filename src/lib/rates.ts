export interface Rates {
  tonUsd: number
  usdThb: number
  fetchedAt: string
}

export async function fetchRates(): Promise<Rates> {
  const [tonRes, thbRes] = await Promise.all([
    fetch('https://api.coingecko.com/api/v3/simple/price?ids=the-open-network&vs_currencies=usd', {
      cache: 'no-store',
    }),
    fetch(
      `https://v6.exchangerate-api.com/v6/${process.env.EXCHANGE_RATE_API_KEY}/pair/USD/THB`,
      { cache: 'no-store' }
    ),
  ])

  if (!tonRes.ok || !thbRes.ok) {
    throw new Error('Failed to fetch rates')
  }

  const tonData = await tonRes.json()
  const thbData = await thbRes.json()

  return {
    tonUsd: tonData['the-open-network'].usd as number,
    usdThb: thbData.conversion_rate as number,
    fetchedAt: new Date().toISOString(),
  }
}
