'use client'

import { useState } from 'react'
import { EntryForm } from '@/components/entry-form'
import { CsvImport } from '@/components/csv-import'

export function TabsClient({ campaignId, targetType, defaultDailyBudget, allocationRate }: {
  campaignId: string
  targetType: string
  defaultDailyBudget?: string
  allocationRate?: { tonPriceUsd: number; usdThbRate: number }
}) {
  const [tab, setTab] = useState<'manual' | 'csv'>('manual')

  return (
    <div className="space-y-4">
      <div className="flex gap-1 border-b">
        <button
          onClick={() => setTab('manual')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'manual' ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          กรอกเอง
        </button>
        <button
          onClick={() => setTab('csv')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'csv' ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Import CSV
        </button>
      </div>

      {tab === 'manual' ? (
        <EntryForm campaignId={campaignId} targetType={targetType} defaultDailyBudget={defaultDailyBudget} allocationRate={allocationRate} />
      ) : (
        <CsvImport campaignId={campaignId} targetType={targetType} defaultDailyBudget={defaultDailyBudget} allocationRate={allocationRate} />
      )}
    </div>
  )
}
