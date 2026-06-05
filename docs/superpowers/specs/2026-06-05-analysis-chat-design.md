# Analysis Chat — Design Spec
Date: 2026-06-05

## Problem

หลังจากดูผลวิเคราะห์ AI แล้ว ผู้ใช้ไม่มีทางถาม follow-up เพื่อขอความเข้าใจเพิ่มเติม เช่น "ถ้าลด bid ลง 20% จะเกิดอะไร?" หรือ "ทำไม CPS ถึงสูงขนาดนี้?" ต้องเปิด analysis ใหม่ทุกครั้ง

## Goal

เพิ่ม chat panel inline ใต้ผลวิเคราะห์แต่ละรายการ ให้ผู้ใช้คุยต่อกับ AI โดยใช้ context เดิมของ campaign นั้น

---

## Decisions

| หัวข้อ | การตัดสินใจ |
|--------|------------|
| Context | Analysis result + campaign metrics + last 7 days entries |
| History | Ephemeral — เปิดใหม่ทุกครั้ง ไม่ save DB |
| UI placement | Inline ใต้ analysis card (toggle expand/collapse) |
| AI provider | OpenAI gpt-4o (เหมือนเดิม) |
| Response mode | Non-streaming — รอ response ครบแล้ว render |

---

## Architecture

### Files

| ไฟล์ | Action | หน้าที่ |
|------|--------|---------|
| `src/app/api/analysis/chat/route.ts` | สร้างใหม่ | POST endpoint รับ messages + context |
| `src/app/analysis/analysis-chat.tsx` | สร้างใหม่ | `AnalysisChat` UI component |
| `src/app/analysis/analysis-client.tsx` | แก้ไข | เพิ่ม chat toggle ใต้ result แต่ละรายการ |

### Data Flow

```
user คลิก "💬 แชทต่อ"
  → AnalysisChat component mount (messages = [])
  → user พิมพ์ message
  → POST /api/analysis/chat { campaignId, analysisId, messages }
  → API: fetch campaign data จาก Prisma + load AiAnalysis result จาก DB
  → API: build system prompt (metrics summary + analysis result)
  → API: OpenAI chat completion (full messages[])
  → return { reply: string }
  → client append reply → re-render
```

---

## API: POST `/api/analysis/chat`

### Request
```ts
{
  campaignId: string | null   // null = overview analysis
  analysisId: string          // ID ของ AiAnalysis record
  messages: { role: 'user' | 'assistant'; content: string }[]
}
```

### Response
```ts
{ reply: string }
// หรือ error
{ error: string }  // status 4xx/500
```

### System Prompt Structure
```
คุณเป็น AI วิเคราะห์แคมเปญโฆษณา Telegram Ads

== ข้อมูลแคมเปญ ==
ชื่อ: {name} | สถานะ: {status} | ประเภท: {targetType}
งบ: {totalAllocated} TON | ใช้ไป: {totalSpent} TON ({budgetUsedPct}%)
Joins ทั้งหมด: {totalJoins} | CPS: {avgCPS} USD | CTR: {ctr}%
Daily budget: {dailyBudgetTon} TON | Bid: {bidCpmTon} TON

== ผลวิเคราะห์ล่าสุด ==
สถานะโดยรวม: {status}
ทำเลย: {immediate}
อาทิตย์นี้: {weekly}
เดือนนี้: {monthly}
สมมติฐาน: {assumptions}

== 7 วันล่าสุด ==
{date} | spend {x} TON | joins {x} | views {x}
...

ตอบเป็นภาษาไทย กระชับ ตรงประเด็น
```

### Implementation Notes
- Fetch campaign + entries + allocations จาก Prisma (reuse pattern จาก `/api/analysis`)
- Load AiAnalysis by `analysisId` เพื่อดึง result ที่ผู้ใช้กำลังดูอยู่
- ส่ง `messages` ทั้งหมดไป OpenAI (ไม่มี token optimization — conversation สั้น)
- ไม่ save ผลลัพธ์ลง DB

---

## UI: `AnalysisChat` Component

### Props
```ts
interface AnalysisChatProps {
  campaignId: string | null
  analysisId: string
}
```

### State
```ts
messages: { role: 'user' | 'assistant'; content: string }[]
input: string
loading: boolean
error: string | null
```

### Layout
```
[💬 แชทต่อ ▾]  ← toggle button (อยู่ข้าง [วิเคราะห์ใหม่])

▼ เมื่อเปิด:
┌────────────────────────────────────┐
│ [placeholder: ถามอะไรเพิ่มเติมได้เลย...]  │
│ (message list)                      │
│   👤 user message                   │
│   🤖 assistant reply                │
│ ────────────────────────────────── │
│ [input textarea]            [ส่ง]  │
└────────────────────────────────────┘
```

### Behavior
- กด toggle → mount/unmount component (history clear)
- Enter ส่ง, Shift+Enter ขึ้นบรรทัดใหม่
- ขณะ loading: ปุ่ม disabled + แสดง "กำลังคิด..."
- Error: แสดงข้อความ inline ใต้ input
- message list scroll ลงอัตโนมัติเมื่อมี message ใหม่

---

## Changes to `analysis-client.tsx`

เพิ่ม `chatOpen` state per campaign:
```ts
const [chatOpen, setChatOpen] = useState<Set<string>>(new Set())
```

ใต้ `ResultDisplay` ของแต่ละ campaign เพิ่ม:
```tsx
<Button onClick={() => toggleChat(c.id)}>
  💬 แชทต่อ {chatOpen.has(c.id) ? '▲' : '▾'}
</Button>
{chatOpen.has(c.id) && analysis && (
  <AnalysisChat campaignId={c.id} analysisId={analysis.id} />
)}
```

Overview analysis ทำแบบเดียวกัน โดย `campaignId = null`

---

## Out of Scope

- Streaming responses
- Saving chat history to DB
- Message editing/deletion
- Export conversation
