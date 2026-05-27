import { notFound } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { calcAggregateMetrics } from '@/lib/metrics'
import { computeWalletBalance, findCurrentRate } from '@/lib/wallet'
import { MetricCards } from '@/components/metric-cards'
import { PerformanceTable } from '@/components/performance-table'
import { AllocationCard } from '@/components/allocation-card'
import { buttonVariants } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { RefundButton } from './refund-button'

export const dynamic = 'force-dynamic'

const STATUS_COLORS = { ACTIVE: 'default', PAUSED: 'secondary', STOPPED: 'secondary', DONE: 'outline', CANCELLED: 'destructive' } as const

export default async function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const [campaign, walletDeposits] = await Promise.all([
    prisma.campaign.findUnique({
      where: { id },
      include: {
        entries: { orderBy: { date: 'desc' } },
        allocations: { include: { deposit: true }, orderBy: { allocatedAt: 'asc' } },
      },
    }),
    prisma.walletDeposit.findMany({
      include: { allocations: true },
      orderBy: { depositedAt: 'asc' },
    }),
  ])

  if (!campaign) notFound()

  const campaignDailyBudget = Number(campaign.dailyBudgetTon)

  const allAllocations = walletDeposits.flatMap(d =>
    d.allocations.map(a => ({ depositId: a.depositId, amountTon: Number(a.amountTon) }))
  )
  const depositsNormalized = walletDeposits.map(d => ({
    id: d.id,
    amountTon: Number(d.amountTon),
    depositedAt: d.depositedAt,
    tonPriceUsd: Number(d.tonPriceUsd),
    usdThbRate: Number(d.usdThbRate),
  }))

  const walletBalance = computeWalletBalance(depositsNormalized, allAllocations)
  const currentRate = findCurrentRate(depositsNormalized, allAllocations)

  const totalSpendTon = campaign.entries.reduce((sum, e) => sum + Number(e.spendTon), 0)
  const totalAllocatedTon = campaign.allocations.reduce((s, a) => s + Number(a.amountTon), 0)
  const estimatedRefundTon = Math.max(0, totalAllocatedTon - totalSpendTon)

  if (campaign.status === 'ACTIVE' && totalAllocatedTon > 0 && totalSpendTon >= totalAllocatedTon) {
    await prisma.campaign.update({ where: { id }, data: { status: 'STOPPED' } })
    ;(campaign as { status: string }).status = 'STOPPED'
  }

  const lastAllocation = campaign.allocations.at(-1)
  const allocationForCard = campaign.allocations.length > 0
    ? {
        totalAmountTon: campaign.allocations.reduce((s, a) => s + Number(a.amountTon), 0),
        count: campaign.allocations.length,
        tonPriceUsd: Number(lastAllocation!.deposit.tonPriceUsd),
        usdThbRate: Number(lastAllocation!.deposit.usdThbRate),
        totalSpendTon,
      }
    : null

  const entriesForCalc = campaign.entries.map(e => ({
    spendTon: Number(e.spendTon),
    dailyBudgetTon: campaignDailyBudget || Number(e.dailyBudgetTon),
    tonPriceUsd: Number(e.tonPriceUsd),
    usdThbRate: Number(e.usdThbRate),
    impressions: e.impressions,
    views: e.views,
    clicks: e.clicks,
    joins: e.joins,
  }))

  const metrics = entriesForCalc.length > 0 ? calcAggregateMetrics(entriesForCalc) : null

  const serializedEntries = campaign.entries.map(e => ({
    id: e.id,
    campaignId: e.campaignId,
    date: e.date.toISOString(),
    spendTon: Number(e.spendTon),
    dailyBudgetTon: Number(e.dailyBudgetTon),
    tonPriceUsd: Number(e.tonPriceUsd),
    usdThbRate: Number(e.usdThbRate),
    impressions: e.impressions,
    views: e.views,
    clicks: e.clicks,
    joins: e.joins,
    note: e.note,
  }))

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold">{campaign.name}</h1>
            <Badge variant={STATUS_COLORS[campaign.status as keyof typeof STATUS_COLORS]}>
              {campaign.status}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            โปรโมต: {campaign.targetType} · {campaign.targetName} ·{' '}
            เริ่ม {new Date(campaign.startDate).toLocaleDateString('th-TH')}
            {campaign.endDate && ` — ${new Date(campaign.endDate).toLocaleDateString('th-TH')}`}
          </p>
          {campaign.placementName && (
            <p className="text-sm text-muted-foreground">ปลายทาง: {campaign.placementName}</p>
          )}
          <p className="text-sm text-muted-foreground">
            Daily Budget: {Number(campaign.dailyBudgetTon).toFixed(2)} TON/วัน
            {campaign.budgetTon && ` · งบรวม: ${Number(campaign.budgetTon).toFixed(2)} TON`}
          </p>
          {campaign.bidCpmTon && Number(campaign.bidCpmTon) > 0 && (
            <p className="text-sm text-muted-foreground">
              CPM Bid: {Number(campaign.bidCpmTon).toFixed(4)} TON{' '}
              · ~{Math.round((Number(campaign.dailyBudgetTon) / Number(campaign.bidCpmTon)) * 1000).toLocaleString('th-TH')} imp/วัน
            </p>
          )}
          {campaign.note && <p className="text-sm text-muted-foreground mt-1">{campaign.note}</p>}
        </div>
        <div className="flex gap-2 flex-wrap">
          <RefundButton
            campaignId={id}
            status={campaign.status}
            estimatedRefundTon={estimatedRefundTon}
          />
          <Link href={`/campaigns/${id}/edit`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>แก้ไข</Link>
          {campaign.status !== 'CANCELLED' && (
            <Link href={`/campaigns/${id}/entries/new`} className={buttonVariants({ size: 'sm' })}>+ บันทึกวันนี้</Link>
          )}
        </div>
      </div>

      <AllocationCard
        campaignId={id}
        allocation={allocationForCard}
        walletBalance={walletBalance}
        currentRate={currentRate}
      />

      {metrics ? (
        <MetricCards metrics={metrics} />
      ) : (
        <p className="text-sm text-muted-foreground">ยังไม่มีข้อมูล performance</p>
      )}

      <div>
        <h2 className="text-lg font-semibold mb-3">Performance Log</h2>
        <PerformanceTable entries={serializedEntries} targetType={campaign.targetType} campaignDailyBudget={campaignDailyBudget} campaignId={id} />
      </div>
    </div>
  )
}
