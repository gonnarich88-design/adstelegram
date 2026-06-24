import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { MapPin, ExternalLink } from 'lucide-react'
import { PlacementsClient } from './placements-client'

export const dynamic = 'force-dynamic'

const STATUS_CLASS: Record<string, string> = {
  ACTIVE: 'bg-green-600 text-white hover:bg-green-600',
  PAUSED: 'bg-secondary text-secondary-foreground hover:bg-secondary',
  STOPPED: 'bg-yellow-500 text-black hover:bg-yellow-500',
  DONE: 'border border-border bg-transparent text-foreground',
  CANCELLED: 'bg-destructive text-white hover:bg-destructive',
}

const TYPE_LABEL: Record<string, string> = {
  CHANNEL: 'Channels',
  BOT: 'Bots',
  SEARCH: 'Search',
}

export default async function PlacementsPage() {
  const placements = await prisma.placement.findMany({
    include: {
      campaigns: {
        include: {
          campaign: {
            select: {
              id: true,
              name: true,
              status: true,
              targetType: true,
            },
          },
        },
        orderBy: { campaign: { createdAt: 'desc' } },
      },
    },
    orderBy: { name: 'asc' },
  })

  const serialized = placements.map(p => ({
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">ปลายทาง</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            ช่อง / หัวข้อที่ ads ไปแสดง — {placements.length} ปลายทาง
          </p>
        </div>
      </div>

      {placements.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <MapPin className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm">ยังไม่มีปลายทาง</p>
          <p className="text-xs mt-1">เพิ่มปลายทางได้จากหน้าสร้าง / แก้ไข Campaign</p>
        </div>
      ) : (
        <PlacementsClient placements={serialized} statusClass={STATUS_CLASS} typeLabel={TYPE_LABEL} />
      )}
    </div>
  )
}
