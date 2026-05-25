# Campaign Refund Design

**Date:** 2026-05-25
**Status:** Approved
**Feature:** บันทึกการยกเลิกแคมเปญและรับเงิน TON คืนจาก Telegram

---

## Context

เมื่อยกเลิกแคมเปญบน Telegram Ads Platform, Telegram จะคืน TON ที่ยังไม่ได้ใช้กลับมาใน wallet
(แสดงเป็น "Returned from the ad X" ใน Telegram wallet history พร้อมยอด TON ที่แน่นอน)

เงินที่ได้คืนจะถูกเก็บไว้ใน wallet ของแอปก่อน แล้วค่อย allocate ไปแคมเปญใหม่ทีหลัง

---

## Approach: WalletDeposit type=REFUND

ใช้ `WalletDeposit` model เดิม เพิ่ม `type` enum เพื่อแยก DEPOSIT ปกติ กับ REFUND
Wallet balance formula ไม่เปลี่ยน: `SUM(deposits) - SUM(allocations)`

---

## Schema Changes

```prisma
enum DepositType {
  DEPOSIT
  REFUND
}

enum CampaignStatus {
  ACTIVE
  PAUSED
  DONE
  CANCELLED   // ใหม่: ยกเลิกก่อนกำหนด ได้เงินคืน
}

model WalletDeposit {
  id                String               @id @default(cuid())
  amountTon         Decimal              @db.Decimal(18, 8)
  tonPriceUsd       Decimal              @db.Decimal(18, 8)
  usdThbRate        Decimal              @db.Decimal(18, 8)
  depositedAt       DateTime             // วันที่โอน/คืนเงิน
  note              String?
  type              DepositType          @default(DEPOSIT)  // ใหม่
  refundCampaignId  String?                                 // ใหม่ (null = deposit ปกติ)
  refundCampaign    Campaign?            @relation("CampaignRefunds", fields: [refundCampaignId], references: [id])
  createdAt         DateTime             @default(now())
  allocations       CampaignAllocation[]
}

model Campaign {
  // ... fields เดิม ...
  refunds  WalletDeposit[]  @relation("CampaignRefunds")  // ใหม่
}
```

**Notes:**
- `type @default(DEPOSIT)` → deposit เดิมทั้งหมดไม่ได้รับผลกระทบ
- `refundCampaignId` nullable → ไม่ต้องแก้โค้ดสร้าง deposit ปกติ
- ตาราง `CampaignAllocation` ไม่เปลี่ยน
- Refund deposit ไม่มี `CampaignAllocation[]` (ไม่ถูก allocate ซ้ำ — มันเพิ่ม balance กลับมาเฉยๆ)

---

## API

### ใหม่: `POST /api/campaigns/[id]/refund`

บันทึก refund และอัปเดต campaign status แบบ atomic

**Request body (Zod validated):**
```ts
{
  amountTon: number    // > 0, ยอดที่ Telegram คืนมา
  tonPriceUsd: number  // > 0, อัตรา ณ วันที่บันทึก
  usdThbRate: number   // > 0, อัตรา ณ วันที่บันทึก
  refundedAt: string   // ISO date, วันที่ Telegram แสดงใน statement
  note?: string
}
```

**Logic:**
```ts
prisma.$transaction([
  prisma.walletDeposit.create({
    data: {
      type: 'REFUND',
      refundCampaignId: id,
      amountTon, tonPriceUsd, usdThbRate,
      depositedAt: refundedAt,
      note
    }
  }),
  prisma.campaign.update({
    where: { id },
    data: {
      // เปลี่ยนเป็น CANCELLED เฉพาะ ACTIVE/PAUSED
      // DONE/CANCELLED → คงเดิม (รองรับ refund ย้อนหลัง)
      status: currentStatus === 'ACTIVE' || currentStatus === 'PAUSED'
        ? 'CANCELLED'
        : currentStatus
    }
  })
])
```

**Response:** `{ deposit: WalletDeposit, campaign: Campaign }`

**Auth:** ตรวจ JWT cookie (เหมือน routes อื่น)

### ไม่เปลี่ยน:
- `GET /api/wallet/balance` — สูตร balance ไม่เปลี่ยน
- `GET/POST /api/wallet/deposits` — deposit ปกติยังใช้ได้เหมือนเดิม
- `DELETE /api/wallet/deposits/[id]` — ลบ refund ผ่าน endpoint เดิม

---

## UI Changes

### Campaign Detail Page
- เพิ่มปุ่ม **"ยกเลิกแคมเปญ"** ที่ header ของหน้า (แสดงเฉพาะ status=ACTIVE หรือ PAUSED)
- กดแล้วเปิด inline form:
  - ยอด TON ที่ได้คืน (required, placeholder = `allocated_total - spent_total` คาดการณ์)
  - วันที่คืนเงิน (date picker, default = วันนี้)
  - อัตรา TON/USD (auto-fetch live, editable)
  - อัตรา USD/THB (auto-fetch live, editable)
  - หมายเหตุ (optional)
  - ปุ่ม [ยืนยัน] [ยกเลิก]
- หลัง submit: status badge เปลี่ยนเป็น `CANCELLED` สีแดง, form หายไป
- Campaign ที่ CANCELLED: read-only — ซ่อน entry form, ซ่อนปุ่ม allocate

### Wallet Page (WalletClient)
Transaction list แสดง refund แถวแยก:
- สีเขียว (เหมือน deposit)
- Icon: ↩ (แตกต่างจาก ↑ ของ deposit ปกติ)
- Label: `+V X.XXX TON — คืนจากแคมเปญ: [ชื่อแคมเปญ]`
- แสดงปุ่ม delete เหมือน deposit ปกติ

### Dashboard / Campaign Card
- เพิ่ม badge `CANCELLED` สีแดง (เหมือน `PAUSED` สีเหลือง แต่ใช้สีแดง)
- Campaign ที่ CANCELLED ยังแสดงในรายการ (ไม่ซ่อน)

---

## Export / Import

Export (`lib/export.ts`):
- เพิ่ม `type` และ `refundCampaignId` ใน WalletDeposit export

Import:
- ถ้า `type` ไม่มีใน JSON เก่า → default เป็น `DEPOSIT`
- ถ้า `refundCampaignId` ไม่มี → default เป็น `null`
- ต้อง import Campaign ก่อน WalletDeposit เพราะ refund มี FK ไปหา campaign

---

## Testing

Tests ใหม่ที่ต้องเพิ่ม:
1. `POST /api/campaigns/[id]/refund` — happy path (ACTIVE → CANCELLED + deposit created)
2. `POST /api/campaigns/[id]/refund` — DONE campaign → status ไม่เปลี่ยน แต่ deposit ถูกสร้าง
3. `POST /api/campaigns/[id]/refund` — validation errors (amountTon ≤ 0, missing fields)
4. Wallet balance includes REFUND type deposits correctly

---

## Files to Create / Modify

| ไฟล์ | การเปลี่ยนแปลง |
|------|---------------|
| `prisma/schema.prisma` | เพิ่ม `DepositType` enum, `CANCELLED` status, fields ใหม่ใน WalletDeposit, relation ใน Campaign |
| `prisma/migrations/...` | migration ใหม่ |
| `src/app/api/campaigns/[id]/refund/route.ts` | สร้างใหม่ |
| `src/app/campaigns/[id]/page.tsx` | เพิ่มปุ่ม + inline form (client component) |
| `src/components/refund-form.tsx` | สร้างใหม่ — inline form สำหรับบันทึก refund |
| `src/components/wallet-client.tsx` | แสดง refund rows ต่างจาก deposit |
| `src/components/campaign-card.tsx` | เพิ่ม CANCELLED badge |
| `lib/export.ts` | include ฟิลด์ใหม่, backward compat ตอน import |
| `tests/` | เพิ่ม test cases ข้างต้น |

---

## Scope ที่ไม่รวม (YAGNI)

- ไม่เพิ่ม filter "ซ่อน CANCELLED" ใน dashboard — แสดงทั้งหมด badge ชัดพอ
- ไม่เปลี่ยนชื่อ field `depositedAt` → ใช้ field เดิม, label ใน UI แสดง "วันที่" เฉยๆ
- ไม่ทำ partial refund (campaign continues) — Telegram ยกเลิกทั้งหมดเสมอ
- ไม่ revert status อัตโนมัติเมื่อลบ refund
