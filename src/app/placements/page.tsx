import { prisma } from '@/lib/prisma'
import { MapPin } from 'lucide-react'
import { PlacementsClient } from './placements-client'

export const dynamic = 'force-dynamic'

const STATUS_CLASS: Record<string, string> = {
  ACTIVE: 'bg-green-600 text-white hover:bg-green-600',
  PAUSED: 'bg-secondary text-secondary-foreground hover:bg-secondary',
  STOPPED: 'bg-yellow-500 text-black hover:bg-yellow-500',
  DONE: 'border border-border bg-transparent text-foreground',
  CANCELLED: 'bg-destructive text-white hover:bg-destructive',
}

export default async function PlacementsPage() {
  const [placements, legacyCampaigns] = await Promise.all([
    prisma.placement.findMany({
      include: {
        campaigns: {
          include: {
            campaign: { select: { id: true, name: true, status: true, targetType: true } },
          },
          orderBy: { campaign: { createdAt: 'desc' } },
        },
      },
      orderBy: { name: 'asc' },
    }),
    prisma.campaign.findMany({
      where: { placementName: { not: null }, placements: { none: {} } },
      select: {
        id: true, name: true, status: true, targetType: true,
        placementName: true, placementType: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  const serializedPlacements = placements.map(p => ({
    id: p.id,
    name: p.name,
    type: p.type ?? null,
    note: p.note ?? null,
    createdAt: p.createdAt.toISOString(),
    campaigns: p.campaigns.map(cp => ({
      id: cp.campaign.id,
      name: cp.campaign.name,
      status: cp.campaign.status,
      targetType: cp.campaign.targetType,
    })),
  }))

  // infer type จาก URL — Telegram bots ต้องมีคำว่า "bot" ใน username เสมอ
  function inferType(name: string, explicit: string | null): string {
    if (explicit) return explicit
    return /bot/i.test(name) ? 'BOT' : 'CHANNEL'
  }

  // Group legacy campaigns by placementName, infer type from campaigns
  const legacyMap: Record<string, {
    campaigns: { id: string; name: string; status: string; targetType: string }[]
    type: string
  }> = {}
  for (const c of legacyCampaigns) {
    const key = c.placementName!
    if (!legacyMap[key]) legacyMap[key] = {
      campaigns: [],
      type: inferType(c.placementName!, c.placementType ?? null),
    }
    legacyMap[key].campaigns.push({ id: c.id, name: c.name, status: c.status, targetType: c.targetType })
  }
  const legacyGroups = Object.entries(legacyMap)
    .map(([name, { campaigns, type }]) => ({ name, campaigns, type }))
    .sort((a, b) => a.name.localeCompare(b.name))

  const total = placements.length + legacyGroups.length

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

      {total === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <MapPin className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm">ยังไม่มีปลายทาง</p>
          <p className="text-xs mt-1">เพิ่มปลายทางได้จากหน้าสร้าง / แก้ไข Campaign</p>
        </div>
      ) : (
        <PlacementsClient
          placements={serializedPlacements}
          legacyGroups={legacyGroups}
          statusClass={STATUS_CLASS}
        />
      )}
    </div>
  )
}
