export interface Rates {
  tonUsd: number
  usdThb: number
  fetchedAt: string
}

export interface DayRate {
  tonUsd: number
  usdThb: number
}

export async function fetchHistoricalRates(
  from: string,
  to: string,
): Promise<Record<string, DayRate>> {
  const msPerDay = 86_400_000

  // seed window: 7 days before `from` so gap-fill works when range starts on a weekend
  const fromDate = new Date(from + 'T00:00:00Z')
  const toDate = new Date(to + 'T00:00:00Z')
  const seedFrom = new Date(fromDate.getTime() - 7 * msPerDay)
  const fxFrom = seedFrom.toISOString().split('T')[0]

  const tonFromUnix = Math.floor(seedFrom.getTime() / 1000)
  const tonToUnix = Math.floor(toDate.getTime() / 1000) + msPerDay / 1000

  const [tonRes, fxRes] = await Promise.all([
    fetch(
      `https://api.coingecko.com/api/v3/coins/the-open-network/market_chart/range?vs_currency=usd&from=${tonFromUnix}&to=${tonToUnix}`,
      { cache: 'no-store' },
    ),
    fetch(`https://api.frankfurter.dev/v1/${fxFrom}..${to}?from=USD&to=THB`, {
      cache: 'no-store',
    }),
  ])

  if (!tonRes.ok || !fxRes.ok) throw new Error('Failed to fetch historical rates')

  const tonData = await tonRes.json()
  const fxData = await fxRes.json()

  const tonMap: Record<string, number> = {}
  for (const [timestamp, price] of (tonData.prices ?? []) as [number, number][]) {
    const date = new Date(timestamp).toISOString().split('T')[0]
    tonMap[date] = price
  }

  const thbMap: Record<string, number> = {}
  for (const [date, rates] of Object.entries(fxData.rates ?? {})) {
    thbMap[date] = (rates as { THB: number }).THB
  }

  let lastTon = 0
  let lastThb = 0
  const seed = new Date(fxFrom + 'T00:00:00Z')
  while (seed < fromDate) {
    const d = seed.toISOString().split('T')[0]
    if (tonMap[d]) lastTon = tonMap[d]
    if (thbMap[d]) lastThb = thbMap[d]
    seed.setUTCDate(seed.getUTCDate() + 1)
  }

  // fill gaps (weekends/holidays) with last known rate
  const result: Record<string, DayRate> = {}
  const cur = new Date(from + 'T00:00:00Z')
  const end = new Date(to + 'T00:00:00Z')

  while (cur <= end) {
    const d = cur.toISOString().split('T')[0]
    if (tonMap[d]) lastTon = tonMap[d]
    if (thbMap[d]) lastThb = thbMap[d]
    if (lastTon && lastThb) result[d] = { tonUsd: lastTon, usdThb: lastThb }
    cur.setUTCDate(cur.getUTCDate() + 1)
  }

  return result
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
