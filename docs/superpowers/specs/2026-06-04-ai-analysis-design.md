# AI Analysis Feature — Design Spec
> วันที่: 2026-06-04 | สถานะ: Approved (รอ implementation plan)

## ภาพรวม

ปุ่ม "วิเคราะห์ Ads" ในระบบ — ให้ AI (GPT-4o) วิเคราะห์ประสิทธิภาพแคมเปญและสร้างแผนปฏิบัติ 3 ระดับ (ทำเลย / รายอาทิตย์ / รายเดือน) โดยมี 2 โหมด: ภาพรวมทุกแคมเปญ และรายแคมเปญแบบเจาะลึก

---

## Architecture

### หน้าใหม่ `/analysis`
- **Server Component** — ดึง AiAnalysis ล่าสุดจาก DB ตอน load
- **Client Component** `analysis-client.tsx` — ปุ่มกด trigger + แสดง loading state + render ผล
- เพิ่ม "วิเคราะห์" ใน Navbar

### API Route
- `POST /api/analysis` — route handler (server-side เท่านั้น, OPENAI_API_KEY ไม่ถึง client)
  - body: `{ type: "OVERVIEW" | "CAMPAIGN", campaignId?: string }`
  - เรียก OpenAI ผ่าน `fetch` (ไม่ใช้ openai SDK — ตาม AGENTS.md no unnecessary deps)
  - pattern เดียวกับ `lib/rates.ts`
  - บันทึกผลลง `AiAnalysis` table
  - error: ถ้า OpenAI fail → ไม่ persist, return 502 + error message

---

## Data Model

```prisma
enum AnalysisType {
  OVERVIEW
  CAMPAIGN
}

model AiAnalysis {
  id         String       @id @default(cuid())
  type       AnalysisType
  campaignId String?
  campaign   Campaign?    @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  result     String       // JSON string: { status, immediate[], weekly[], monthly[], assumptions[] }
  model      String       // "gpt-4o"
  createdAt  DateTime     @default(now())

  @@index([type, campaignId])
}
```

เก็บประวัติทุก analysis ไว้ (ไม่ upsert) — query latest ด้วย `orderBy: { createdAt: 'desc' }, take: 1`

### Result JSON Schema
```typescript
interface AnalysisResult {
  status: string           // สถานะโดยรวม 1-2 ประโยค
  immediate: string[]      // แผนทำเลย (bullet points)
  weekly: string[]         // แผนอาทิตย์นี้
  monthly: string[]        // แผนเดือนนี้
  assumptions: string[]    // สมมติฐานที่ AI ทำ เช่น "ไม่มีเป้า CPS กำหนด สมมติ ฿20"
  perCampaign?: {          // มีเฉพาะ OVERVIEW type
    campaignId: string
    name: string
    status: string         // "ดีมาก" | "ปกติ" | "ต้องระวัง" | "วิกฤต"
    highlight: string      // 1 ประโยค
  }[]
}
```

---

## Prompt Strategy

### OVERVIEW prompt
ข้อมูลที่ส่ง:
- `GlobalGoal.note` (strategy anchor — inject เป็น system context)
- แต่ละ campaign: name, status, targetType, dailyBudgetTon, totalAllocated, totalSpent, % budget used, totalJoins, avgCPS (฿), CTR, goalText, targetJoins, targetDate
- คำนวณ aggregate จาก `lib/metrics.ts` (ไม่ recompute เอง)
- วันที่ปัจจุบัน (Thai timezone: `Asia/Bangkok`)

### CAMPAIGN prompt (per-campaign deep dive)
ข้อมูลที่ส่ง:
- ข้อมูล campaign เดียวกับ overview
- **เพิ่ม**: daily entries 30 วันล่าสุด (date, spendTon, views, clicks, joins) เพื่อ trend reasoning
- goalText, planText, targetJoins, targetDate ของแคมเปญนั้น

### Instruction ทุก prompt
- ตอบเป็น **ภาษาไทย**
- ตอบกลับเป็น **JSON เท่านั้น** ตาม schema ข้างต้น
- ถ้าไม่มีเป้า CPS/joins กำหนด → ระบุใน `assumptions[]` ก่อนวิเคราะห์
- inject วันที่ปัจจุบัน Thai timezone

### OpenAI call
```
POST https://api.openai.com/v1/chat/completions
model: "gpt-4o"
response_format: { type: "json_object" }
```

---

## UI Layout

### หน้า `/analysis`

```
[Nav: Dashboard | Campaigns | Wallet | Goals | 🤖 วิเคราะห์]

┌─ ภาพรวมทุกแคมเปญ ──────────────────────────────────────┐
│ วิเคราะห์ล่าสุด: 4 มิ.ย. 14:30              [🔄 วิเคราะห์ใหม่] │
│                                                          │
│ สถานะ: ...                                               │
│ ทำเลย: • ... • ...                                       │
│ อาทิตย์นี้: • ...                                         │
│ เดือนนี้: • ...                                           │
│ สมมติฐาน: • ...                                          │
└──────────────────────────────────────────────────────────┘

วิเคราะห์รายแคมเปญ
┌─ Bot-A [ACTIVE] ─────────── วิเคราะห์แล้ว 4 มิ.ย. ─ [ดูผล] [🔄] ┐
└────────────────────────────────────────────────────────────────┘
┌─ Channel-B [ACTIVE] ─────────────── ยังไม่วิเคราะห์ ─ [🤖 วิเคราะห์] ┐
└────────────────────────────────────────────────────────────────────┘
...
```

เมื่อกด "ดูผล" — expand inline หรือ navigate ไปหน้าย่อย (ตัดสินใจตอน implement)

---

## Environment Variables

เพิ่มใน `.env.example`:
```
OPENAI_API_KEY=   # API key จาก platform.openai.com
```

---

## Error Handling

| กรณี | การจัดการ |
|------|----------|
| OpenAI timeout | return 502, แสดง "วิเคราะห์ไม่สำเร็จ ลองใหม่อีกครั้ง" |
| OpenAI rate limit | return 429, แสดง "กรุณารอสักครู่แล้วลองใหม่" |
| JSON parse fail | return 500, ไม่ persist |
| ไม่มี `OPENAI_API_KEY` | return 500, แสดง "ยังไม่ได้ตั้งค่า API key" |

---

## Migration Steps

1. เพิ่ม `AnalysisType` enum + `AiAnalysis` model ใน `prisma/schema.prisma`
2. `npx prisma migrate dev --name add_ai_analysis`
3. `npx prisma generate`

---

## Out of Scope

- Streaming (SSE) — ไม่จำเป็นสำหรับ use case นี้
- Per-analysis context form — GlobalGoal.note เพียงพอ
- Multi-user / history browser UI — เก็บประวัติใน DB แล้ว เพิ่ม UI ทีหลังได้
