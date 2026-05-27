# Dashboard Enhancements Spec
> Created: 2026-05-27 | Status: approved

## Goal

เพิ่ม 3 sections ใน Dashboard เพื่อให้เห็นภาพรวม campaign status และ performance โดยไม่ต้องคลิกเข้าหน้า /campaigns:

1. **Delta indicators** บน KPI cards (วันนี้ vs เมื่อวาน)
2. **Budget Alerts** — campaign ที่ใกล้หมด budget เรียงตาม urgency
3. **Top Performers 7d** — campaign ที่ดีสุดในแต่ละมิติ

## Scope

- ไม่มี schema change
- ไม่มี API route ใหม่
- ไม่มี dependency ใหม่
- คำนวณทั้งหมด server-side ใน `src/app/page.tsx` จาก data ที่ fetch อยู่แล้ว
- ไม่แตะ `/campaigns` page, wallet page, หรือ component อื่น

---

## Section 1: Delta Indicators บน KPI Cards

### ตำแหน่ง
ใต้ sub-text เดิมของแต่ละ KPI card (บรรทัดที่ 3)

### Cards ที่เพิ่ม delta

| Card | Delta แสดง | ตัวอย่าง |
|------|-----------|---------|
| Total Spend | วันนี้ spend กี่ TON | `วันนี้ 18.20 TON` |
| Total Startbot/Joins | วันนี้ได้กี่ starts/joins | `วันนี้ +47` |
| Avg CPS | CPS วันนี้ vs เมื่อวาน | `วานนี้ ฿98 → วันนี้ ฿91` |

Campaigns และ Avg CTR ไม่แสดง delta (ไม่มีนัยสำคัญรายวัน)

### คำนวณ

```typescript
// "today" = UTC date ตรงกับ date ที่ user บันทึก (เก็บเป็น UTC midnight)
const todayStr = new Date().toISOString().slice(0, 10)
const yesterdayStr = new Date(Date.now() - 86400000).toISOString().slice(0, 10)

// ดึง entries เฉพาะ today / yesterday จาก campaigns ที่ fetch อยู่แล้ว
const todayEntries   = allRawEntries.filter(e => e.date.toISOString().slice(0, 10) === todayStr)
const yesterdayEntries = allRawEntries.filter(e => e.date.toISOString().slice(0, 10) === yesterdayStr)
```

`allRawEntries` = `campaigns.flatMap(c => c.entries)` (ยังไม่ map to numbers)

### Styling

| Card | Format | Color logic |
|------|--------|-------------|
| Total Spend | `วันนี้ X.XX TON` | เทา (`text-muted-foreground`) — informational เฉยๆ ไม่มี ▲▼ |
| Total Startbot/Joins | `▲ +X วันนี้` | เขียวถ้า > 0, เทาถ้า = 0, `—` ถ้าไม่มีข้อมูล |
| Avg CPS | `฿XX → ฿XX` (เมื่อวาน → วันนี้) | วันนี้ **เขียว**ถ้าถูกลง, **แดง**ถ้าแพงขึ้น, `—` ถ้าข้อมูลไม่ครบ |

---

## Section 2: Budget Alerts

### ตำแหน่ง
ระหว่าง KPI cards กับ Trend chart (ใหม่)

### Logic

```typescript
type AlertLevel = 'critical' | 'warning' | 'ok'

interface CampaignAlert {
  id: string
  name: string
  targetName: string
  totalAllocatedTon: number
  totalSpentTon: number
  remainingTon: number
  burnRate7d: number        // TON/วัน เฉลี่ย 7 วันล่าสุด (เฉพาะ campaign นี้)
  daysLeft: number | null   // null ถ้า burnRate7d = 0
  level: AlertLevel
}
```

**ใครขึ้น alert:**
- เฉพาะ status `ACTIVE` เท่านั้น
- `totalAllocatedTon > 0` (มี allocation แล้ว)
- แสดงทุก ACTIVE campaign (ทั้ง critical, warning, ok) เรียง critical ก่อน

**คำนวณ level:**
- `daysLeft <= 3` → `critical`
- `daysLeft <= 7` → `warning`
- `daysLeft > 7` หรือ `daysLeft = null` → `ok`

**burn rate per campaign:**
```typescript
const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
const spend7d = campaign.entries
  .filter(e => new Date(e.date) >= sevenDaysAgo)
  .reduce((s, e) => s + Number(e.spendTon), 0)
const burnRate7d = spend7d / 7
```

### Render

```
[🔴 Critical] Bot Promo — @mybot     ใช้ไป 47.8/50 TON · เหลือ ~2 วัน   [badge: Critical · 2d]
[🟡 Warning]  Channel Blast           ใช้ไป 28/50 TON · เหลือ ~5 วัน     [badge: Low · 5d]
[🟢 OK]       New Campaign            ใช้ไป 9/50 TON · เหลือ ~22 วัน     [badge: OK · 22d]
```

- ซ่อน section ทั้งก้อนถ้า `campaignAlerts.length === 0` (ครอบทั้งกรณี ไม่มี ACTIVE campaign และ ACTIVE แต่ยังไม่มี allocation)
- ถ้า `daysLeft = null` → แสดงแค่ "เหลือ X.XX TON" ไม่มีประมาณวัน
- TON ที่แสดงใน detail = `remainingTon.toFixed(2)` และ `totalAllocatedTon.toFixed(2)`

### Styling (dark theme consistent)

| Level | Border | Background | Name color | Badge |
|-------|--------|------------|-----------|-------|
| critical | `border-red-900/50` | `bg-red-950/20` | `text-red-300` | `bg-red-900 text-red-200` |
| warning | `border-amber-900/50` | `bg-amber-950/20` | `text-amber-300` | `bg-amber-900 text-amber-200` |
| ok | `border-green-900/50` | `bg-green-950/20` | `text-green-300` | `bg-green-900 text-green-200` |

---

## Section 3: Top Performers (7d)

### ตำแหน่ง
ระหว่าง Budget Alerts กับ Trend chart

### 3 cards แนวนอน

| Card | Metric | Winner criteria | ซ่อนถ้า |
|------|--------|----------------|---------|
| 🏆 Best CPS | CPS ถูกสุด (฿/join) | ต่ำสุด | joins7d = 0 |
| 📈 Most Startbot / Most Joins | joins มากสุด | สูงสุด | joins7d = 0 |
| 🎯 Best CTR | CTR สูงสุด | สูงสุด | views7d = 0 |

Label ใน "Most" card ใช้ `joinsLabel` (Startbot / Joins / Joins&Startbot) ตาม targetType

### คำนวณ

```typescript
const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

const campaignStats = campaigns
  .filter(c => c.status === 'ACTIVE' || c.status === 'PAUSED')  // รวม PAUSED ด้วย
  .map(c => {
    const entries7d = c.entries.filter(e => new Date(e.date) >= sevenDaysAgo)
    const spendThb = entries7d.reduce((s, e) => s + Number(e.spendTon) * Number(e.tonPriceUsd) * Number(e.usdThbRate), 0)
    const joins = entries7d.reduce((s, e) => s + e.joins, 0)
    const views = entries7d.reduce((s, e) => s + (e.views ?? 0), 0)
    const clicks = entries7d.reduce((s, e) => s + e.clicks, 0)
    return {
      id: c.id, name: c.name, targetName: c.targetName,
      spendThb, joins, views, clicks,
      cpsThb: joins > 0 ? spendThb / joins : null,
      ctr: views > 0 ? (clicks / views) * 100 : null,
    }
  })
  .filter(c => c.joins > 0 || c.views > 0)  // ต้องมีข้อมูล 7d
```

- Best CPS = `campaignStats.filter(c => c.cpsThb !== null).sort((a,b) => a.cpsThb! - b.cpsThb!)[0]`
- Most Joins = `campaignStats.sort((a,b) => b.joins - a.joins)[0]`
- Best CTR = `campaignStats.filter(c => c.ctr !== null).sort((a,b) => b.ctr! - a.ctr!)[0]`

ถ้า 3 cards ชนะด้วย campaign เดิมทั้งหมด → ยังคงแสดง (บอกว่า campaign นั้น dominate ทุกมิติ)

### Styling

3 cards ใน `grid-cols-3` แต่ละ card มี top border 2px:
- Best CPS: `border-t-amber-500`
- Most Joins: `border-t-blue-500`
- Best CTR: `border-t-purple-500`

ซ่อน section ทั้งก้อนถ้า `campaignStats.length === 0`

---

## Layout สุดท้าย

```
Dashboard
├── Wallet card           (existing — แสดงเฉพาะ balance > 0)
├── KPI cards × 5         (existing + delta บรรทัด 3)
├── Budget Alerts         (NEW — ซ่อนถ้าไม่มี ACTIVE campaign)
├── Top Performers 7d     (NEW — ซ่อนถ้าไม่มีข้อมูล)
└── Trend chart           (existing)
```

---

## Files ที่แก้

| File | การเปลี่ยนแปลง |
|------|---------------|
| `src/app/page.tsx` | เพิ่ม computation + render 3 sections ใหม่ |

ไม่มีไฟล์อื่น
