'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { DepositForm } from './deposit-form'
import { AllocateForm } from './allocate-form'

interface Campaign {
  id: string
  name: string
  status: string
}

interface Deposit {
  id: string
  amountTon: number
  tonPriceUsd: number
  usdThbRate: number
  depositedAt: string
  note: string | null
  remaining: number
  allocations: Array<{ id: string; campaignId: string; campaignName: string; amountTon: number }>
}

export function WalletClient({
  balance,
  currentRate,
  deposits,
  availableCampaigns,
}: {
  balance: number
  currentRate: { tonPriceUsd: number; usdThbRate: number } | null
  deposits: Deposit[]
  availableCampaigns: Campaign[]
}) {
  const router = useRouter()
  const [showDepositForm, setShowDepositForm] = useState(false)
  const [allocatingDepositId, setAllocatingDepositId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function handleDeleteDeposit(id: string) {
    setDeletingId(id)
    try {
      const res = await fetch(`/api/wallet/deposits/${id}`, { method: 'DELETE' })
      if (res.ok) {
        router.refresh()
      } else {
        const data = await res.json()
        alert(data.error ?? 'ลบไม่ได้ — deposit นี้มีการจัดสรรแล้ว')
      }
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">TON Wallet</h1>
          <p className="text-3xl font-bold mt-1">{balance.toFixed(4)} TON</p>
          {currentRate ? (
            <p className="text-sm text-muted-foreground mt-1">
              1 TON = ${currentRate.tonPriceUsd.toFixed(4)} / ฿{currentRate.usdThbRate.toFixed(4)}
              <span className="ml-2 text-xs">(อัตราของ deposit เก่าที่สุดที่ยังมีเงินเหลือ)</span>
            </p>
          ) : (
            <p className="text-sm text-muted-foreground mt-1">ไม่มี deposit ที่มีเงินเหลือ</p>
          )}
        </div>
        <Button onClick={() => { setShowDepositForm(true); setAllocatingDepositId(null) }} disabled={showDepositForm}>
          + ฝากเงิน
        </Button>
      </div>

      {showDepositForm && <DepositForm onCancel={() => setShowDepositForm(false)} />}

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">ประวัติ Deposit</h2>

        {deposits.length === 0 && (
          <p className="text-sm text-muted-foreground">ยังไม่มี deposit</p>
        )}

        {deposits.map(d => (
          <div key={d.id} className="rounded-lg border p-4 space-y-2">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-medium">
                  {new Date(d.depositedAt).toLocaleDateString('th-TH')} · {d.amountTon.toFixed(4)} TON
                </p>
                <p className="text-sm text-muted-foreground">
                  1 TON = ${d.tonPriceUsd.toFixed(4)} / ฿{d.usdThbRate.toFixed(4)}
                </p>
                {d.note && <p className="text-sm text-muted-foreground">{d.note}</p>}
              </div>
              <div className="flex gap-2">
                {d.remaining > 0 && availableCampaigns.length > 0 && allocatingDepositId === null && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setAllocatingDepositId(d.id)}
                  >
                    + จัดสรร
                  </Button>
                )}
                {d.allocations.length === 0 && allocatingDepositId !== d.id && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive"
                    disabled={deletingId === d.id}
                    onClick={() => handleDeleteDeposit(d.id)}
                  >
                    ลบ
                  </Button>
                )}
              </div>
            </div>

            {d.allocations.length > 0 ? (
              <div className="text-sm text-muted-foreground pl-2 border-l-2 border-muted space-y-0.5">
                {d.allocations.map(a => (
                  <p key={a.id}>จัดสรรให้: <span className="text-foreground font-medium">{a.campaignName}</span> · {a.amountTon.toFixed(4)} TON</p>
                ))}
                <p>คงเหลือ: <span className={d.remaining > 0 ? 'text-green-400' : 'text-muted-foreground'}>{d.remaining.toFixed(4)} TON</span></p>
              </div>
            ) : (
              <p className="text-sm text-green-400 pl-2">ยังไม่ได้จัดสรร · คงเหลือ {d.remaining.toFixed(4)} TON</p>
            )}

            {allocatingDepositId === d.id && (
              <AllocateForm
                depositId={d.id}
                maxTon={d.remaining}
                campaigns={availableCampaigns}
                onCancel={() => setAllocatingDepositId(null)}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
