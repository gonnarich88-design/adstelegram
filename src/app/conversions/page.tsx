import { prisma } from '@/lib/prisma'
import { ConversionsClient } from './conversions-client'
import type { ConversionRow } from './conversions-client'

export const dynamic = 'force-dynamic'

export default async function ConversionsPage() {
  const [rawConversions, allEntries, campaigns] = await Promise.all([
    prisma.dailyConversion.findMany({
      orderBy: { date: 'desc' },
      include: {
        breakdowns: {
          include: { campaign: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    }),
    prisma.performanceEntry.findMany({
      select: { date: true, spendTon: true, tonPriceUsd: true, usdThbRate: true },
    }),
    prisma.campaign.findMany({
      select: { id: true, name: true },
      orderBy: { sortOrder: 'asc' },
    }),
  ])

  // Group PerformanceEntry spend by date string (join in JS to avoid DATE vs TIMESTAMP mismatch)
  const spendByDate = new Map<string, number>()
  for (const e of allEntries) {
    const dateStr = e.date.toISOString().slice(0, 10)
    const spendThb = Number(e.spendTon) * Number(e.tonPriceUsd) * Number(e.usdThbRate)
    spendByDate.set(dateStr, (spendByDate.get(dateStr) ?? 0) + spendThb)
  }

  const records: ConversionRow[] = rawConversions.map(r => {
    const dateStr = r.date.toISOString().slice(0, 10)
    const spendThb = spendByDate.has(dateStr) ? spendByDate.get(dateStr)! : null
    const depositAmountThb = Number(r.depositAmountThb)
    return {
      id: r.id,
      date: dateStr,
      registrations: r.registrations,
      depositCount: r.depositCount,
      depositTxCount: r.depositTxCount,
      depositAmountThb,
      note: r.note,
      spendThb,
      cpr: spendThb !== null && r.registrations > 0 ? spendThb / r.registrations : null,
      cpd: spendThb !== null && r.depositCount > 0 ? spendThb / r.depositCount : null,
      breakdowns: r.breakdowns.map(b => ({
        id: b.id,
        campaignId: b.campaignId,
        campaignName: b.campaign.name,
        registrations: b.registrations,
        depositCount: b.depositCount,
        depositTxCount: b.depositTxCount,
        depositAmountThb: Number(b.depositAmountThb),
      })),
    }
  })

  return <ConversionsClient records={records} campaigns={campaigns} />
}
