export type ChartDataPoint = {
  date: string
  spendTon: number
  joins: number
}

export function groupEntriesByDate(
  entries: { date: Date; spendTon: number; joins: number }[]
): ChartDataPoint[] {
  const map = new Map<string, { spendTon: number; joins: number }>()

  for (const e of entries) {
    const d = e.date
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const existing = map.get(key) ?? { spendTon: 0, joins: 0 }
    map.set(key, {
      spendTon: existing.spendTon + e.spendTon,
      joins: existing.joins + e.joins,
    })
  }

  return Array.from(map.entries())
    .map(([date, v]) => ({ date, ...v }))
    .sort((a, b) => a.date.localeCompare(b.date))
}
