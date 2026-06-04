# Analysis Context Form Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เพิ่ม dialog form ที่เด้งขึ้นก่อนกดวิเคราะห์ ให้ผู้ใช้กรอก context (ปัญหาที่เจออยู่, bid info, โจทย์) เพื่อให้ AI วิเคราะห์ได้ตรงจุดมากขึ้น

**Architecture:** แก้ 3 ไฟล์เดิม — (1) `lib/analysis.ts` เพิ่ม context types + inject เข้า prompt, (2) `api/analysis/route.ts` รับ context ใน request body, (3) `analysis-client.tsx` เพิ่ม AnalysisDialog component + เปลี่ยนปุ่มให้เปิด dialog แทนยิง API ตรง Context เป็น ephemeral (ไม่เก็บ DB)

**Tech Stack:** TypeScript, React useState/useEffect, @base-ui/react Dialog, Tailwind CSS, Vitest

---

## Task 1: เพิ่ม context types และ inject เข้า prompt builders

**Files:**
- Modify: `src/lib/analysis.ts`
- Test: `tests/analysis.test.ts`

- [ ] **Step 1: เขียน failing tests สำหรับ context injection**

เปิด `tests/analysis.test.ts` เพิ่ม describe blocks ต่อท้ายไฟล์ (ก่อน `describe('parseAnalysisResult', ...)` ก็ได้):

```typescript
describe('buildOverviewPrompt with context', () => {
  it('includes problems in system message', () => {
    const ctx = { problems: ['งบไม่เต็ม', 'CTR ต่ำ'], question: '' }
    const { system } = buildOverviewPrompt([baseCampaign], null, '2026-06-05', ctx)
    expect(system).toContain('ปัญหาที่รายงาน: งบไม่เต็ม, CTR ต่ำ')
  })

  it('includes question in system message', () => {
    const ctx = { problems: [], question: 'ควรปรับ campaign ไหนก่อน?' }
    const { system } = buildOverviewPrompt([baseCampaign], null, '2026-06-05', ctx)
    expect(system).toContain('โจทย์: ควรปรับ campaign ไหนก่อน?')
  })

  it('omits problems line when array is empty', () => {
    const ctx = { problems: [], question: '' }
    const { system } = buildOverviewPrompt([baseCampaign], null, '2026-06-05', ctx)
    expect(system).not.toContain('ปัญหาที่รายงาน')
  })

  it('omits question line when empty string', () => {
    const ctx = { problems: [], question: '' }
    const { system } = buildOverviewPrompt([baseCampaign], null, '2026-06-05', ctx)
    expect(system).not.toContain('โจทย์:')
  })
})

describe('buildCampaignPrompt with context', () => {
  it('includes all non-empty context fields in system message', () => {
    const ctx = {
      problems: ['งบหมดเร็ว'],
      budgetDepletionTime: '10:00',
      bidInfo: 'bid 0.5, floor 0.3',
      question: 'ควร scale budget ไหม?',
    }
    const { system } = buildCampaignPrompt(baseCampaign, [], null, '2026-06-05', ctx)
    expect(system).toContain('ปัญหาที่รายงาน: งบหมดเร็ว')
    expect(system).toContain('งบหมดเวลา: 10:00')
    expect(system).toContain('Bid/Floor: bid 0.5, floor 0.3')
    expect(system).toContain('โจทย์: ควร scale budget ไหม?')
  })

  it('omits budgetDepletionTime line when empty', () => {
    const ctx = { problems: [], budgetDepletionTime: '', bidInfo: '', question: '' }
    const { system } = buildCampaignPrompt(baseCampaign, [], null, '2026-06-05', ctx)
    expect(system).not.toContain('งบหมดเวลา')
  })

  it('omits bidInfo line when empty', () => {
    const ctx = { problems: [], budgetDepletionTime: '', bidInfo: '', question: '' }
    const { system } = buildCampaignPrompt(baseCampaign, [], null, '2026-06-05', ctx)
    expect(system).not.toContain('Bid/Floor')
  })
})
```

เพิ่ม import `CampaignContext` ด้วย — บรรทัด import ที่มีอยู่:

```typescript
import { buildOverviewPrompt, buildCampaignPrompt, parseAnalysisResult } from '@/lib/analysis'
import type { CampaignSummary, EntryRow } from '@/lib/analysis'
```

เปลี่ยนเป็น:

```typescript
import { buildOverviewPrompt, buildCampaignPrompt, parseAnalysisResult } from '@/lib/analysis'
import type { CampaignSummary, EntryRow, OverviewContext, CampaignContext } from '@/lib/analysis'
```

- [ ] **Step 2: รัน tests เพื่อยืนยันว่า fail**

```bash
cd /Users/wolfy/works/adstelegram && npm test
```

Expected: tests ใหม่ fail (TypeScript error: Expected 3 arguments, but got 4) — tests เดิมยังผ่าน

- [ ] **Step 3: เพิ่ม types และอัปเดต prompt builders ใน `src/lib/analysis.ts`**

เพิ่ม interface ทั้งสองอันต่อท้าย interface ที่มีอยู่แล้ว (ก่อน `interface PromptMessages`):

```typescript
export interface OverviewContext {
  problems: string[]
  question: string
}

export interface CampaignContext {
  problems: string[]
  budgetDepletionTime: string
  bidInfo: string
  question: string
}
```

อัปเดต `buildOverviewPrompt` — เพิ่ม parameter และ inject:

```typescript
export function buildOverviewPrompt(
  campaigns: CampaignSummary[],
  globalNote: string | null,
  today: string,
  context?: OverviewContext,
): PromptMessages {
  const systemLines = [
    'คุณเป็นผู้เชี่ยวชาญด้านโฆษณา Telegram Ads',
    'ตอบเป็นภาษาไทยเท่านั้น',
    'ตอบกลับเป็น JSON object เท่านั้น ไม่มีข้อความอื่น',
    `วันที่ปัจจุบัน: ${today} (Asia/Bangkok)`,
  ]
  if (globalNote) systemLines.push(`กลยุทธ์ภาพรวม: ${globalNote}`)
  if (context?.problems.length) systemLines.push(`ปัญหาที่รายงาน: ${context.problems.join(', ')}`)
  if (context?.question) systemLines.push(`โจทย์: ${context.question}`)
  // ... ส่วนที่เหลือเหมือนเดิม
```

อัปเดต `buildCampaignPrompt` — เพิ่ม parameter และ inject:

```typescript
export function buildCampaignPrompt(
  campaign: CampaignSummary,
  entries: EntryRow[],
  globalNote: string | null,
  today: string,
  context?: CampaignContext,
): PromptMessages {
  const systemLines = [
    'คุณเป็นผู้เชี่ยวชาญด้านโฆษณา Telegram Ads',
    'ตอบเป็นภาษาไทยเท่านั้น',
    'ตอบกลับเป็น JSON object เท่านั้น ไม่มีข้อความอื่น',
    `วันที่ปัจจุบัน: ${today} (Asia/Bangkok)`,
  ]
  if (globalNote) systemLines.push(`กลยุทธ์ภาพรวม: ${globalNote}`)
  if (context?.problems.length) systemLines.push(`ปัญหาที่รายงาน: ${context.problems.join(', ')}`)
  if (context?.budgetDepletionTime) systemLines.push(`งบหมดเวลา: ${context.budgetDepletionTime}`)
  if (context?.bidInfo) systemLines.push(`Bid/Floor: ${context.bidInfo}`)
  if (context?.question) systemLines.push(`โจทย์: ${context.question}`)
  // ... ส่วนที่เหลือเหมือนเดิม
```

- [ ] **Step 4: รัน tests เพื่อยืนยันว่าผ่าน**

```bash
cd /Users/wolfy/works/adstelegram && npm test
```

Expected: ทุก test ผ่าน รวม tests ใหม่ 7 ข้อ และ tests เก่าทั้งหมด

- [ ] **Step 5: Commit**

```bash
cd /Users/wolfy/works/adstelegram && git add src/lib/analysis.ts tests/analysis.test.ts && git commit -m "feat: add OverviewContext and CampaignContext to analysis prompt builders"
```

---

## Task 2: อัปเดต API route รับ context ใน request body

**Files:**
- Modify: `src/app/api/analysis/route.ts`

- [ ] **Step 1: อัปเดต body type และส่ง context เข้า prompt builders**

ใน `src/app/api/analysis/route.ts`:

เพิ่ม import types ที่บรรทัด import:

```typescript
import { buildOverviewPrompt, buildCampaignPrompt, parseAnalysisResult } from '@/lib/analysis'
import type { CampaignSummary, EntryRow, OverviewContext, CampaignContext } from '@/lib/analysis'
```

เปลี่ยน body type (บรรทัดที่ 12):

```typescript
let body: { type: string; campaignId?: string; context?: OverviewContext | CampaignContext }
```

เปลี่ยน `buildOverviewPrompt` call (ใน `if (type === 'OVERVIEW')` block):

```typescript
prompt = buildOverviewPrompt(summaries, globalGoal?.note ?? null, today, body.context as OverviewContext | undefined)
```

เปลี่ยน `buildCampaignPrompt` call (ใน `else` block):

```typescript
prompt = buildCampaignPrompt(summary, entryRows, globalGoal?.note ?? null, today, body.context as CampaignContext | undefined)
```

- [ ] **Step 2: รัน tests ยืนยัน TypeScript และ tests ผ่าน**

```bash
cd /Users/wolfy/works/adstelegram && npm test
```

Expected: ทุก test ผ่านเหมือนเดิม ไม่มี TypeScript error

- [ ] **Step 3: Commit**

```bash
cd /Users/wolfy/works/adstelegram && git add src/app/api/analysis/route.ts && git commit -m "feat: pass context from request body to analysis prompt builders"
```

---

## Task 3: เพิ่ม AnalysisDialog และอัปเดต UI

**Files:**
- Modify: `src/app/analysis/analysis-client.tsx`

- [ ] **Step 1: เพิ่ม imports**

เพิ่มบรรทัด import ต่อท้ายกลุ่ม import ที่มีอยู่:

```typescript
import { Dialog } from '@base-ui/react/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { OverviewContext, CampaignContext } from '@/lib/analysis'
```

- [ ] **Step 2: เพิ่ม dialog state ใน AnalysisClient**

เพิ่มหลัง state ที่มีอยู่แล้ว (หลัง `const [expanded, ...]`):

```typescript
const [dialogOpen, setDialogOpen] = useState(false)
const [dialogTarget, setDialogTarget] = useState<'overview' | string>('overview')
const [dialogError, setDialogError] = useState<string | null>(null)

function openDialog(target: 'overview' | string) {
  setDialogTarget(target)
  setDialogError(null)
  setDialogOpen(true)
}
```

- [ ] **Step 3: อัปเดต `triggerOverview` ให้รับ context และปิด dialog เมื่อสำเร็จ**

แทนที่ฟังก์ชัน `triggerOverview` ทั้งหมด:

```typescript
async function triggerOverview(ctx: OverviewContext) {
  setOverviewLoading(true)
  setDialogError(null)
  try {
    const res = await fetch('/api/analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'OVERVIEW', context: ctx }),
    })
    const data = await res.json()
    if (!res.ok) {
      setDialogError(data.error ?? 'เกิดข้อผิดพลาด')
      return
    }
    setOverviewAnalysis({ id: data.id, createdAt: data.createdAt, result: data.result, model: data.model })
    setDialogOpen(false)
  } catch {
    setDialogError('เกิดข้อผิดพลาด กรุณาลองใหม่')
  } finally {
    setOverviewLoading(false)
  }
}
```

- [ ] **Step 4: อัปเดต `triggerCampaign` ให้รับ context และปิด dialog เมื่อสำเร็จ**

แทนที่ฟังก์ชัน `triggerCampaign` ทั้งหมด:

```typescript
async function triggerCampaign(campaignId: string, ctx: CampaignContext) {
  setCampaignLoading(p => ({ ...p, [campaignId]: true }))
  setDialogError(null)
  try {
    const res = await fetch('/api/analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'CAMPAIGN', campaignId, context: ctx }),
    })
    const data = await res.json()
    if (!res.ok) {
      setDialogError(data.error ?? 'เกิดข้อผิดพลาด')
      return
    }
    setCampaignAnalyses(p => ({ ...p, [campaignId]: { id: data.id, createdAt: data.createdAt, result: data.result, model: data.model } }))
    setExpanded(p => new Set([...p, campaignId]))
    setDialogOpen(false)
  } catch {
    setDialogError('เกิดข้อผิดพลาด กรุณาลองใหม่')
  } finally {
    setCampaignLoading(p => ({ ...p, [campaignId]: false }))
  }
}
```

- [ ] **Step 5: เปลี่ยนปุ่ม "วิเคราะห์ใหม่" ใน Overview card ให้เปิด dialog**

หา `onClick={triggerOverview}` ใน Overview card section และเปลี่ยนเป็น:

```typescript
onClick={() => openDialog('overview')}
```

ลบ `disabled={overviewLoading}` ออกจากปุ่มนี้ (loading state จะแสดงใน dialog แทน)

ลบ `{overviewLoading ? 'กำลังวิเคราะห์...' : 'วิเคราะห์ใหม่'}` เปลี่ยนเป็น `'วิเคราะห์ใหม่'` เสมอ

ลบ `{overviewError && <p ...>}` ออก (error จะแสดงในsDialog แทน)

- [ ] **Step 6: เปลี่ยนปุ่ม "วิเคราะห์" ในรายการ campaign ให้เปิด dialog**

หา `onClick={() => triggerCampaign(c.id)}` และเปลี่ยนเป็น:

```typescript
onClick={() => openDialog(c.id)}
```

ลบ `disabled={loading}` จากปุ่มนี้

เปลี่ยน label จาก `{loading ? '...' : analysis ? '🔄' : 'วิเคราะห์'}` เป็น `{analysis ? '🔄' : 'วิเคราะห์'}` เสมอ

ลบ `{error && <CardContent ...>}` ออก (error จะแสดงในsDialog แทน)

- [ ] **Step 7: เพิ่ม `AnalysisDialog` component และ render ใน JSX**

เพิ่ม component ใหม่ **ก่อน** `export function AnalysisClient(...)` ในไฟล์เดียวกัน:

```typescript
function AnalysisDialog({
  open,
  onOpenChange,
  target,
  campaigns,
  loading,
  error,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  target: 'overview' | string
  campaigns: CampaignItem[]
  loading: boolean
  error: string | null
  onSubmit: (ctx: { problems: string[]; question: string; budgetDepletionTime: string; bidInfo: string }) => void
}) {
  const [problems, setProblems] = useState<string[]>([])
  const [budgetDepletionTime, setBudgetDepletionTime] = useState('')
  const [bidInfo, setBidInfo] = useState('')
  const [question, setQuestion] = useState('')

  useEffect(() => {
    if (open) {
      setProblems([])
      setBudgetDepletionTime('')
      setBidInfo('')
      setQuestion('')
    }
  }, [open, target])

  const isOverview = target === 'overview'
  const options = isOverview
    ? ['งบไม่เต็ม', 'CTR ต่ำ', 'Joins น้อย', 'CPS สูง']
    : ['งบไม่เต็ม', 'งบหมดเร็ว', 'CTR ต่ำ', 'Joins น้อย', 'CPS สูง']
  const campaignName = isOverview ? null : campaigns.find(c => c.id === target)?.name

  function toggleProblem(p: string) {
    setProblems(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 bg-black/50 z-40" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-background border rounded-lg shadow-lg p-6 w-full max-w-md">
          <Dialog.Title className="text-base font-semibold mb-4">
            {isOverview ? 'วิเคราะห์ภาพรวม' : `วิเคราะห์: ${campaignName}`}
          </Dialog.Title>

          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium mb-2">ปัญหาที่เจออยู่</p>
              <div className="flex flex-wrap gap-2">
                {options.map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => toggleProblem(p)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                      problems.includes(p)
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'border-border hover:bg-muted'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {!isOverview && (
              <>
                <div>
                  <label className="text-sm font-medium block mb-1">งบหมดประมาณกี่โมง</label>
                  <Input
                    placeholder="เช่น 10:00"
                    value={budgetDepletionTime}
                    onChange={e => setBudgetDepletionTime(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1">Bid / Floor bid</label>
                  <Input
                    placeholder="เช่น bid 0.5, floor 0.3 TON"
                    value={bidInfo}
                    onChange={e => setBidInfo(e.target.value)}
                  />
                </div>
              </>
            )}

            <div>
              <label className="text-sm font-medium block mb-1">โจทย์เพิ่มเติม</label>
              <Textarea
                placeholder="เช่น ควรปรับ campaign ไหนก่อน?"
                value={question}
                onChange={e => setQuestion(e.target.value)}
                rows={3}
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <Dialog.Close render={<Button variant="outline">ยกเลิก</Button>} />
            <Button
              onClick={() => onSubmit({ problems, question, budgetDepletionTime, bidInfo })}
              disabled={loading}
            >
              {loading ? 'กำลังวิเคราะห์...' : 'เริ่มวิเคราะห์'}
            </Button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
```

ใน `return (...)` ของ `AnalysisClient` เพิ่ม `<AnalysisDialog>` **ก่อน** `<div className="max-w-3xl ...">`:

```typescript
return (
  <>
    <AnalysisDialog
      open={dialogOpen}
      onOpenChange={setDialogOpen}
      target={dialogTarget}
      campaigns={campaigns}
      loading={dialogTarget === 'overview' ? overviewLoading : (campaignLoading[dialogTarget] ?? false)}
      error={dialogError}
      onSubmit={ctx => {
        if (dialogTarget === 'overview') {
          triggerOverview({ problems: ctx.problems, question: ctx.question })
        } else {
          triggerCampaign(dialogTarget, {
            problems: ctx.problems,
            budgetDepletionTime: ctx.budgetDepletionTime,
            bidInfo: ctx.bidInfo,
            question: ctx.question,
          })
        }
      }}
    />
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      {/* เนื้อหาเดิม */}
    </div>
  </>
)
```

- [ ] **Step 8: รัน tests ยืนยัน**

```bash
cd /Users/wolfy/works/adstelegram && npm test
```

Expected: ทุก test ผ่าน

- [ ] **Step 9: เปิด browser ทดสอบ**

```bash
cd /Users/wolfy/works/adstelegram && npm run dev
```

เปิด `http://localhost:3000/analysis` และตรวจสอบ:
1. กด "วิเคราะห์ใหม่" → dialog เด้งขึ้น ชื่อ "วิเคราะห์ภาพรวม"
2. กด checkbox ปัญหา → toggle highlight (primary color)
3. กด "ยกเลิก" → dialog ปิด ไม่มีผลอะไร
4. เปิด dialog ใหม่ → checkbox reset
5. กด "เริ่มวิเคราะห์" → dialog แสดง "กำลังวิเคราะห์..." → ปิดเมื่อสำเร็จ → ผลแสดงในcard
6. กด "วิเคราะห์" บน campaign → dialog เด้งขึ้น ชื่อ "วิเคราะห์: [ชื่อแคมเปญ]" มีช่อง bid/เวลาเพิ่มเติม
7. กรอก "งบหมดประมาณกี่โมง" + "Bid/Floor bid" → ส่ง submit ได้ปกติ

- [ ] **Step 10: Commit**

```bash
cd /Users/wolfy/works/adstelegram && git add src/app/analysis/analysis-client.tsx && git commit -m "feat: add AnalysisDialog context form before triggering AI analysis"
```
