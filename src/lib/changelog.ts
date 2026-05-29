import { prisma } from './prisma'

export interface ChangeEntry {
  field: string | null
  oldValue?: string | null
  newValue?: string | null
  note?: string | null
}

export async function logCampaignChanges(
  campaignId: string,
  changes: ChangeEntry[]
): Promise<void> {
  if (changes.length === 0) return
  const changedAt = new Date()
  await prisma.campaignChangeLog.createMany({
    data: changes.map(c => ({
      campaignId,
      changedAt,
      field: c.field ?? null,
      oldValue: c.oldValue ?? null,
      newValue: c.newValue ?? null,
      note: c.note ?? null,
    })),
  })
}

const NUMERIC_FIELDS = new Set(['dailyBudgetTon', 'bidCpmTon', 'budgetTon'])
const DATE_FIELDS = new Set(['startDate', 'endDate'])

function normalize(field: string, val: unknown): string | null {
  if (val == null) return null
  if (NUMERIC_FIELDS.has(field)) return Number(val).toFixed(8)
  if (DATE_FIELDS.has(field)) return new Date(val as string).toISOString().slice(0, 10)
  return String(val)
}

export interface CampaignSnapshot {
  name: string
  targetType: string
  targetName: string
  startDate: Date | string
  endDate: Date | string | null
  budgetTon: unknown
  dailyBudgetTon: unknown
  bidCpmTon: unknown
  status: string
  placementName: string | null
  placementType: string | null
}

const WATCHED_FIELDS = [
  'name', 'targetType', 'targetName', 'startDate', 'endDate',
  'budgetTon', 'dailyBudgetTon', 'bidCpmTon', 'status', 'placementName', 'placementType',
] as const

export function diffCampaignFields(
  oldSnap: CampaignSnapshot,
  newSnap: CampaignSnapshot
): ChangeEntry[] {
  const changes: ChangeEntry[] = []
  for (const field of WATCHED_FIELDS) {
    const oldVal = normalize(field, (oldSnap as unknown as Record<string, unknown>)[field])
    const newVal = normalize(field, (newSnap as unknown as Record<string, unknown>)[field])
    if (oldVal !== newVal) {
      changes.push({ field, oldValue: oldVal, newValue: newVal })
    }
  }
  return changes
}
