import { describe, it, expect } from 'vitest'
import { buildOverviewPrompt, buildCampaignPrompt, parseAnalysisResult } from '@/lib/analysis'
import type { CampaignSummary, EntryRow, OverviewContext, CampaignContext } from '@/lib/analysis'

const baseCampaign: CampaignSummary = {
  id: 'c1',
  name: 'Test Bot',
  status: 'ACTIVE',
  targetType: 'BOT',
  dailyBudgetTon: 5,
  totalAllocated: 50,
  totalSpent: 20,
  budgetUsedPct: 40,
  totalJoins: 100,
  avgCPS: 0.0027,
  ctr: 1.5,
  goalText: null,
  planText: null,
  targetJoins: null,
  targetDate: null,
}

describe('buildOverviewPrompt', () => {
  it('includes today date in system message', () => {
    const { system } = buildOverviewPrompt([baseCampaign], null, '2026-06-04')
    expect(system).toContain('2026-06-04')
  })

  it('includes globalNote when provided', () => {
    const { system } = buildOverviewPrompt([baseCampaign], 'เน้น CPS < $0.005', '2026-06-04')
    expect(system).toContain('เน้น CPS < $0.005')
  })

  it('omits globalNote when null', () => {
    const { system } = buildOverviewPrompt([baseCampaign], null, '2026-06-04')
    expect(system).not.toContain('กลยุทธ์ภาพรวม')
  })

  it('includes campaign name and joins in user message', () => {
    const { user } = buildOverviewPrompt([baseCampaign], null, '2026-06-04')
    expect(user).toContain('Test Bot')
    expect(user).toContain('Joins: 100')
  })

  it('includes perCampaign schema hint', () => {
    const { user } = buildOverviewPrompt([baseCampaign], null, '2026-06-04')
    expect(user).toContain('perCampaign')
  })

  it('includes goalText and targetJoins when provided', () => {
    const c = { ...baseCampaign, goalText: 'ได้ 500 joins', targetJoins: 500 }
    const { user } = buildOverviewPrompt([c], null, '2026-06-04')
    expect(user).toContain('ได้ 500 joins')
    expect(user).toContain('500')
  })
})

describe('buildCampaignPrompt', () => {
  const entries: EntryRow[] = [
    { date: '2026-06-01', spendTon: 4.5, views: 9000, clicks: 200, joins: 40 },
    { date: '2026-06-02', spendTon: 5.0, views: 10000, clicks: 220, joins: 45 },
  ]

  it('includes entry dates and joins in user message', () => {
    const { user } = buildCampaignPrompt(baseCampaign, entries, null, '2026-06-04')
    expect(user).toContain('2026-06-01')
    expect(user).toContain('joins=40')
  })

  it('shows ไม่มีข้อมูล when entries empty', () => {
    const { user } = buildCampaignPrompt(baseCampaign, [], null, '2026-06-04')
    expect(user).toContain('ไม่มีข้อมูล')
  })

  it('does not include perCampaign schema hint', () => {
    const { user } = buildCampaignPrompt(baseCampaign, [], null, '2026-06-04')
    expect(user).not.toContain('perCampaign')
  })

  it('includes planText when provided', () => {
    const c = { ...baseCampaign, planText: 'ลด bid ถ้า CTR < 1%' }
    const { user } = buildCampaignPrompt(c, [], null, '2026-06-04')
    expect(user).toContain('ลด bid ถ้า CTR < 1%')
  })
})

describe('buildOverviewPrompt with context', () => {
  it('includes problems in system message', () => {
    const ctx: OverviewContext = { problems: ['งบไม่เต็ม', 'CTR ต่ำ'], question: '' }
    const { system } = buildOverviewPrompt([baseCampaign], null, '2026-06-05', ctx)
    expect(system).toContain('ปัญหาที่รายงาน: งบไม่เต็ม, CTR ต่ำ')
  })

  it('includes question in system message', () => {
    const ctx: OverviewContext = { problems: [], question: 'ควรปรับ campaign ไหนก่อน?' }
    const { system } = buildOverviewPrompt([baseCampaign], null, '2026-06-05', ctx)
    expect(system).toContain('โจทย์: ควรปรับ campaign ไหนก่อน?')
  })

  it('omits problems line when array is empty', () => {
    const ctx: OverviewContext = { problems: [], question: '' }
    const { system } = buildOverviewPrompt([baseCampaign], null, '2026-06-05', ctx)
    expect(system).not.toContain('ปัญหาที่รายงาน')
  })

  it('omits question line when empty string', () => {
    const ctx: OverviewContext = { problems: [], question: '' }
    const { system } = buildOverviewPrompt([baseCampaign], null, '2026-06-05', ctx)
    expect(system).not.toContain('โจทย์:')
  })
})

describe('buildCampaignPrompt with context', () => {
  it('includes all non-empty context fields in system message', () => {
    const ctx: CampaignContext = {
      problems: ['งบหมดเร็ว'],
      budgetDepletionTime: '10:00',
      bidInfo: 'bid 0.5, floor 0.3',
      question: 'ควร scale budget ไหม?',
    }
    const { system } = buildCampaignPrompt(baseCampaign, [], null, '2026-06-05', ctx)
    expect(system).toContain('ปัญหาที่รายงาน: งบหมดเร็ว')
    expect(system).toContain('งบหมดเวลา: 10:00')
    expect(system).toContain('Bid/Floor: bid 0.5, floor 0.3')
    expect(system).toContain('โจทย์: ควร scale budget ไหม?')
  })

  it('omits budgetDepletionTime line when empty', () => {
    const ctx: CampaignContext = { problems: [], budgetDepletionTime: '', bidInfo: '', question: '' }
    const { system } = buildCampaignPrompt(baseCampaign, [], null, '2026-06-05', ctx)
    expect(system).not.toContain('งบหมดเวลา')
  })

  it('omits bidInfo line when empty', () => {
    const ctx: CampaignContext = { problems: [], budgetDepletionTime: '', bidInfo: '', question: '' }
    const { system } = buildCampaignPrompt(baseCampaign, [], null, '2026-06-05', ctx)
    expect(system).not.toContain('Bid/Floor')
  })
})

describe('parseAnalysisResult', () => {
  it('parses valid result correctly', () => {
    const json = JSON.stringify({
      status: 'ดี',
      immediate: ['ทำ X'],
      weekly: ['ทำ Y'],
      monthly: ['ทำ Z'],
      assumptions: [],
    })
    const result = parseAnalysisResult(json)
    expect(result.status).toBe('ดี')
    expect(result.immediate).toEqual(['ทำ X'])
    expect(result.monthly).toEqual(['ทำ Z'])
  })

  it('throws on invalid JSON', () => {
    expect(() => parseAnalysisResult('not-json')).toThrow()
  })

  it('throws on missing required fields', () => {
    const json = JSON.stringify({ status: 'ดี' })
    expect(() => parseAnalysisResult(json)).toThrow('Invalid analysis result structure')
  })

  it('preserves optional perCampaign array', () => {
    const json = JSON.stringify({
      status: 'ดี',
      immediate: [],
      weekly: [],
      monthly: [],
      assumptions: [],
      perCampaign: [{ campaignId: 'c1', name: 'Bot', status: 'ดีมาก', highlight: 'CTR ดี' }],
    })
    const result = parseAnalysisResult(json)
    expect(result.perCampaign).toHaveLength(1)
    expect(result.perCampaign![0].status).toBe('ดีมาก')
  })
})
