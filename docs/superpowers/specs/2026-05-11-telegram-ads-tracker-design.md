# Telegram Ads Tracker — Design Spec

Date: 2026-05-11

## Overview

Personal web app สำหรับบันทึกและติดตาม campaign ที่ยิงผ่าน Telegram Ads Platform (official) ใช้คนเดียว deploy บน EasyPanel รองรับหลาย campaign พร้อมกัน

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend + API | Next.js 14 (App Router) |
| Styling | TailwindCSS + shadcn/ui |
| Database | PostgreSQL 16 |
| ORM | Prisma |
| TON/USD price | CoinGecko API (free tier) |
| USD/THB rate | ExchangeRate-API (free tier) |
| Auth | Single password via APP_PASSWORD env |
| Deploy | Docker Compose → EasyPanel |

---

## Authentication

- ใช้ password เดียวที่กำหนดใน `APP_PASSWORD` env variable
- กรอก password ครั้งแรก browser จำ session ไว้ผ่าน cookie
- ถ้าไม่มี session redirect ไป /login ทุก route

---

## Data Model

### Campaign

```
id             UUID (PK)
name           String
target_type    Enum: CHANNEL | BOT
target_name    String (@username)
start_date     Date
end_date       Date? (optional)
budget_ton     Decimal
status         Enum: ACTIVE | PAUSED | DONE
note           String? (optional)
created_at     DateTime
updated_at     DateTime
```

### PerformanceEntry

```
id               UUID (PK)
campaign_id      UUID (FK → Campaign)
date             Date
spend_ton        Decimal        — TON ที่ใช้จริงวันนั้น
daily_budget_ton Decimal        — งบที่ตั้งไว้วันนั้น
ton_price_usd    Decimal        — ราคา TON/USD ณ วันที่บันทึก
usd_thb_rate     Decimal        — อัตรา USD/THB ณ วันที่บันทึก
impressions      Int
views            Int
clicks           Int
joins            Int
note             String? (optional)
created_at       DateTime
```

### Calculated Fields (ไม่เก็บใน DB)

| Metric | สูตร |
|--------|------|
| spend_usd | spend_ton × ton_price_usd |
| spend_thb | spend_usd × usd_thb_rate |
| CTR | clicks / impressions × 100 |
| CR | joins / clicks × 100 |
| CPC | spend_usd / clicks |
| CPS | spend_usd / joins |
| CPM | spend_usd / impressions × 1000 |
| BSP | spend_ton / daily_budget_ton × 100 |

---

## Pages

### 1. Dashboard (`/`)
- Summary stats bar: total spend เดือนนี้ (TON + THB), จำนวน active campaigns, avg CTR
- Campaign cards แสดงทุก campaign:
  - ชื่อ, target_type, target_name, status badge
  - BSP progress bar (spend จริง vs daily budget)
  - CTR, CPS
  - กดเข้า Campaign Detail ได้

### 2. Campaign Detail (`/campaigns/[id]`)
- Header: ชื่อ campaign, target, วันเริ่ม-สิ้นสุด, status, note
- Metric cards (6 cards): CTR, CR, CPC, CPS, CPM, BSP (รวม aggregate ทุก entry)
- Performance Log table: แสดงทุก PerformanceEntry พร้อม metric รายวัน
  - columns: วันที่, Spend (TON), BSP, Impressions, Views, Clicks, Joins, CTR, TON ราคา, มูลค่า (฿)
- ปุ่ม: Add Entry, Edit Campaign

### 3. Add Performance Entry (`/campaigns/[id]/entries/new`)
- วันที่ (default = วันนี้)
- งบวันนี้ (daily_budget_ton)
- Spend จริง (spend_ton)
- ราคา TON/USD — ดึงอัตโนมัติจาก CoinGecko, แก้ได้ก่อน save
- อัตรา USD/THB — ดึงอัตโนมัติจาก ExchangeRate-API, แก้ได้ก่อน save
- Impressions, Views, Clicks, Joins
- Note (optional)
- Preview bar: แสดง BSP, CTR, CR, CPC, CPS, CPM, มูลค่า THB แบบ realtime ก่อน save

### 4. Add Campaign (`/campaigns/new`)
- name, target_type (CHANNEL|BOT), target_name
- start_date, end_date (optional)
- budget_ton (งบรวมทั้ง campaign)
- status (default: ACTIVE)
- note (optional)

### 5. Edit Campaign (`/campaigns/[id]/edit`)
- แก้ field ทุกอย่างจาก Add Campaign ได้

### 6. Export / Import (`/settings`)
- Export: ดาวน์โหลด JSON ที่มีทุก campaign + ทุก entry
- Import: อัปโหลด JSON กลับมา (ใช้ restore ข้อมูล)

---

## Rate Fetching

เมื่อเปิดหน้า Add Entry:
1. เรียก CoinGecko API → ดึงราคา TON/USD ล่าสุด
2. เรียก ExchangeRate-API → ดึงอัตรา USD/THB ล่าสุด
3. แสดงค่าใน form พร้อม timestamp "อัปเดตเมื่อ HH:MM"
4. User แก้ค่าได้ก่อน save
5. บันทึก rate ที่ใช้จริงลงใน PerformanceEntry ทุกครั้ง — ไม่ย้อนแก้ retrospectively

---

## Deployment

### Docker Compose (2 containers)

```
services:
  app:   Next.js (port 3000)
  db:    PostgreSQL 16-alpine
```

### Environment Variables

```
DATABASE_URL         postgresql connection string
POSTGRES_USER
POSTGRES_PASSWORD
POSTGRES_DB

APP_PASSWORD         password สำหรับ login
NEXTAUTH_SECRET      random secret string

COINGECKO_API_KEY    optional (free tier ไม่ต้องใช้)
EXCHANGE_RATE_API_KEY
NEXT_PUBLIC_APP_URL  https://ads.yourdomain.com
```

### EasyPanel Steps
1. Push code ขึ้น GitHub/GitLab
2. EasyPanel → New App → Docker Compose
3. ใส่ env vars ใน EasyPanel UI
4. Deploy → EasyPanel build + run อัตโนมัติ
5. Prisma migrate รันตอน app start (`prisma migrate deploy`)

---

## Constraints

- ใช้คนเดียว ไม่มี multi-user, ไม่มี role
- ไม่มี Telegram Ads API integration — manual input เท่านั้น
- ไม่เก็บ ad creative / screenshot
- Rate (TON/USD, USD/THB) เก็บ ณ วันที่บันทึก ไม่ recalculate retrospectively
