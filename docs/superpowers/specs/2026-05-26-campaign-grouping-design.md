# Campaign Grouping by Target Type — Design Spec

**Date:** 2026-05-26
**Status:** Approved

## Goal

แบ่งรายการ Campaign บน Dashboard ออกเป็น 2 กลุ่มตาม `targetType`: CHANNEL และ BOT แทนที่ flat grid เดิม

## Scope

แก้ไขเฉพาะ `src/app/page.tsx` — ไม่มีไฟล์ใหม่ ไม่มี Client Component ไม่มี state ใหม่

## Layout

- หัวข้อ section "CHANNEL" แสดงก่อน ตามด้วย "BOT"
- แต่ละ section มี heading + badge จำนวน campaign (เช่น `CHANNEL · 3`)
- campaign cards ภายใน section ยังคงใช้ grid `grid-cols-1 md:grid-cols-2 lg:grid-cols-3` เหมือนเดิม
- ลำดับ campaign ภายใน section คงเดิม (`createdAt: desc`)

## Edge Cases

- **Section ว่าง**: ซ่อน section ที่ไม่มี campaign (ไม่แสดง heading เปล่า)
- **ไม่มี campaign เลย**: แสดง empty state เดิม ("ยังไม่มี campaign")
- **มีแค่ประเภทเดียว**: แสดง section เดียว ไม่มี section ว่าง

## สิ่งที่ไม่เปลี่ยน

- Summary metrics (Total Spend, Active Campaigns, Avg CTR) — รวมทุก campaign เหมือนเดิม
- Wallet card — ไม่แตะ
- `CampaignCard` component — ไม่แตะ
- Prisma query — ไม่แตะ (แค่ filter หลัง fetch)

## Implementation

```tsx
const channelCampaigns = campaigns.filter(c => c.targetType === 'CHANNEL')
const botCampaigns = campaigns.filter(c => c.targetType === 'BOT')
```

แทนที่ flat grid เดิมด้วย:
1. ถ้า `campaigns.length === 0` → empty state เดิม
2. ไม่งั้น → render `channelCampaigns` section (ถ้ามี) แล้ว render `botCampaigns` section (ถ้ามี)
