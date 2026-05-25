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
  const daysBack = Math.ceil((Date.now() - new Date(from + 'T00:00:00Z').getTime()) / msPerDay) + 5
  const limit = Math.min(Math.max(daysBack, 90), 365)

  // fetch Frankfurter 7 days before `from` to seed lastThb when range starts on a weekend
  const fromDate = new Date(from + 'T00:00:00Z')
  const fxFrom = new Date(fromDate.getTime() - 7 * 86_400_000).toISOString().split('T')[0]

  const [tonRes, fxRes] = await Promise.all([
    fetch(`https://min-api.cryptocompare.com/data/v2/histoday?fsym=TON&tsym=USD&limit=${limit}`, {
      cache: 'no-store',
    }),
    fetch(`https://api.frankfurter.app/${fxFrom}..${to}?from=USD&to=THB`, {
      cache: 'no-store',
    }),
  ])

  if (!tonRes.ok || !fxRes.ok) throw new Error('Failed to fetch historical rates')

  const tonData = await tonRes.json()
  const fxData = await fxRes.json()

  const tonMap: Record<string, number> = {}
  for (const row of (tonData.Data?.Data ?? []) as { time: number; close: number }[]) {
    const date = new Date(row.time * 1000).toISOString().split('T')[0]
    tonMap[date] = row.close
  }

  const thbMap: Record<string, number> = {}
  for (const [date, rates] of Object.entries(fxData.rates ?? {})) {
    thbMap[date] = (rates as { THB: number }).THB
  }

  // seed lastTon/lastThb from the 7-day pre-window so gap-fill works even when range starts on a weekend
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
