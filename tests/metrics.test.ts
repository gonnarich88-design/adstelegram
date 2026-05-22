import { describe, it, expect } from 'vitest'
import { calcEntryMetrics, calcAggregateMetrics } from '@/lib/metrics'

const sampleEntry = {
  spendTon: 8.5,
  dailyBudgetTon: 10,
  tonPriceUsd: 3.18,
  usdThbRate: 32.45,
  impressions: 12400,
  views: 9800,
  clicks: 384,
  joins: 69,
}

describe('calcEntryMetrics', () => {
  it('calculates spendUsd correctly', () => {
    const m = calcEntryMetrics(sampleEntry)
    expect(m.spendUsd).toBeCloseTo(8.5 * 3.18, 4)
  })

  it('calculates spendThb correctly', () => {
    const m = calcEntryMetrics(sampleEntry)
    expect(m.spendThb).toBeCloseTo(8.5 * 3.18 * 32.45, 2)
  })

  it('calculates CTR based on views', () => {
    const m = calcEntryMetrics(sampleEntry)
    expect(m.ctr).toBeCloseTo((384 / 9800) * 100, 4)
  })

  it('calculates CR', () => {
    const m = calcEntryMetrics(sampleEntry)
    expect(m.cr).toBeCloseTo((69 / 384) * 100, 4)
  })

  it('calculates CPC', () => {
    const m = calcEntryMetrics(sampleEntry)
    const spendUsd = 8.5 * 3.18
    expect(m.cpc).toBeCloseTo(spendUsd / 384, 4)
  })

  it('calculates CPS', () => {
    const m = calcEntryMetrics(sampleEntry)
    const spendUsd = 8.5 * 3.18
    expect(m.cps).toBeCloseTo(spendUsd / 69, 4)
  })

  it('calculates CPM based on views', () => {
    const m = calcEntryMetrics(sampleEntry)
    const spendUsd = 8.5 * 3.18
    expect(m.cpm).toBeCloseTo((spendUsd / 9800) * 1000, 4)
  })

  it('calculates BSP', () => {
    const m = calcEntryMetrics(sampleEntry)
    expect(m.bsp).toBeCloseTo((8.5 / 10) * 100, 4)
  })

  it('returns 0 for CTR and CPM when views = 0', () => {
    const m = calcEntryMetrics({ ...sampleEntry, views: 0 })
    expect(m.ctr).toBe(0)
    expect(m.cpm).toBe(0)
  })

  it('returns 0 for CR when clicks = 0', () => {
    const m = calcEntryMetrics({ ...sampleEntry, clicks: 0 })
    expect(m.cr).toBe(0)
    expect(m.cpc).toBe(0)
  })

  it('returns 0 for CPS when joins = 0', () => {
    const m = calcEntryMetrics({ ...sampleEntry, joins: 0 })
    expect(m.cps).toBe(0)
  })
})

describe('calcAggregateMetrics', () => {
  it('aggregates two entries correctly', () => {
    const entries = [sampleEntry, sampleEntry]
    const agg = calcAggregateMetrics(entries)
    expect(agg.totalSpendTon).toBeCloseTo(17, 4)
    expect(agg.totalViews).toBe(19600)
    expect(agg.totalClicks).toBe(768)
    expect(agg.totalJoins).toBe(138)
  })
})
