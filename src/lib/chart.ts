export type ChartDataPoint = {
  date: string
  spendTon: number
  joins: number    // CHANNEL campaigns
  startbot: number // BOT campaigns
}

export function groupEntriesByDate(
  entries: { date: Date; spendTon: number; joins: number; targetType: string }[]
): ChartDataPoint[] {
  const map = new Map<string, { spendTon: number; joins: number; startbot: number }>()

  for (const e of entries) {
    const d = e.date
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const existing = map.get(key) ?? { spendTon: 0, joins: 0, startbot: 0 }
    map.set(key, {
      spendTon: existing.spendTon + e.spendTon,
      joins: existing.joins + (e.targetType === 'CHANNEL' ? e.joins : 0),
      startbot: existing.startbot + (e.targetType === 'BOT' ? e.joins : 0),
    })
  }

  return Array.from(map.entries())
    .map(([date, v]) => ({ date, ...v }))
    .sort((a, b) => a.date.localeCompare(b.date))
}
