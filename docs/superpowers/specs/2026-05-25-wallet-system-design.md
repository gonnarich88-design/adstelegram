# Wallet System Design
**Date:** 2026-05-25
**Status:** Approved

---

## 1. Overview

Implement a TON wallet system that tracks cost-basis at deposit time. When a user buys TON, the exchange rate is locked. All campaign spend calculations use the rate from the deposit that funded them, not the live rate at time of spend.

**Business context:** User buys TON once, allocates it to one or more campaigns, spends it down, then buys again. This is a single-deposit-at-a-time pattern — overlapping deposits are possible but rare.

---

## 2. Data Model

### New: `WalletDeposit`
```prisma
model WalletDeposit {
  id            String               @id @default(cuid())
  amountTon     Decimal              @db.Decimal(18, 8)
  tonPriceUsd   Decimal              @db.Decimal(18, 8)
  usdThbRate    Decimal              @db.Decimal(18, 8)
  depositedAt   DateTime
  note          String?
  createdAt     DateTime             @default(now())
  allocations   CampaignAllocation[]
}
```

### New: `CampaignAllocation`
```prisma
model CampaignAllocation {
  id          String        @id @default(cuid())
  depositId   String
  campaignId  String
  amountTon   Decimal       @db.Decimal(18, 8)
  createdAt   DateTime      @default(now())
  deposit     WalletDeposit @relation(fields: [depositId], references: [id])
  campaign    Campaign      @relation(fields: [campaignId], references: [id], onDelete: Cascade)

  @@unique([depositId, campaignId])
}
```

**Notes:**
- `Campaign` gets a new `allocations CampaignAllocation[]` relation
- `AppSettings` model is **dropped entirely** — `walletBalanceTon` was its only meaningful field, now computed

### Computed wallet balance
```
balance = SUM(WalletDeposit.amountTon) - SUM(CampaignAllocation.amountTon)
```

---

## 3. Rate Logic

### Rate source priority for a campaign entry:
1. **Has allocation?** → Use the deposit's `tonPriceUsd` / `usdThbRate` (locked cost-basis)
2. **No allocation?** → Use live rate auto-fetched from API (backward compat)

### "Current rate" for Wallet page display:
- Defined as the **oldest deposit with remaining balance** (FIFO-consistent)
- Formula: `remaining = deposit.amountTon - SUM(allocations.amountTon)` — show first deposit where `remaining > 0`
- This is the same rate that will apply to the next allocation

### FIFO allocation rule:
- When allocating TON from wallet → campaign, allocate from the **oldest deposit first**
- Since user typically runs one deposit at a time, there will usually be exactly one deposit with remaining balance

---

## 4. Migration & Backward Compatibility

### ⚠️ Data loss warning (AppSettings drop):
- Existing `walletBalanceTon` stored in `AppSettings` (id=1) will be **permanently lost** when this migration runs
- **Manual step required after deploy:** Create the first `WalletDeposit` record via the new /wallet page to re-establish wallet state
- Old balances cannot be auto-migrated because deposit rate/date is unknown

### Backward compat for existing campaigns:
- Campaigns with no `CampaignAllocation` continue working unchanged
- Entry form and CSV import fall back to live rates for these campaigns
- No data migration needed for existing `PerformanceEntry` records

### Export/Import versioning:
- Export v1 → `{ version: 1, walletBalanceTon?, campaigns[] }` — still importable, walletBalanceTon silently ignored
- Export v2 → `{ version: 2, walletDeposits[], campaignAllocations[], campaigns[] }` — full wallet state preserved

---

## 5. New API Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/wallet/balance` | `{ totalDeposited, totalAllocated, balance, currentRate }` |
| GET | `/api/wallet/deposits` | List all deposits with allocations |
| POST | `/api/wallet/deposits` | Create new deposit |
| DELETE | `/api/wallet/deposits/[id]` | Delete deposit (only if no allocations) |
| GET | `/api/campaigns/[id]/allocation` | Get campaign's current allocation |
| POST | `/api/campaigns/[id]/allocation` | Create/update allocation |
| DELETE | `/api/campaigns/[id]/allocation` | Remove allocation |

---

## 6. UI — New /wallet Page

**Nav link:** Dashboard | + Campaign | **Wallet** | Settings | Logout

### Wallet page layout:
```
┌──────────────────────────────────────────────────┐
│  TON Wallet                    [+ ฝากเงิน]       │
│  Balance: 1,234.5 TON                             │
│  Current rate: 1 TON = $3.21 / ฿105.50           │
│  (oldest deposit with remaining balance)          │
├──────────────────────────────────────────────────┤
│  Deposit History                                  │
│  ┌────────────────────────────────────────────┐  │
│  │ 2026-05-20  2,000 TON  $3.21  ฿105.50     │  │
│  │   allocated: 1,234.5 TON → Campaign A     │  │
│  │   remaining: 765.5 TON              [ลบ]  │  │
│  └────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘
```

### Deposit form (+ ฝากเงิน):
- Amount TON (required)
- Date (required, default today — allows backfill)
- TON/USD rate — auto-fetched via `/api/rates/historical?from=date&to=date`, editable
- USD/THB rate — same auto-fetch, editable
- Note (optional)

---

## 7. UI — Campaign Allocation

Allocation is managed from the **Campaign detail page** (not wallet page) to reduce navigation friction.

### On campaign detail page (when no allocation):
```
┌─────────────────────────────────────────────────┐
│ ⚠ Campaign นี้ยังไม่ได้จัดสรรงบจาก Wallet       │
│ [จัดสรรงบ]                                       │
└─────────────────────────────────────────────────┘
```

### Allocation modal/form:
- Campaign name (read-only)
- Amount TON (required)
- Rate shown (locked from oldest deposit with balance): `1 TON = $X.XX / ฿X.XX`
- [ยืนยันจัดสรร]

### After allocation:
```
งบจาก Wallet: 1,234.5 TON  ·  1 TON = $3.21 / ฿105.50
[แก้ไขจัดสรร]  [ลบจัดสรร]
```

---

## 8. Entry Form & CSV Import Changes

### `EntryForm` new props:
```ts
allocationRate?: { tonPriceUsd: number, usdThbRate: number }
```
- When provided: pre-fills rate fields as read-only, shows "อัตราจาก Wallet Deposit"
- When absent: auto-fetch live rates as before

### `CsvImport` new props:
```ts
allocationRate?: { tonPriceUsd: number, usdThbRate: number }
```
- When provided: skips `/api/rates/historical` fetch entirely, uses fixed rate for all rows
- Shows info: "ใช้อัตราจาก Wallet Deposit: 1 TON = $X.XX / ฿X.XX"
- When absent: historical per-day fetch as before

### CSV single-deposit pattern note:
User buys TON once and uses it up before buying again. Therefore using a single locked rate for all CSV rows in one import is correct — all that spend came from the same deposit.

### Rate source in `tabs-client.tsx`:
```tsx
// From campaign's allocation → deposit
allocationRate={allocation ? {
  tonPriceUsd: Number(allocation.deposit.tonPriceUsd),
  usdThbRate: Number(allocation.deposit.usdThbRate),
} : undefined}
```

---

## 9. Dashboard Changes

**Remove:** Wallet card (balance/burn rate/days remaining) that currently reads from AppSettings

**Add:** Wallet summary card that reads from computed balance:
- Balance: X TON remaining
- Current rate (oldest deposit with remaining balance)
- Link to /wallet

---

## 10. Files to Create

| File | Description |
|------|-------------|
| `src/app/wallet/page.tsx` | Wallet page (Server Component) |
| `src/app/wallet/deposit-form.tsx` | Deposit form (Client Component) |
| `src/app/api/wallet/balance/route.ts` | GET balance + current rate |
| `src/app/api/wallet/deposits/route.ts` | GET list / POST create |
| `src/app/api/wallet/deposits/[id]/route.ts` | DELETE deposit |
| `src/app/api/campaigns/[id]/allocation/route.ts` | GET / POST / DELETE allocation |
| `prisma/migrations/YYYYMMDD_wallet_system/` | Auto-generated by `prisma migrate dev` |

---

## 11. Files to Modify

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add WalletDeposit, CampaignAllocation; remove AppSettings; add relation to Campaign |
| `src/lib/export.ts` | Bump version to 2; add walletDeposits + campaignAllocations; remove AppSettings |
| `src/components/nav.tsx` | Add Wallet link |
| `src/app/page.tsx` | Replace AppSettings query with computed wallet balance query |
| `src/app/settings/page.tsx` | Remove wallet balance card, keep Export/Import only |
| `src/app/campaigns/[id]/page.tsx` | Fetch allocation + pass allocationRate to entries page |
| `src/app/campaigns/[id]/entries/new/page.tsx` | Fetch allocation; pass allocationRate |
| `src/app/campaigns/[id]/entries/new/tabs-client.tsx` | Accept + forward allocationRate prop |
| `src/components/entry-form.tsx` | Accept allocationRate prop; lock rate fields when provided |
| `src/components/csv-import.tsx` | Accept allocationRate prop; skip historical fetch when provided |
| `tests/export.test.ts` | Remove AppSettings mock; add walletDeposit/allocation mocks; expect version 2 |

---

## 12. Files to Delete

| File | Reason |
|------|--------|
| `src/app/api/settings/route.ts` | AppSettings removed |

---

## 13. Out of Scope

- Multi-deposit blending / partial FIFO across multiple deposits
- Allocation from CSV import step (must be done separately before import)
- TON withdrawal tracking
- Role-based access (remains single-user)
