import { prisma } from '@/lib/prisma'
import { PlacementsClient } from './placements-client'

export const dynamic = 'force-dynamic'

const STATUS_CLASS: Record<string, string> = {
  ACTIVE: 'bg-green-600 text-white hover:bg-green-600',
  PAUSED: 'bg-secondary text-secondary-foreground hover:bg-secondary',
  STOPPED: 'bg-yellow-500 text-black hover:bg-yellow-500',
  DONE: 'border border-border bg-transparent text-foreground',
  CANCELLED: 'bg-destructive text-white hover:bg-destructive',
}

// Telegram bot usernames ต้องมี "bot" ตาม naming convention
function inferPlacementType(name: string, explicit: string | null): 'CHANNEL' | 'BOT' | 'SEARCH' {
  if (explicit === 'CHANNEL' || explicit === 'BOT' || explicit === 'SEARCH') return explicit
  return /bot/i.test(name) ? 'BOT' : 'CHANNEL'
}

export type CampaignRow = { id: string; name: string; status: string; targetType: string }
export type PlacementItem = {
  id: string; name: string; type: string | null; note: string | null; createdAt: string
  campaigns: CampaignRow[]
}
export type LegacyItem = { name: string; campaigns: CampaignRow[] }
export type Section = { typeKey: string; m2m: PlacementItem[]; legacy: LegacyItem[] }

export default async function PlacementsPage() {
  const [placements, legacyCampaigns] = await Promise.all([
    prisma.placement.findMany({
      include: {
        campaigns: {
          include: { campaign: { select: { id: true, name: true, status: true, targetType: true } } },
          orderBy: { campaign: { createdAt: 'desc' } },
        },
      },
      orderBy: { name: 'asc' },
    }),
    prisma.campaign.findMany({
      where: { placementName: { not: null }, placements: { none: {} } },
      select: { id: true, name: true, status: true, targetType: true, placementName: true, placementType: true },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  // Group M2M placements by type
  const m2mByType: Record<string, PlacementItem[]> = { CHANNEL: [], BOT: [], SEARCH: [], OTHER: [] }
  for (const p of placements) {
    const t = inferPlacementType(p.name, p.type)
    if (!m2mByType[t]) m2mByType[t] = []
    m2mByType[t].push({
      id: p.id, name: p.name, type: p.type ?? null, note: p.note ?? null,
      createdAt: p.createdAt.toISOString(),
      campaigns: p.campaigns.map(cp => ({
        id: cp.campaign.id, name: cp.campaign.name,
        status: cp.campaign.status, targetType: cp.campaign.targetType,
      })),
    })
  }

  // Group legacy campaigns by placementName, then by inferred type
  const legacyByType: Record<string, Record<string, CampaignRow[]>> = {
    CHANNEL: {}, BOT: {}, SEARCH: {}, OTHER: {},
  }
  for (const c of legacyCampaigns) {
    const pName = c.placementName!
    const pType = inferPlacementType(pName, c.placementType ?? null)
    if (!legacyByType[pType][pName]) legacyByType[pType][pName] = []
    legacyByType[pType][pName].push({ id: c.id, name: c.name, status: c.status, targetType: c.targetType })
  }

  // Build sections in order
  const TYPE_ORDER = ['CHANNEL', 'BOT', 'SEARCH', 'OTHER'] as const
  const sections: Section[] = TYPE_ORDER
    .map(t => ({
      typeKey: t,
      m2m: m2mByType[t] ?? [],
      legacy: Object.entries(legacyByType[t] ?? {})
        .map(([name, campaigns]) => ({ name, campaigns }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    }))
    // CHANNEL/BOT/SEARCH โชว์เสมอ (มีปุ่มเพิ่มปลายทางท้ายหมวด) OTHER โชว์เฉพาะตอนมีข้อมูลจริง
    .filter(s => s.typeKey === 'OTHER' ? s.m2m.length + s.legacy.length > 0 : true)

  const total = placements.length + Object.values(legacyByType).reduce(
    (sum, g) => sum + Object.keys(g).length, 0
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">ปลายทาง</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            ช่อง / หัวข้อที่ ads ไปแสดง — {total} ปลายทาง
          </p>
        </div>
      </div>

      <PlacementsClient sections={sections} statusClass={STATUS_CLASS} />
    </div>
  )
}
