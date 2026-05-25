# Wallet: Flat Transaction List + allocatedAt

Date: 2026-05-25
Status: Approved

## Goal

1. เพิ่ม `allocatedAt` field ใน `CampaignAllocation` เพื่อให้ผู้ใช้บันทึกวันที่จัดสรรจริงได้
2. Redesign หน้า `/wallet` จาก deposit cards เป็น flat transaction list สไตล์ Telegram Fragment (dark mode)

---

## Schema Change

**`CampaignAllocation`** เพิ่มหนึ่ง field:

```prisma
allocatedAt  DateTime  @default(now())
```

- non-destructive: row เดิมได้ `now()` ของเวลา migrate
- migration name: `20260525000001_add_allocation_date`

---

## Data Flow

### WalletPage (server component)
- serialize `allocatedAt` ใน allocation objects ส่งไป `WalletClient`

### API: POST `/api/campaigns/[id]/allocation`
- รับ `allocatedAt?: string` (ISO date string) — ถ้าไม่ส่งมา default เป็น `new Date()`
- ส่งไป `prisma.campaignAllocation.create/update`

### API: GET `/api/wallet/deposits`
- เพิ่ม `allocatedAt` ใน allocation response

---

## UI Design (Dark Mode Flat List)

### Layout หน้า `/wallet`

```
┌──────────────────────────────────────┐
│ TON Wallet              [+ ฝากเงิน] │
│ 10.0000 TON                          │
│ 1 TON = $1.534 / ฿31.11 (rate note) │
└──────────────────────────────────────┘

ประวัติ                    [+ จัดสรร]
────────────────────────────────────────
[↑] ฝากเงิน · note        +20.0000  28 ม.ค.
    คงเหลือ 10.0000 TON    [ลบ]*
[→] bot v1 ads             −10.0000  25 พ.ค.
[→] Bot_ch v6               −5.0000  24 พ.ค.

* ปุ่มลบแสดงเฉพาะ deposit ที่ไม่มี allocation
```

### Transaction rows

**Deposit row** (green):
- ไอคอน ↑ (วงกลมเขียว)
- Label: "ฝากเงิน" + note (ถ้ามี) — subtext: "คงเหลือ X.XXXX TON"
- Amount: `+XX.XXXX` สีเขียว
- Date: `depositedAt` (วัน เดือน ปี)
- Action: ปุ่ม "ลบ" เล็กๆ ฝั่งขวา — แสดงเฉพาะ deposit ที่ allocations.length === 0

**Allocation row** (red):
- ไอคอน → (วงกลมแดง)
- Label: campaign name — subtext: "จัดสรรให้ Campaign"
- Amount: `−XX.XXXX` สีแดง
- Date: `allocatedAt`

Sorted: รวมทุก row แล้ว sort desc by date

### AllocateForm (inline, toggle)

แสดงเมื่อคลิก `+ จัดสรร` (ซ่อนถ้า balance = 0 หรือไม่มี unallocated campaigns)

Fields:
- Campaign (dropdown)
- วันที่จัดสรร (type="date", default วันนี้)
- จำนวน TON (max = wallet balance)

POST body: `{ campaignId, amountTon, allocatedAt }` — ไม่ต้องส่ง depositId (ใช้ FIFO)

---

## Files Changed

| File | Change |
|---|---|
| `prisma/schema.prisma` | เพิ่ม `allocatedAt` ใน `CampaignAllocation` |
| `prisma/migrations/20260525000001_add_allocation_date/` | migration ใหม่ |
| `src/app/api/campaigns/[id]/allocation/route.ts` | POST รับ `allocatedAt`; GET expose `allocatedAt` |
| `src/app/api/wallet/deposits/route.ts` | GET เพิ่ม `allocatedAt` ใน allocation response |
| `src/app/wallet/page.tsx` | serialize `allocatedAt` ใน depositsForClient |
| `src/app/wallet/wallet-client.tsx` | redesign ทั้งหมด — flat list, merge deposits+allocations |
| `src/app/wallet/allocate-form.tsx` | เปลี่ยน props (ตัด depositId/maxTon, เพิ่ม balance/allocatedAt) |

---

## What Does NOT Change

- `lib/wallet.ts` (balance calculation, FIFO logic)
- `DepositForm` component
- Dashboard / CampaignCard
- `AllocationCard` บน campaign detail page
- Tests (wallet.test.ts tests lib/wallet.ts functions ไม่ขึ้นกับ allocatedAt)
- Auth, middleware, settings

---

## Edge Cases

- Deposit ที่ allocations เก่าไม่มี `allocatedAt` จริงๆ → ได้ timestamp ตอน migrate (ยอมรับได้)
- `+ จัดสรร` ซ่อนเมื่อ: balance = 0 หรือ availableCampaigns.length = 0
- Delete deposit: แสดงเฉพาะ deposit row ที่ไม่มี allocations (เหมือนเดิม)
- Transaction list ว่าง: แสดง placeholder "ยังไม่มี transaction"
