# Design: Edit & Delete PerformanceEntry

> วันที่: 2026-05-24 | Approach: C (Dedicated edit page)

## บริบท

ปัจจุบัน `PerformanceEntry` มีเฉพาะ GET + POST — ไม่มีทางแก้ไขหรือลบข้อมูลที่ลงไปแล้ว
Campaign มี edit page แล้ว (`/campaigns/[id]/edit`) feature นี้ใช้ pattern เดียวกัน

## Scope

- **Edit entry** — แก้ไขทุก field ของ entry ที่มีอยู่ (วันที่, spend, rate, views, clicks, joins, note)
- **Delete entry** — ลบ entry ทิ้ง พร้อม confirmation
- ไม่รวม: bulk edit, bulk delete, soft-delete

## R1 Risk

DELETE เป็น R1 — ข้อมูลที่ลบไปกู้คืนได้ผ่าน JSON backup (Settings → Export) เท่านั้น
Guardrail ที่ตกลง: `window.confirm()` แสดงวันที่ของ entry ก่อนลบ

---

## Architecture

### 1. API Layer

**ไฟล์ใหม่:** `src/app/api/campaigns/[id]/entries/[entryId]/route.ts`

#### PATCH `/api/campaigns/[id]/entries/[entryId]`

- ตรวจว่า entry นั้น `campaignId` ตรงกับ `[id]` ใน URL → คืน `404` ถ้าไม่ตรง (ไม่ใช้ 403 เพื่อไม่ leak existence)
- Validate body: ต้องมี `date`, `spendTon`, `dailyBudgetTon`, `tonPriceUsd`, `usdThbRate`, `views`, `clicks`, `joins`
- `prisma.performanceEntry.update()` แล้วคืน updated entry
- Error → 404 ถ้าหา entry ไม่เจอ, 400 ถ้า field ขาด, 500 ถ้า db ล้มเหลว

#### DELETE `/api/campaigns/[id]/entries/[entryId]`

- ตรวจ ownership เดียวกัน → 404 ถ้าไม่ตรง
- `prisma.performanceEntry.delete()`
- คืน `204 No Content`

**ไม่มี schema migration** — ไม่มี field ใหม่

---

### 2. Edit Page

**ไฟล์ใหม่:** `src/app/campaigns/[id]/entries/[entryId]/edit/page.tsx`

- Server Component, `export const dynamic = 'force-dynamic'`
- ดึง `PerformanceEntry` + `Campaign` จาก Prisma
- Serialize Decimal → `Number()`, Date → `.toISOString()` ก่อนส่งไป Client
- ถ้าหา entry ไม่เจอ → `notFound()`
- Render `<EntryForm>` พร้อม props:
  - `campaignId`, `targetType`, `defaultDailyBudget` (campaign-level fallback)
  - `entry` — ข้อมูล entry ที่ serialize แล้ว (pre-fill)
  - `entryId` — บอก form ว่าเป็น edit mode

---

### 3. EntryForm — Edit Mode

**ไฟล์แก้ไข:** `src/components/entry-form.tsx`

เพิ่ม props optional:
```ts
entry?: {
  date: string       // ISO string
  dailyBudgetTon: number
  spendTon: number
  tonPriceUsd: number
  usdThbRate: number
  views: number
  clicks: number
  joins: number
  note?: string | null
}
entryId?: string
```

พฤติกรรมเมื่อ `entry` + `entryId` ส่งมา (edit mode):
- Initial state ของ `form` ใช้ค่าจาก `entry` ทุก field รวมถึง `dailyBudgetTon` (**ไม่ใช้ `defaultDailyBudget`** — ต้องใช้ค่าจาก entry ที่เก็บไว้จริง)
- **ไม่ auto-fetch rates** ตอน mount (ใช้ rate เดิมจาก entry แต่ยังมีปุ่ม "↻ ดึงอัตโนมัติ")
- `handleSubmit` → `PATCH /api/campaigns/[campaignId]/entries/[entryId]` แทน POST
- หลัง save สำเร็จ → `router.push(`/campaigns/${campaignId}`)` + `router.refresh()` เหมือนเดิม

---

### 4. PerformanceTable — Edit/Delete Buttons

**ไฟล์แก้ไข:** `src/components/performance-table.tsx`

เพิ่ม prop `campaignId: string`

แต่ละแถวข้อมูล (ไม่รวม summary row "รวมเดือน") มีคอลัมน์ actions สุดท้าย:

**Edit button:**
- `<Link href={`/campaigns/${campaignId}/entries/${e.id}/edit`}>`
- icon: `Pencil` จาก lucide-react, ขนาดเล็ก

**Delete button:**
- `window.confirm(`ลบ entry วันที่ ${formattedDate}?`)` ก่อนลบ
- fetch `DELETE /api/campaigns/[campaignId]/entries/[e.id]`
- ปุ่ม disabled ระหว่าง fetch (state `deletingId: string | null`)
- ถ้า API ล้มเหลว → แสดง error message ใต้ตาราง
- ถ้าสำเร็จ → `router.refresh()`
- icon: `Trash2` จาก lucide-react

**ไฟล์แก้ไข:** `src/app/campaigns/[id]/page.tsx`
- ส่ง `campaignId={id}` ไปยัง `<PerformanceTable>`

---

## Files Summary

| Action | File |
|--------|------|
| CREATE | `src/app/api/campaigns/[id]/entries/[entryId]/route.ts` |
| CREATE | `src/app/campaigns/[id]/entries/[entryId]/edit/page.tsx` |
| MODIFY | `src/components/entry-form.tsx` |
| MODIFY | `src/components/performance-table.tsx` |
| MODIFY | `src/app/campaigns/[id]/page.tsx` |

ไม่มี schema migration, ไม่มี dependency ใหม่

---

## Tests

เพิ่ม unit tests ใน `tests/` สำหรับ:
- PATCH: success path, wrong campaignId → 404, entry ไม่เจอ → 404, missing fields → 400
- DELETE: success path, wrong campaignId → 404, entry ไม่เจอ → 404

---

## Success Criteria

- [ ] แก้ไข entry ที่มีอยู่ได้ครบทุก field
- [ ] ลบ entry ได้ พร้อม confirm dialog ที่ระบุวันที่
- [ ] ไม่สามารถ edit/delete entry ของ campaign อื่นผ่าน URL manipulation ได้
- [ ] ปุ่ม delete disabled ระหว่าง fetch + แสดง error ถ้าล้มเหลว
- [ ] ผ่าน `npm test` ครบ 17 tests เดิม + tests ใหม่
