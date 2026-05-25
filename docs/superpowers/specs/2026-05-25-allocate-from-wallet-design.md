# Design: Allocate Budget from Wallet Page

Date: 2026-05-25

## Goal

Allow user to allocate TON budget directly from the Wallet page to any campaign that has no allocation yet, without having to navigate to each campaign's detail page. Allocated amount then appears on the campaign card on Dashboard.

## Scope

- Add inline allocation form on each deposit card (Wallet page)
- Extend allocation API to accept a specific `depositId`
- Show allocation info on campaign cards (Dashboard)

Out of scope: multiple allocations per campaign, editing existing allocations from wallet page (handled by campaign detail page already).

## Data Model

No schema changes needed. Existing `CampaignAllocation` model:
- `depositId` — which deposit funds came from
- `campaignId` — unique (1 campaign = 1 allocation)
- `amountTon` — amount allocated

## Architecture & Components

### 1. `WalletPage` (server component) — `src/app/wallet/page.tsx`

Add a second Prisma query to fetch campaigns with no allocation:
```ts
const unallocatedCampaigns = await prisma.campaign.findMany({
  where: { allocation: null },
  select: { id: true, name: true, status: true },
  orderBy: { createdAt: 'desc' },
})
```
Pass `availableCampaigns` to `WalletClient`.

### 2. `WalletClient` — `src/app/wallet/wallet-client.tsx`

- Accept new prop `availableCampaigns: Array<{ id: string; name: string; status: string }>`
- On each deposit card: if `d.remaining > 0` and `availableCampaigns.length > 0`, show "+ จัดสรร" button
- `allocatingDepositId: string | null` state — controls which deposit has the inline form open
- Render `<AllocateForm>` inside the deposit card when open

### 3. `AllocateForm` (new component) — `src/app/wallet/allocate-form.tsx`

Props:
```ts
{
  depositId: string
  maxTon: number          // deposit.remaining
  campaigns: Array<{ id: string; name: string; status: string }>
  onCancel: () => void
}
```

Fields:
- `<select>` — campaign dropdown (grouped label shows status if not ACTIVE)
- `<Input type="number">` — จำนวน TON (max = `maxTon`, step = 0.0001)
- Submit button

On submit: `POST /api/campaigns/[campaignId]/allocation` with `{ amountTon, depositId }`

On success: `router.refresh()` + `onCancel()`

Error states: INSUFFICIENT_BALANCE, campaign already has allocation (filtered out in dropdown so shouldn't happen), generic error.

### 4. `POST /api/campaigns/[id]/allocation` — `src/app/api/campaigns/[id]/allocation/route.ts`

Change: accept optional `depositId` in request body.

Logic:
- If `depositId` provided → use that specific deposit (validate it exists and has sufficient remaining)
- If `depositId` not provided → fall back to existing FIFO logic (backwards compat for AllocationCard on campaign detail page)

Validation when `depositId` provided:
```ts
const deposit = await prisma.walletDeposit.findUnique({
  where: { id: depositId },
  include: { allocations: true },
})
if (!deposit) return 404
const remaining = Number(deposit.amountTon) - deposit.allocations.reduce(...)
if (remaining < amountTon) return 400 INSUFFICIENT_BALANCE
// then create allocation pinned to this deposit
```

### 5. `DashboardPage` — `src/app/page.tsx`

Add `allocation: true` to campaigns include:
```ts
prisma.campaign.findMany({
  include: {
    entries: { orderBy: { date: 'asc' } },
    allocation: true,   // ← add this
  },
  ...
})
```

### 6. `CampaignCard` — `src/components/campaign-card.tsx`

Add allocation display below the budget section:
```tsx
{campaign.allocation && (
  <p className="text-xs text-blue-400">
    จัดสรร {Number(campaign.allocation.amountTon).toFixed(2)} TON
  </p>
)}
```

## Data Flow

```
User clicks "+ จัดสรร" on deposit card
  → AllocateForm opens inline (same card)
  → User picks campaign from dropdown, enters amount
  → POST /api/campaigns/[id]/allocation { amountTon, depositId }
  → API validates: deposit exists, sufficient remaining, campaign has no existing allocation
  → Creates CampaignAllocation record
  → router.refresh() reloads WalletPage data
  → Deposit card now shows "จัดสรรให้: [campaign] · X TON"
  → Campaign card on Dashboard shows "จัดสรร X TON" (after next navigation/refresh)
```

## Error Handling

| Error | User-facing message |
|---|---|
| INSUFFICIENT_BALANCE | "ยอดคงเหลือใน deposit ไม่พอ" |
| Campaign already allocated | ไม่เกิด (กรองออกจาก dropdown แล้ว) |
| Generic server error | "จัดสรรไม่สำเร็จ ลองใหม่อีกครั้ง" |

## Files to Create/Modify

| File | Action |
|---|---|
| `src/app/wallet/allocate-form.tsx` | Create |
| `src/app/wallet/wallet-client.tsx` | Modify |
| `src/app/wallet/page.tsx` | Modify |
| `src/app/api/campaigns/[id]/allocation/route.ts` | Modify |
| `src/app/page.tsx` | Modify |
| `src/components/campaign-card.tsx` | Modify |

No schema migration needed.
