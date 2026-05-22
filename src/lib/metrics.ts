export interface EntryInput {
  spendTon: number
  dailyBudgetTon: number
  tonPriceUsd: number
  usdThbRate: number
  impressions: number
  views?: number
  clicks: number
  joins: number
}

export interface EntryMetrics {
  spendUsd: number
  spendThb: number
  ctr: number
  cr: number
  cpc: number
  cps: number
  cpm: number
  bsp: number
}

export interface AggregateMetrics extends EntryMetrics {
  totalSpendTon: number
  totalViews: number
  totalClicks: number
  totalJoins: number
}

export function calcEntryMetrics(e: EntryInput): EntryMetrics {
  const spendUsd = Number(e.spendTon) * Number(e.tonPriceUsd)
  const spendThb = spendUsd * Number(e.usdThbRate)
  const vws = Number(e.views ?? 0)
  const clk = Number(e.clicks)
  const jns = Number(e.joins)
  const ton = Number(e.spendTon)
  const budget = Number(e.dailyBudgetTon)

  return {
    spendUsd,
    spendThb,
    ctr: vws > 0 ? (clk / vws) * 100 : 0,
    cr: clk > 0 ? (jns / clk) * 100 : 0,
    cpc: clk > 0 ? spendUsd / clk : 0,
    cps: jns > 0 ? spendUsd / jns : 0,
    cpm: vws > 0 ? (spendUsd / vws) * 1000 : 0,
    bsp: budget > 0 ? (ton / budget) * 100 : 0,
  }
}

export function calcAggregateMetrics(entries: EntryInput[]): AggregateMetrics {
  const totals = entries.reduce(
    (acc, e) => {
      const spendUsd = Number(e.spendTon) * Number(e.tonPriceUsd)
      return {
        spendTon: acc.spendTon + Number(e.spendTon),
        spendUsd: acc.spendUsd + spendUsd,
        spendThb: acc.spendThb + spendUsd * Number(e.usdThbRate),
        dailyBudgetTon: acc.dailyBudgetTon + Number(e.dailyBudgetTon),
        views: acc.views + Number(e.views ?? 0),
        clicks: acc.clicks + Number(e.clicks),
        joins: acc.joins + Number(e.joins),
      }
    },
    { spendTon: 0, spendUsd: 0, spendThb: 0, dailyBudgetTon: 0, views: 0, clicks: 0, joins: 0 }
  )

  const { spendTon, spendUsd, spendThb, dailyBudgetTon, views, clicks, joins } = totals

  return {
    spendUsd,
    spendThb,
    ctr: views > 0 ? (clicks / views) * 100 : 0,
    cr: clicks > 0 ? (joins / clicks) * 100 : 0,
    cpc: clicks > 0 ? spendUsd / clicks : 0,
    cps: joins > 0 ? spendUsd / joins : 0,
    cpm: views > 0 ? (spendUsd / views) * 1000 : 0,
    bsp: dailyBudgetTon > 0 ? (spendTon / dailyBudgetTon) * 100 : 0,
    totalSpendTon: spendTon,
    totalViews: views,
    totalClicks: clicks,
    totalJoins: joins,
  }
}
