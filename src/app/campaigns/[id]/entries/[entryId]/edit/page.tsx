import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { EntryForm } from '@/components/entry-form'

export const dynamic = 'force-dynamic'

export default async function EditEntryPage({
  params,
}: {
  params: Promise<{ id: string; entryId: string }>
}) {
  const { id, entryId } = await params

  const [entry, campaign] = await Promise.all([
    prisma.performanceEntry.findUnique({ where: { id: entryId } }),
    prisma.campaign.findUnique({ where: { id } }),
  ])

  if (!entry || !campaign || entry.campaignId !== id) notFound()

  const serialized = {
    date: entry.date.toISOString(),
    spendTon: Number(entry.spendTon),
    dailyBudgetTon: Number(entry.dailyBudgetTon),
    tonPriceUsd: Number(entry.tonPriceUsd),
    usdThbRate: Number(entry.usdThbRate),
    impressions: entry.impressions,
    views: entry.views,
    clicks: entry.clicks,
    joins: entry.joins,
    note: entry.note,
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">แก้ไข Entry</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {campaign.name} ·{' '}
          {new Date(entry.date).toLocaleDateString('th-TH', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </p>
      </div>
      <EntryForm
        campaignId={id}
        targetType={campaign.targetType}
        defaultDailyBudget={String(Number(campaign.dailyBudgetTon))}
        entry={serialized}
        entryId={entryId}
      />
    </div>
  )
}
