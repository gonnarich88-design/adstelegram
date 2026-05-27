import { describe, it, expect } from 'vitest'
import { groupEntriesByDate } from '@/lib/chart'

describe('groupEntriesByDate', () => {
  it('returns empty array for no entries', () => {
    expect(groupEntriesByDate([])).toEqual([])
  })

  it('groups entries on same date and sums values', () => {
    const entries = [
      { date: new Date('2026-05-01T00:00:00'), spendTon: 1.5, joins: 10 },
      { date: new Date('2026-05-01T00:00:00'), spendTon: 2.0, joins: 5 },
    ]
    const result = groupEntriesByDate(entries)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({ date: '2026-05-01', spendTon: 3.5, joins: 15 })
  })

  it('keeps separate dates distinct', () => {
    const entries = [
      { date: new Date('2026-05-01T00:00:00'), spendTon: 1.0, joins: 8 },
      { date: new Date('2026-05-02T00:00:00'), spendTon: 2.0, joins: 3 },
    ]
    const result = groupEntriesByDate(entries)
    expect(result).toHaveLength(2)
  })

  it('sorts by date ascending', () => {
    const entries = [
      { date: new Date('2026-05-03T00:00:00'), spendTon: 1.0, joins: 5 },
      { date: new Date('2026-05-01T00:00:00'), spendTon: 2.0, joins: 3 },
      { date: new Date('2026-05-02T00:00:00'), spendTon: 1.5, joins: 7 },
    ]
    const result = groupEntriesByDate(entries)
    expect(result[0].date).toBe('2026-05-01')
    expect(result[1].date).toBe('2026-05-02')
    expect(result[2].date).toBe('2026-05-03')
  })

  it('formats date as YYYY-MM-DD string', () => {
    const entries = [
      { date: new Date('2026-05-07T12:00:00'), spendTon: 1.0, joins: 4 },
    ]
    const result = groupEntriesByDate(entries)
    expect(result[0].date).toBe('2026-05-07')
  })
})
