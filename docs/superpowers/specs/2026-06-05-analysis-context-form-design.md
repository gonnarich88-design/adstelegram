# Analysis Context Form — Design Spec

> วันที่: 2026-06-05

## ภาพรวม

เพิ่ม dialog form ที่เด้งขึ้นก่อนกดวิเคราะห์ ให้ผู้ใช้กรอก context เพิ่มเติม (ปัญหาที่เจออยู่, โจทย์เฉพาะ) เพื่อให้ AI วิเคราะห์ได้ตรงจุดและมีประสิทธิภาพมากขึ้น โดยเฉพาะกรณีที่เจอบ่อย เช่น งบไม่เต็มหรืองบหมดเร็ว

## UX Flow

1. ผู้ใช้กดปุ่ม "วิเคราะห์ใหม่" (overview) หรือ "วิเคราะห์" (รายแคมเปญ)
2. Dialog เด้งขึ้น แสดง form ที่ตรงกับ mode
3. ผู้ใช้กรอก context (ทุก field เป็น optional — กด submit ได้ทันทีโดยไม่กรอก)
4. กด "เริ่มวิเคราะห์" → dialog ปิด → loading → แสดงผลเหมือนเดิม
5. ถ้า API error → dialog ยังเปิดอยู่ พร้อมแสดง error message ให้แก้แล้วลองใหม่

Context ที่กรอกเป็น **ephemeral** — ไม่เก็บ DB, กดวิเคราะห์ครั้งถัดไปต้องกรอกใหม่

## Forms

### Overview Dialog

| Field | Type | Required |
|-------|------|:--------:|
| ปัญหาที่เจออยู่ | Checkbox (multi-select) | ❌ |
| โจทย์เพิ่มเติม | Textarea | ❌ |

Checkbox options: `งบไม่เต็ม`, `CTR ต่ำ`, `Joins น้อย`, `CPS สูง`

### Campaign Dialog

| Field | Type | Required |
|-------|------|:--------:|
| ปัญหาที่เจออยู่ | Checkbox (multi-select) | ❌ |
| งบหมดประมาณกี่โมง | Text input (เช่น "10:00") | ❌ |
| Bid / Floor bid | Text input (เช่น "bid 0.5, floor 0.3 TON") | ❌ |
| โจทย์เพิ่มเติม | Textarea | ❌ |

Checkbox options: `งบไม่เต็ม`, `งบหมดเร็ว`, `CTR ต่ำ`, `Joins น้อย`, `CPS สูง`

## Architecture

### ไฟล์ที่แก้ไข (3 ไฟล์, ไม่มี schema migration)

#### 1. `src/lib/analysis.ts`

เพิ่ม type สำหรับ context:

```typescript
export interface OverviewContext {
  problems: string[]   // e.g. ["งบไม่เต็ม", "CTR ต่ำ"]
  question: string
}

export interface CampaignContext {
  problems: string[]
  budgetDepletionTime: string  // e.g. "10:00"
  bidInfo: string              // e.g. "bid 0.5, floor 0.3"
  question: string
}
```

ปรับ signature ให้ `context` เป็น **optional** (ป้องกัน existing tests break):

```typescript
export function buildOverviewPrompt(
  campaigns: CampaignSummary[],
  globalNote: string | null,
  today: string,
  context?: OverviewContext,
): PromptMessages

export function buildCampaignPrompt(
  campaign: CampaignSummary,
  entries: EntryRow[],
  globalNote: string | null,
  today: string,
  context?: CampaignContext,
): PromptMessages
```

Context inject เข้า system message ต่อท้าย globalNote:
```
ปัญหาที่รายงาน: งบไม่เต็ม, CTR ต่ำ
งบหมดเวลา: 10:00
Bid/Floor: bid 0.5, floor 0.3 TON
โจทย์: ควรปรับ campaign ไหนก่อน?
```
แสดงเฉพาะ field ที่มีค่า (ข้าม field ว่าง)

#### 2. `src/app/api/analysis/route.ts`

รับ `context` เพิ่มใน request body (optional):

```typescript
body: { type, campaignId, context?: OverviewContext | CampaignContext }
```

ส่ง `context` ต่อให้ `buildOverviewPrompt` / `buildCampaignPrompt`

#### 3. `src/app/analysis/analysis-client.tsx`

เพิ่ม `AnalysisDialog` component ในไฟล์เดียวกัน (ไม่แยกไฟล์):

- State: `dialogOpen: boolean`, `dialogTarget: 'overview' | string` (string = campaignId)
- Form state: controlled `useState` — reset ทุกครั้งที่ dialog เปิด (ไม่ใช้ react-hook-form)
- ปุ่ม "วิเคราะห์ใหม่" และ "วิเคราะห์" เปลี่ยนเป็น set `dialogTarget` + `dialogOpen = true`
- `AnalysisDialog` เรียก `triggerOverview` หรือ `triggerCampaign` ตาม `dialogTarget` หลัง submit

**Form state reset:** reset ทุก field เมื่อ `dialogTarget` เปลี่ยน เพื่อป้องกัน checkbox ค้างจาก campaign ก่อนหน้า

## Error Handling

- ทุก field optional → ไม่มี validation error ใน form
- API error (429, 502) → แสดง error ใน dialog ไม่ปิด ให้ลองใหม่
- API success → ปิด dialog, แสดงผลเหมือนเดิม

## Testing

- เพิ่ม unit tests ใน `tests/analysis.test.ts` สำหรับ `buildOverviewPrompt` และ `buildCampaignPrompt` version ที่มี context
  - verify context inject เข้า system message ถูกต้อง
  - verify field ว่างไม่แสดงใน system message
  - verify existing tests (no context) ยังผ่านเหมือนเดิม
- UI ทดสอบ manual ผ่าน browser

## ไม่ทำในครั้งนี้

- บันทึก context ลง DB (ephemeral เท่านั้น)
- Pre-fill checkbox อัตโนมัติจากข้อมูล DB (Option C)
- E2E tests
