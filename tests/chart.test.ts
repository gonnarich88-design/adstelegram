import { describe, it, expect } from 'vitest'
import { groupEntriesByDate } from '@/lib/chart'

describe('groupEntriesByDate', () => {
  it('returns empty array for no entries', () => {
    expect(groupEntriesByDate([])).toEqual([])
  })

  it('sums joins by CHANNEL and startbot by BOT separately', () => {
    const entries = [
      { date: new Date('2026-05-01T00:00:00'), spendTon: 1.5, joins: 10, targetType: 'CHANNEL' },
      { date: new Date('2026-05-01T00:00:00'), spendTon: 2.0, joins: 5, targetType: 'BOT' },
    ]
    const result = groupEntriesByDate(entries)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({ date: '2026-05-01', spendTon: 3.5, joins: 10, startbot: 5 })
  })

  it('sums multiple CHANNEL entries into joins only', () => {
    const entries = [
      { date: new Date('2026-05-01T00:00:00'), spendTon: 1.0, joins: 4, targetType: 'CHANNEL' },
      { date: new Date('2026-05-01T00:00:00'), spendTon: 2.0, joins: 6, targetType: 'CHANNEL' },
    ]
    const result = groupEntriesByDate(entries)
    expect(result[0]).toEqual({ date: '2026-05-01', spendTon: 3.0, joins: 10, startbot: 0 })
  })

  it('sums multiple BOT entries into startbot only', () => {
    const entries = [
      { date: new Date('2026-05-01T00:00:00'), spendTon: 1.0, joins: 7, targetType: 'BOT' },
      { date: new Date('2026-05-01T00:00:00'), spendTon: 1.5, joins: 3, targetType: 'BOT' },
    ]
    const result = groupEntriesByDate(entries)
    expect(result[0]).toEqual({ date: '2026-05-01', spendTon: 2.5, joins: 0, startbot: 10 })
  })

  it('keeps separate dates distinct', () => {
    const entries = [
      { date: new Date('2026-05-01T00:00:00'), spendTon: 1.0, joins: 8, targetType: 'BOT' },
      { date: new Date('2026-05-02T00:00:00'), spendTon: 2.0, joins: 3, targetType: 'BOT' },
    ]
    const result = groupEntriesByDate(entries)
    expect(result).toHaveLength(2)
  })

  it('sorts by date ascending', () => {
    const entries = [
      { date: new Date('2026-05-03T00:00:00'), spendTon: 1.0, joins: 5, targetType: 'BOT' },
      { date: new Date('2026-05-01T00:00:00'), spendTon: 2.0, joins: 3, targetType: 'BOT' },
      { date: new Date('2026-05-02T00:00:00'), spendTon: 1.5, joins: 7, targetType: 'BOT' },
    ]
    const result = groupEntriesByDate(entries)
    expect(result[0].date).toBe('2026-05-01')
    expect(result[1].date).toBe('2026-05-02')
    expect(result[2].date).toBe('2026-05-03')
  })

  it('formats date as YYYY-MM-DD string', () => {
    const entries = [
      { date: new Date('2026-05-07T12:00:00'), spendTon: 1.0, joins: 4, targetType: 'CHANNEL' },
    ]
    const result = groupEntriesByDate(entries)
    expect(result[0].date).toBe('2026-05-07')
  })
})
