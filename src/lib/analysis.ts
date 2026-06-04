export interface CampaignSummary {
  id: string
  name: string
  status: string
  targetType: string
  dailyBudgetTon: number
  totalAllocated: number
  totalSpent: number
  budgetUsedPct: number
  totalJoins: number
  avgCPS: number
  ctr: number
  goalText: string | null
  planText: string | null
  targetJoins: number | null
  targetDate: string | null
}

export interface EntryRow {
  date: string
  spendTon: number
  views: number
  clicks: number
  joins: number
}

export interface AnalysisResult {
  status: string
  immediate: string[]
  weekly: string[]
  monthly: string[]
  assumptions: string[]
  perCampaign?: {
    campaignId: string
    name: string
    status: string
    highlight: string
  }[]
}

export interface OverviewContext {
  problems: string[]
  question: string
}

export interface CampaignContext {
  problems: string[]
  budgetDepletionTime: string
  bidInfo: string
  question: string
}

interface PromptMessages {
  system: string
  user: string
}

export function buildOverviewPrompt(
  campaigns: CampaignSummary[],
  globalNote: string | null,
  today: string,
  context?: OverviewContext,
): PromptMessages {
  const systemLines = [
    'คุณเป็นผู้เชี่ยวชาญด้านโฆษณา Telegram Ads',
    'ตอบเป็นภาษาไทยเท่านั้น',
    'ตอบกลับเป็น JSON object เท่านั้น ไม่มีข้อความอื่น',
    `วันที่ปัจจุบัน: ${today} (Asia/Bangkok)`,
  ]
  if (globalNote) systemLines.push(`กลยุทธ์ภาพรวม: ${globalNote}`)
  if (context?.problems?.length) systemLines.push(`ปัญหาที่รายงาน: ${context.problems.join(', ')}`)
  if (context?.question) systemLines.push(`โจทย์: ${context.question}`)

  const campaignLines = campaigns.map(c => {
    const parts = [
      `ชื่อ: ${c.name}`,
      `สถานะ: ${c.status}`,
      `ประเภท: ${c.targetType}`,
      `งบรายวัน: ${c.dailyBudgetTon.toFixed(2)} TON`,
      `จัดสรร: ${c.totalAllocated.toFixed(2)} TON`,
      `ใช้: ${c.totalSpent.toFixed(2)} TON (${c.budgetUsedPct.toFixed(1)}%)`,
      `Joins: ${c.totalJoins}`,
      `CPS: $${c.avgCPS.toFixed(4)}`,
      `CTR: ${c.ctr.toFixed(2)}%`,
    ]
    if (c.goalText) parts.push(`เป้าหมาย: ${c.goalText}`)
    if (c.targetJoins != null) parts.push(`เป้า Joins: ${c.targetJoins}`)
    if (c.targetDate) parts.push(`วันเป้าหมาย: ${c.targetDate}`)
    return `[ID:${c.id}] ${parts.join(' | ')}`
  }).join('\n')

  const schemaHint = '{"status":"...","immediate":["..."],"weekly":["..."],"monthly":["..."],"assumptions":["..."],"perCampaign":[{"campaignId":"...","name":"...","status":"ดีมาก|ปกติ|ต้องระวัง|วิกฤต","highlight":"..."}]}'

  const user = [
    'วิเคราะห์ภาพรวมแคมเปญโฆษณาต่อไปนี้:',
    '',
    campaignLines,
    '',
    `ตอบกลับ JSON เท่านั้น schema: ${schemaHint}`,
  ].join('\n')

  return { system: systemLines.join('\n'), user }
}

export function buildCampaignPrompt(
  campaign: CampaignSummary,
  entries: EntryRow[],
  globalNote: string | null,
  today: string,
  context?: CampaignContext,
): PromptMessages {
  const systemLines = [
    'คุณเป็นผู้เชี่ยวชาญด้านโฆษณา Telegram Ads',
    'ตอบเป็นภาษาไทยเท่านั้น',
    'ตอบกลับเป็น JSON object เท่านั้น ไม่มีข้อความอื่น',
    `วันที่ปัจจุบัน: ${today} (Asia/Bangkok)`,
  ]
  if (globalNote) systemLines.push(`กลยุทธ์ภาพรวม: ${globalNote}`)
  if (context?.problems?.length) systemLines.push(`ปัญหาที่รายงาน: ${context.problems.join(', ')}`)
  if (context?.budgetDepletionTime) systemLines.push(`งบหมดเวลา: ${context.budgetDepletionTime}`)
  if (context?.bidInfo) systemLines.push(`Bid/Floor: ${context.bidInfo}`)
  if (context?.question) systemLines.push(`โจทย์: ${context.question}`)

  const infoLines = [
    `ชื่อ: ${campaign.name}`,
    `สถานะ: ${campaign.status}`,
    `ประเภท: ${campaign.targetType}`,
    `งบรายวัน: ${campaign.dailyBudgetTon.toFixed(2)} TON`,
    `จัดสรร: ${campaign.totalAllocated.toFixed(2)} TON`,
    `ใช้: ${campaign.totalSpent.toFixed(2)} TON (${campaign.budgetUsedPct.toFixed(1)}%)`,
    `Joins: ${campaign.totalJoins}`,
    `CPS: $${campaign.avgCPS.toFixed(4)}`,
    `CTR: ${campaign.ctr.toFixed(2)}%`,
  ]
  if (campaign.goalText) infoLines.push(`เป้าหมาย: ${campaign.goalText}`)
  if (campaign.planText) infoLines.push(`แผน: ${campaign.planText}`)
  if (campaign.targetJoins != null) infoLines.push(`เป้า Joins: ${campaign.targetJoins}`)
  if (campaign.targetDate) infoLines.push(`วันเป้าหมาย: ${campaign.targetDate}`)

  const entryLines = entries
    .slice(-30)
    .map(e => `${e.date}: spend=${e.spendTon.toFixed(3)}TON views=${e.views} clicks=${e.clicks} joins=${e.joins}`)
    .join('\n')

  const schemaHint = '{"status":"...","immediate":["..."],"weekly":["..."],"monthly":["..."],"assumptions":["..."]}'

  const user = [
    'วิเคราะห์แคมเปญนี้แบบเจาะลึก:',
    '',
    infoLines.join('\n'),
    '',
    'ข้อมูลรายวัน 30 วันล่าสุด:',
    entryLines || 'ไม่มีข้อมูล',
    '',
    `ตอบกลับ JSON เท่านั้น ไม่มี field เพิ่มเติม: ${schemaHint}`,
  ].join('\n')

  return { system: systemLines.join('\n'), user }
}

export function parseAnalysisResult(content: string): AnalysisResult {
  const parsed = JSON.parse(content)
  if (
    typeof parsed.status !== 'string' ||
    !Array.isArray(parsed.immediate) ||
    !Array.isArray(parsed.weekly) ||
    !Array.isArray(parsed.monthly) ||
    !Array.isArray(parsed.assumptions)
  ) {
    throw new Error('Invalid analysis result structure')
  }
  return parsed as AnalysisResult
}
