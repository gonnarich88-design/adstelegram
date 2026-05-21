<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

## ภาพรวมโปรเจกต์

ระบบ **AdsGram** สำหรับบันทึกและวิเคราะห์ประสิทธิภาพแคมเปญโฆษณา Telegram ที่จ่ายด้วยเหรียญ TON
- ติดตามยอด Spend, Impressions, Views, Clicks, Joins รายวัน
- รองรับ 2 ประเภทเป้าหมาย: **CHANNEL** และ **BOT** (BOT แสดง Startbot แทน Joins)
- แปลงค่าใช้จ่าย TON → USD → THB อัตโนมัติ (ดึง rate จาก exchangerate-api.com)
- Backup/Restore ข้อมูลทั้งหมดเป็น JSON ได้ (ผ่านหน้า Settings)
- Import ข้อมูลประสิทธิภาพรายวันจาก Telegram Ads CSV ได้
- ระบบ Auth แบบ password เดียว + JWT (ไม่มี multi-user)

---

## Tech Stack & เวอร์ชัน

| เทคโนโลยี | เวอร์ชัน | หมายเหตุ |
|-----------|---------|---------|
| Next.js | 16.2.6 | App Router, standalone output |
| React | 19.2.4 | Server Components by default |
| TypeScript | 5.x | strict mode |
| Prisma | 6.1.0 | ORM, PostgreSQL |
| PostgreSQL | (docker) | ผ่าน docker-compose |
| Tailwind CSS | 4.x | ใช้ @tailwindcss/postcss |
| shadcn/ui | 4.7.0 | components ใน src/components/ui/ |
| react-hook-form | 7.x | + @hookform/resolvers + zod |
| zod | 4.x | validation schema |
| jose | 6.x | JWT sign/verify |
| Vitest | 4.x | unit tests |
| lucide-react | 1.x | icons |

---

## คำสั่งสำคัญ

```bash
# Development
npm run dev                           # start dev server (port 3000)
npm run build                         # build production (ใช้ PRISMA_CLIENT_ENGINE_TYPE=library)
npm run start                         # run production build
npm test                              # run unit tests (vitest run)
npm run test:watch                    # watch mode

# Prisma
npx prisma migrate dev                # สร้าง migration ใหม่
npx prisma migrate deploy             # apply migrations (production)
npx prisma generate                   # regenerate Prisma client
npx prisma studio                     # GUI สำหรับดู database

# Docker
docker-compose up -d                  # start db + app
docker-compose down                   # stop
```

---

## โครงสร้างโฟลเดอร์หลัก

```
src/
├── app/                        # Next.js App Router pages
│   ├── page.tsx                # Dashboard: รายการ Campaign + summary metrics
│   ├── layout.tsx              # Root layout + Nav
│   ├── login/page.tsx          # Login page (password-based)
│   ├── settings/page.tsx       # Backup: Export/Import ข้อมูลทั้งหมดเป็น JSON
│   ├── campaigns/
│   │   ├── new/page.tsx        # สร้าง Campaign ใหม่
│   │   └── [id]/
│   │       ├── page.tsx        # Campaign detail + performance entries
│   │       ├── edit/           # แก้ไข Campaign
│   │       └── entries/route.ts # API: GET entries / POST entry (single หรือ bulk array)
│   └── api/
│       ├── auth/login/         # POST: login → set JWT cookie
│       ├── auth/logout/        # POST: clear JWT cookie
│       ├── campaigns/          # GET/POST campaigns
│       ├── campaigns/[id]/     # GET/PUT/DELETE campaign
│       ├── export/             # GET: export JSON backup / POST: import JSON backup (ลบทั้งหมดแล้ว restore)
│       └── rates/              # GET: fetch TON/USD + USD/THB rates
├── components/
│   ├── ui/                     # shadcn/ui base components (button, card, input, ฯลฯ)
│   ├── campaign-card.tsx       # การ์ดแสดง Campaign summary
│   ├── campaign-form.tsx       # Form สร้าง/แก้ไข Campaign
│   ├── csv-import.tsx          # Import PerformanceEntry จาก CSV
│   ├── entry-form.tsx          # Form บันทึก PerformanceEntry รายวัน
│   ├── metric-cards.tsx        # แสดง KPI metrics
│   ├── nav.tsx                 # Navigation bar
│   └── performance-table.tsx   # ตาราง PerformanceEntry
├── lib/
│   ├── auth.ts                 # JWT sign/verify + middleware helpers
│   ├── export.ts               # logic export/import JSON backup (exportData / importData)
│   ├── metrics.ts              # คำนวณ aggregate metrics (CPM, CPC, CTR ฯลฯ)
│   ├── prisma.ts               # Prisma client singleton
│   ├── rates.ts                # ดึง exchange rate จาก API
│   └── utils.ts                # cn() และ utilities ทั่วไป
└── middleware.ts                # Auth guard: redirect ถ้าไม่มี JWT

prisma/
├── schema.prisma               # Database schema (Campaign, PerformanceEntry)
└── migrations/                 # Migration files

tests/                          # Vitest unit tests (auth, export, metrics, rates)
docs/                           # Documentation และ PROGRESS.md
scripts/start.sh                # Entrypoint สำหรับ Docker
```

---

## Data Model หลัก

**Campaign** — แคมเปญโฆษณา
- `targetType`: `CHANNEL` | `BOT`
- `budgetTon`: งบประมาณรวม (Decimal 18,8)
- `dailyBudgetTon`: งบประมาณรายวัน (optional)
- `placementName`: ชื่อ placement (optional)
- `status`: `ACTIVE` | `PAUSED` | `DONE`

**PerformanceEntry** — ข้อมูลประสิทธิภาพรายวัน
- `spendTon`, `dailyBudgetTon`, `tonPriceUsd`, `usdThbRate`
- `impressions`, `views`, `clicks`, `joins`

---

## Convention การเขียนโค้ด

- **Components**: PascalCase (`CampaignCard`, `EntryForm`)
- **Files**: kebab-case (`campaign-card.tsx`, `entry-form.tsx`)
- **API routes**: ใช้ Next.js App Router route handlers (`route.ts`)
- **Server Components**: default สำหรับ pages — ดึงข้อมูลจาก Prisma ได้เลย
- **Client Components**: เพิ่ม `'use client'` เมื่อต้องใช้ state/event handlers
- **Decimal**: Prisma ส่งมาเป็น `Decimal` object → ต้อง `Number(value)` ก่อนคำนวณ
- **Auth**: ตรวจสอบ JWT ผ่าน `middleware.ts` — API routes ที่ต้องการ auth ให้ตรวจ cookie ด้วยตัวเอง
- **Validation**: ใช้ zod schema + react-hook-form บน Client, zod อีกครั้งบน API route
- **Styling**: Tailwind utility classes เท่านั้น ห้ามเขียน CSS เพิ่มเติม (ยกเว้น globals.css)
- **Icons**: lucide-react เท่านั้น
- **`export const dynamic = 'force-dynamic'`**: ใส่ทุก page ที่ดึงข้อมูลจาก DB

---

## Environment Variables (ชื่อ key เท่านั้น)

```
DATABASE_URL          # PostgreSQL connection string
POSTGRES_USER         # (docker-compose)
POSTGRES_PASSWORD     # (docker-compose)
POSTGRES_DB           # (docker-compose)
APP_PASSWORD          # password สำหรับ login เข้าระบบ
JWT_SECRET            # secret สำหรับ sign JWT (min 32 chars)
EXCHANGE_RATE_API_KEY # API key จาก exchangerate-api.com
NEXT_PUBLIC_APP_URL   # URL สาธารณะของแอป
```

---

## ข้อห้าม / สิ่งที่ต้องระวัง

- **ห้าม** เพิ่ม dependency ใหม่โดยไม่จำเป็น — ใช้ของที่มีอยู่แล้วก่อน
- **ห้าม** เขียน raw SQL — ใช้ Prisma เท่านั้น
- **ห้าม** เก็บ exchange rate ไว้ใน DB — ดึง live ทุกครั้งที่ entry ใหม่
- **ห้าม** ลืม `Number()` เมื่อรับค่า `Decimal` จาก Prisma มาคำนวณ
- **ระวัง** Next.js 16 มี breaking changes จากเวอร์ชันก่อน — อ่าน `node_modules/next/dist/docs/` ก่อนเสมอ
- **ระวัง** `PRISMA_CLIENT_ENGINE_TYPE=library` ต้องมีตอน build เท่านั้น (อยู่ใน npm script แล้ว)
- **ห้าม** commit `.env` — ใช้ `.env.example` เป็น template
- **ห้าม** เพิ่ม multi-user หรือ role system — ระบบนี้ใช้คนเดียว single password

---

## เมื่อเริ่ม session ใหม่
- ก่อนทำงานใดๆ ให้อ่าน docs/PROGRESS.md แล้วสรุปสั้นๆ ให้ผู้ใช้ฟังว่า
  ตอนนี้โปรเจกต์อยู่จุดไหน ค้างอะไร ขั้นตอนถัดไปคืออะไร

## กฎการบันทึก Progress (ทำอัตโนมัติ ไม่ต้องรอสั่ง)
- หลังแก้ไฟล์เสร็จแต่ละชิ้นงาน ให้เติม docs/PROGRESS.md ทันทีแบบสั้นๆ:
  ย้ายงานที่เสร็จไปหัวข้อ "เสร็จแล้ว" อัปเดต "กำลังทำ/ค้างอยู่" และวันที่ด้านบน
- เมื่อผู้ใช้บอกว่าจะจบงาน/จะปิดแชท หรือพิมพ์คำว่า "จบ"/"สรุป"/"wrap up"
  ให้เรียบเรียง docs/PROGRESS.md ใหม่ทั้งไฟล์: ระบุให้ชัดว่าค้างตรงไหน
  ไฟล์ไหน commit แล้วยัง เขียน "ขั้นตอนถัดไป" ให้คนอื่นทำต่อได้ทันที
  บันทึก decision และปัญหาใหม่ แล้วแจ้งผู้ใช้ว่าอัปเดตเสร็จแล้ว
