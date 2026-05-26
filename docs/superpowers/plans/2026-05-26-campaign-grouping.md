# Campaign Grouping by Target Type Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** แบ่งรายการ Campaign บน Dashboard เป็น 2 sections ตาม targetType (CHANNEL / BOT) แทน flat grid เดิม

**Architecture:** แก้ `src/app/page.tsx` จุดเดียว — filter campaigns เป็น 2 array หลัง Prisma fetch แล้ว render แต่ละ group ด้วย heading + grid ไม่มี Client Component ไม่มี state ใหม่

**Tech Stack:** Next.js 16 App Router (Server Component), TypeScript, Tailwind CSS, Prisma (TargetType enum)

---

## Files

- Modify: `src/app/page.tsx` (เฉพาะ section แสดงรายการ campaigns ท้ายไฟล์)

---

### Task 1: Group campaigns by targetType in Dashboard

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: เพิ่ม filter 2 บรรทัดหลัง `activeCampaigns`**

เปิด `src/app/page.tsx` แล้วเพิ่มบรรทัดนี้ต่อจาก `const activeCampaigns = ...`:

```tsx
const channelCampaigns = campaigns.filter(c => c.targetType === 'CHANNEL')
const botCampaigns = campaigns.filter(c => c.targetType === 'BOT')
```

- [ ] **Step 2: แทนที่ flat grid ด้วย 2 sections**

ในส่วน JSX ของ `return`, แทนที่ block นี้ทั้งหมด:

```tsx
{campaigns.length === 0 ? (
  <div className="text-center py-16 text-muted-foreground">
    <p className="mb-4">ยังไม่มี campaign</p>
    <Link href="/campaigns/new" className={buttonVariants()}>สร้าง campaign แรก</Link>
  </div>
) : (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    {campaigns.map(c => (
      <CampaignCard key={c.id} campaign={c} />
    ))}
  </div>
)}
```

ด้วย:

```tsx
{campaigns.length === 0 ? (
  <div className="text-center py-16 text-muted-foreground">
    <p className="mb-4">ยังไม่มี campaign</p>
    <Link href="/campaigns/new" className={buttonVariants()}>สร้าง campaign แรก</Link>
  </div>
) : (
  <div className="space-y-8">
    {channelCampaigns.length > 0 && (
      <div>
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-lg font-semibold">CHANNEL</h2>
          <span className="text-sm text-muted-foreground">· {channelCampaigns.length}</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {channelCampaigns.map(c => (
            <CampaignCard key={c.id} campaign={c} />
          ))}
        </div>
      </div>
    )}
    {botCampaigns.length > 0 && (
      <div>
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-lg font-semibold">BOT</h2>
          <span className="text-sm text-muted-foreground">· {botCampaigns.length}</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {botCampaigns.map(c => (
            <CampaignCard key={c.id} campaign={c} />
          ))}
        </div>
      </div>
    )}
  </div>
)}
```

- [ ] **Step 3: รัน existing tests**

```bash
npm test
```

Expected: ทุก test ผ่าน (ไม่มี test ใหม่เพราะเป็น rendering-only change ใน Server Component)

- [ ] **Step 4: Verify ใน browser**

```bash
npm run dev
```

เปิด http://localhost:3000 แล้วตรวจ:
- campaigns แบ่งเป็น 2 sections พร้อม heading "CHANNEL · N" และ "BOT · N"
- ถ้ามีแค่ประเภทเดียว → แสดง section เดียว ไม่มี section ว่าง
- Summary metrics, Wallet card บนสุดยังแสดงเหมือนเดิม

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: group dashboard campaigns by target type (CHANNEL / BOT)"
```
