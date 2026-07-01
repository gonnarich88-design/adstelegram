# เพิ่มปลายทางแบบไม่ผูกแคมเปญ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เพิ่มปุ่ม "+ เพิ่มปลายทาง" ท้ายแต่ละหมวด (CHANNEL/BOT/SEARCH) บนหน้า `/placements` ให้สร้าง `Placement` ใหม่ได้โดยไม่ต้องผูกกับ Campaign ใด ๆ

**Architecture:** ฝั่ง server component (`page.tsx`) เปลี่ยนให้ build ทั้ง 3 หมวดเสมอ (ไม่กรองด้วยจำนวน placement) ฝั่ง client component (`placements-client.tsx`) เพิ่ม inline add-form ต่อหมวด ที่เรียก `POST /api/placements` ที่มีอยู่แล้ว (ไม่แตะ backend)

**Tech Stack:** Next.js 16 App Router, React 19 client component, fetch ตรงไปที่ REST API เดิม, lucide-react icons, Tailwind

## Global Constraints

- ห้ามแก้ `prisma/schema.prisma` หรือ API routes — ใช้ `POST /api/placements` เดิม (`src/app/api/placements/route.ts`) ตรง ๆ
- Tailwind utility classes เท่านั้น ห้ามเขียน CSS เพิ่ม
- Icons จาก `lucide-react` เท่านั้น
- ต้อง `npm test` ผ่านทั้งหมดก่อน commit สุดท้าย (44+ tests เดิม ไม่มีการเพิ่ม test ใหม่เพราะโปรเจกต์นี้ไม่มี component-test infra สำหรับ React — verify ด้วย build + manual browser check แทน)
- Codebase ไม่มี `.test.tsx` เลยแม้แต่ไฟล์เดียว (มีแต่ `.test.ts` ทดสอบ lib/API routes) — งานนี้เป็น UI ล้วน จึงไม่ต้องเพิ่ม dependency testing library ใหม่ (ขัดกับ "ห้ามเพิ่ม dependency ใหม่โดยไม่จำเป็น")

---

### Task 1: แสดง 3 หมวด (CHANNEL/BOT/SEARCH) เสมอ แม้ยังไม่มี placement

**Files:**
- Modify: `src/app/placements/page.tsx`

**Interfaces:**
- Consumes: ไม่มี (ไม่พึ่งพา task อื่น)
- Produces: `sections: Section[]` ที่ส่งให้ `<PlacementsClient sections={sections} .../>` — จะมีรายการ `{ typeKey: 'CHANNEL' | 'BOT' | 'SEARCH', m2m: [], legacy: [] }` โผล่มาได้แม้ไม่มีข้อมูล (เดิมจะถูกกรองทิ้งถ้า `m2m.length + legacy.length === 0`) — Task 2 ต้องรองรับ section ที่ `m2m`/`legacy` เป็น array ว่างได้

- [ ] **Step 1: แก้ filter ของ `sections` ให้เว้น CHANNEL/BOT/SEARCH ไว้เสมอ**

เปิด `src/app/placements/page.tsx` แก้บรรทัด 74-83 จาก:

```ts
  const TYPE_ORDER = ['CHANNEL', 'BOT', 'SEARCH', 'OTHER'] as const
  const sections: Section[] = TYPE_ORDER
    .map(t => ({
      typeKey: t,
      m2m: m2mByType[t] ?? [],
      legacy: Object.entries(legacyByType[t] ?? {})
        .map(([name, campaigns]) => ({ name, campaigns }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .filter(s => s.m2m.length + s.legacy.length > 0)
```

เป็น:

```ts
  const TYPE_ORDER = ['CHANNEL', 'BOT', 'SEARCH', 'OTHER'] as const
  const sections: Section[] = TYPE_ORDER
    .map(t => ({
      typeKey: t,
      m2m: m2mByType[t] ?? [],
      legacy: Object.entries(legacyByType[t] ?? {})
        .map(([name, campaigns]) => ({ name, campaigns }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    }))
    // CHANNEL/BOT/SEARCH โชว์เสมอ (มีปุ่มเพิ่มปลายทางท้ายหมวด) OTHER โชว์เฉพาะตอนมีข้อมูลจริง
    .filter(s => s.typeKey === 'OTHER' ? s.m2m.length + s.legacy.length > 0 : true)
```

- [ ] **Step 2: ลบ empty-state เต็มหน้า และ import `MapPin` ที่จะเหลือ unused**

แก้บรรทัด 1-3 จาก:

```ts
import { prisma } from '@/lib/prisma'
import { MapPin } from 'lucide-react'
import { PlacementsClient } from './placements-client'
```

เป็น:

```ts
import { prisma } from '@/lib/prisma'
import { PlacementsClient } from './placements-client'
```

แก้บรรทัด 89-111 (return block) จาก:

```tsx
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">ปลายทาง</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            ช่อง / หัวข้อที่ ads ไปแสดง — {total} ปลายทาง
          </p>
        </div>
      </div>

      {total === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <MapPin className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm">ยังไม่มีปลายทาง</p>
          <p className="text-xs mt-1">เพิ่มปลายทางได้จากหน้าสร้าง / แก้ไข Campaign</p>
        </div>
      ) : (
        <PlacementsClient sections={sections} statusClass={STATUS_CLASS} />
      )}
    </div>
  )
}
```

เป็น:

```tsx
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">ปลายทาง</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            ช่อง / หัวข้อที่ ads ไปแสดง — {total} ปลายทาง
          </p>
        </div>
      </div>

      <PlacementsClient sections={sections} statusClass={STATUS_CLASS} />
    </div>
  )
}
```

- [ ] **Step 3: Typecheck ผ่าน build**

Run: `cd /Users/wolfy/works/adstelegram && npx tsc --noEmit`
Expected: ไม่มี error (โดยเฉพาะไม่มี "MapPin is declared but never used" และไม่มี error เรื่อง `Section`/`PlacementsClient` props)

- [ ] **Step 4: Commit**

```bash
git add src/app/placements/page.tsx
git commit -m "feat: แสดงหมวด CHANNEL/BOT/SEARCH บนหน้าปลายทางเสมอแม้ยังไม่มีข้อมูล"
```

---

### Task 2: เพิ่มปุ่ม "+ เพิ่มปลายทาง" ต่อหมวด พร้อม inline form

**Files:**
- Modify: `src/app/placements/placements-client.tsx`

**Interfaces:**
- Consumes: `sections: Section[]` จาก Task 1 (อาจมี section ที่ `m2m: []` และ `legacy: []`) — component ต้อง render ปุ่มเพิ่มได้แม้ section ว่าง
- Consumes: `POST /api/placements` (มีอยู่แล้ว) — request body `{ name: string, type: string }`, response `{ id, name, type, note, createdAt, campaigns }` (status 201) หรือ `{ error: string }` (status 400)
- Produces: ไม่มี task อื่นต่อจากนี้

- [ ] **Step 1: เพิ่ม import `Plus` icon**

เปิด `src/app/placements/placements-client.tsx` แก้บรรทัด 7 จาก:

```ts
import { MapPin, Pencil, Trash2, Check, X, Hash, Bot } from 'lucide-react'
```

เป็น:

```ts
import { MapPin, Pencil, Trash2, Check, X, Hash, Bot, Plus } from 'lucide-react'
```

- [ ] **Step 2: เพิ่ม state สำหรับฟอร์มเพิ่มปลายทาง**

แก้บรรทัด 78-87 จาก:

```ts
  const [placements, setPlacements] = useState<Record<string, PlacementItem>>(
    () => Object.fromEntries(sections.flatMap(s => s.m2m).map(p => [p.id, p]))
  )
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [editing, setEditing] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editNote, setEditNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleteError, setDeleteError] = useState<Record<string, string>>({})
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set())
```

เป็น:

```ts
  const [placements, setPlacements] = useState<Record<string, PlacementItem>>(
    () => Object.fromEntries(sections.flatMap(s => s.m2m).map(p => [p.id, p]))
  )
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [editing, setEditing] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editNote, setEditNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleteError, setDeleteError] = useState<Record<string, string>>({})
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set())
  const [addingType, setAddingType] = useState<string | null>(null)
  const [addName, setAddName] = useState('')
  const [addSaving, setAddSaving] = useState(false)
  const [addError, setAddError] = useState('')
  const [addedPlacements, setAddedPlacements] = useState<Record<string, PlacementItem[]>>({})
```

- [ ] **Step 3: เพิ่มฟังก์ชัน `cancelAdd` และ `saveAdd`**

แก้บรรทัด 116-125 (ฟังก์ชัน `deletePlacement` เดิม) จาก:

```ts
  async function deletePlacement(id: string) {
    setDeleteError(e => ({ ...e, [id]: '' }))
    const res = await fetch(`/api/placements/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setDeletedIds(prev => new Set([...prev, id]))
    } else {
      const data = await res.json()
      setDeleteError(e => ({ ...e, [id]: data.error ?? 'ลบไม่ได้' }))
    }
  }
```

เป็น:

```ts
  async function deletePlacement(id: string) {
    setDeleteError(e => ({ ...e, [id]: '' }))
    const res = await fetch(`/api/placements/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setDeletedIds(prev => new Set([...prev, id]))
    } else {
      const data = await res.json()
      setDeleteError(e => ({ ...e, [id]: data.error ?? 'ลบไม่ได้' }))
    }
  }

  function cancelAdd() {
    setAddingType(null)
    setAddName('')
    setAddError('')
  }

  async function saveAdd(typeKey: string) {
    const name = addName.trim()
    if (!name || addSaving) return
    setAddSaving(true)
    setAddError('')
    try {
      const res = await fetch('/api/placements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, type: typeKey }),
      })
      const data = await res.json()
      if (!res.ok) {
        setAddError(data.error ?? 'เพิ่มไม่ได้')
        return
      }
      if (placements[data.id]) {
        setAddError('มีปลายทางชื่อนี้อยู่แล้ว')
        return
      }
      const newItem: PlacementItem = {
        id: data.id, name: data.name, type: data.type ?? null, note: data.note ?? null,
        createdAt: data.createdAt, campaigns: [],
      }
      setPlacements(prev => ({ ...prev, [newItem.id]: newItem }))
      setAddedPlacements(prev => ({ ...prev, [typeKey]: [...(prev[typeKey] ?? []), newItem] }))
      setAddingType(null)
      setAddName('')
    } finally {
      setAddSaving(false)
    }
  }
```

- [ ] **Step 4: รวม placement ที่เพิ่งเพิ่มเข้ากับ `visibleM2m`**

แก้บรรทัด 132 จาก:

```ts
        const visibleM2m = section.m2m.filter(p => !deletedIds.has(p.id))
```

เป็น:

```ts
        const visibleM2m = [...section.m2m, ...(addedPlacements[section.typeKey] ?? [])]
          .filter(p => !deletedIds.has(p.id))
```

- [ ] **Step 5: เพิ่ม UI ปุ่ม/ฟอร์มเพิ่มปลายทาง ท้ายแต่ละหมวด**

แก้บรรทัด 217-242 (ส่วน legacy groups map และปิด `<div className="space-y-2">`) จาก:

```tsx
              {/* Legacy groups */}
              {section.legacy.map(lg => {
                const chipKey = `chips:lg:${lg.name}`
                return (
                  <div key={lg.name} className="rounded-lg border border-dashed border-border overflow-hidden opacity-80">
                    <div className="flex items-start gap-3 px-4 py-3 bg-card">
                      <Icon className={`w-4 h-4 ${cfg.color} shrink-0 mt-0.5`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm truncate">{lg.name}</span>
                          <span className="text-[10px] text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded shrink-0">เก่า</span>
                        </div>
                        {lg.campaigns.length > 0 && (
                          <CampaignChips
                            campaigns={lg.campaigns}
                            expandKey={chipKey}
                            expanded={expanded.has(chipKey)}
                            onToggle={() => toggle(chipKey)}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
```

เป็น:

```tsx
              {/* Legacy groups */}
              {section.legacy.map(lg => {
                const chipKey = `chips:lg:${lg.name}`
                return (
                  <div key={lg.name} className="rounded-lg border border-dashed border-border overflow-hidden opacity-80">
                    <div className="flex items-start gap-3 px-4 py-3 bg-card">
                      <Icon className={`w-4 h-4 ${cfg.color} shrink-0 mt-0.5`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm truncate">{lg.name}</span>
                          <span className="text-[10px] text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded shrink-0">เก่า</span>
                        </div>
                        {lg.campaigns.length > 0 && (
                          <CampaignChips
                            campaigns={lg.campaigns}
                            expandKey={chipKey}
                            expanded={expanded.has(chipKey)}
                            onToggle={() => toggle(chipKey)}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}

              {/* Add new placement */}
              {addingType === section.typeKey ? (
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-dashed border-border bg-card">
                  <Icon className={`w-4 h-4 ${cfg.color} shrink-0`} />
                  <Input
                    value={addName}
                    onChange={e => setAddName(e.target.value)}
                    placeholder="เช่น https://t.me/xxx"
                    className="h-7 text-sm flex-1"
                    autoFocus
                    onKeyDown={e => {
                      if (e.key === 'Enter') saveAdd(section.typeKey)
                      if (e.key === 'Escape') cancelAdd()
                    }}
                  />
                  <button type="button" onClick={() => saveAdd(section.typeKey)} disabled={addSaving}
                    className="p-1.5 rounded hover:bg-muted text-green-400 transition-colors">
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button type="button" onClick={cancelAdd}
                    className="p-1.5 rounded hover:bg-muted text-muted-foreground transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => { setAddingType(section.typeKey); setAddName(''); setAddError('') }}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-dashed border-border text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors w-full"
                >
                  <Plus className="w-3.5 h-3.5" />
                  เพิ่มปลายทาง
                </button>
              )}
              {addingType === section.typeKey && addError && (
                <p className="px-1 text-xs text-destructive">{addError}</p>
              )}
            </div>
          </div>
        )
      })}
```

- [ ] **Step 6: Typecheck ผ่าน build**

Run: `cd /Users/wolfy/works/adstelegram && npx tsc --noEmit`
Expected: ไม่มี error

- [ ] **Step 7: รัน dev server แล้วทดสอบด้วยมือ**

Run: `cd /Users/wolfy/works/adstelegram && npm run dev` (แยก terminal หรือ background)

เปิดเบราว์เซอร์ที่ `http://localhost:3000/placements` แล้วตรวจ:
1. ทุกหมวด CHANNEL/BOT/SEARCH มีปุ่ม "+ เพิ่มปลายทาง" ท้ายรายการ (แม้หมวดว่าง เช่น SEARCH ถ้ายังไม่มีข้อมูล ก็ต้องเห็นหมวดพร้อมปุ่ม)
2. กดปุ่มในหมวด CHANNEL → พิมพ์ชื่อ เช่น `https://t.me/test-channel-demo` → กด Enter → แถวใหม่โผล่ในหมวด CHANNEL ทันที ไม่มี reload, ไม่มี chip แคมเปญ (เพราะยังไม่ผูก)
3. แถวที่เพิ่งเพิ่ม กดปุ่มดินสอ (edit) ได้ปกติ, กดถังขยะ (delete) ลบได้ปกติ (เพราะยังไม่มีแคมเปญผูก)
4. พิมพ์ชื่อซ้ำกับที่มีอยู่แล้ว (เช่นชื่อที่เพิ่งเพิ่มไปในข้อ 2 ซ้ำอีกครั้ง) → ต้องขึ้นข้อความ "มีปลายทางชื่อนี้อยู่แล้ว" ไม่ใช่แถวซ้ำ
5. กด Escape ตอนกำลังพิมพ์ → ฟอร์มปิด ไม่มีอะไรถูกสร้าง

Expected: ครบทั้ง 5 ข้อ พร้อมแนบ screenshot อย่างน้อย 1 รูปตอนเพิ่มสำเร็จ (ตาม AGENTS.md "VERIFY BEFORE DONE — แก้ไฟล์แล้วต้องแสดง output การรัน/ทดสอบจริงเสมอ")

- [ ] **Step 8: Commit**

```bash
git add src/app/placements/placements-client.tsx
git commit -m "feat: เพิ่มปุ่มเพิ่มปลายทางต่อหมวดในหน้าปลายทาง โดยไม่ต้องผูกแคมเปญ"
```

---

### Task 3: Regression check และอัปเดต progress log

**Files:**
- Modify: `docs/PROGRESS.md`

**Interfaces:**
- Consumes: ผลลัพธ์จาก Task 1-2 (ไฟล์ที่แก้แล้ว, commit ที่สร้างแล้ว)
- Produces: ไม่มี

- [ ] **Step 1: รัน unit test เดิมทั้งหมด**

Run: `cd /Users/wolfy/works/adstelegram && npm test`
Expected: PASS ทั้งหมด (44+ tests เดิม ไม่ควรมีอะไรพัง เพราะไม่ได้แตะ backend/lib)

- [ ] **Step 2: รัน production build เต็ม**

Run: `cd /Users/wolfy/works/adstelegram && npm run build`
Expected: build สำเร็จไม่มี error (โดยเฉพาะ type error หรือ unused-import lint error จาก Task 1)

- [ ] **Step 3: อัปเดต `docs/PROGRESS.md`**

อ่านไฟล์ `docs/PROGRESS.md` ปัจจุบันก่อน แล้วย้ายงานนี้ไปหัวข้อ "เสร็จแล้ว" พร้อมวันที่ปัจจุบัน สรุปสั้น ๆ ว่า: "เพิ่มปุ่ม + เพิ่มปลายทาง ต่อหมวด (CHANNEL/BOT/SEARCH) บนหน้า /placements — สร้าง Placement ได้โดยไม่ต้องผูกแคมเปญ, กันชื่อซ้ำด้วยการเช็ค id ที่ backend คืนกลับมา (`page.tsx`, `placements-client.tsx`)" อัปเดตหัวข้อ "กำลังทำ/ค้างอยู่" ให้ตรงกับสถานะล่าสุด (ลบงานนี้ออกถ้าเคยอยู่ในนั้น)

- [ ] **Step 4: Commit**

```bash
git add docs/PROGRESS.md
git commit -m "docs: อัปเดต progress log สำหรับฟีเจอร์เพิ่มปลายทางแบบไม่ผูกแคมเปญ"
```
