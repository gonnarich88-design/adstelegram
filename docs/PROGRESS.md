# Progress Log
> อัปเดตล่าสุด: 2026-07-02 (session 38) | session โดย: Claude

## สถานะปัจจุบัน
**Session 38 — เพิ่มปลายทาง (Placement) แบบไม่ผูกแคมเปญ — commit + push ขึ้น origin/main แล้ว ✅**

## กำลังทำ / ค้างอยู่
- **Analysis Chat** — design spec อนุมัติแล้ว ยังไม่ได้ implement
  - Spec: `docs/superpowers/specs/2026-06-05-analysis-chat-design.md`
  - ต้องสร้าง: `src/app/api/analysis/chat/route.ts` + `src/app/analysis/analysis-chat.tsx`
  - ต้องแก้: `src/app/analysis/analysis-client.tsx` เพิ่ม chat toggle
- **Production migrations ที่ยังไม่ได้ deploy** (รัน `npx prisma migrate deploy` บน server):
  - `add_daily_conversion_breakdown`
  - `add_channel_name_to_breakdown`
  - `add_placement_model`

## เสร็จแล้ว (session 38)
- [x] **feat: เพิ่มปลายทาง (Placement) แบบไม่ผูกแคมเปญ** — เพิ่มปุ่ม "+ เพิ่มปลายทาง" ต่อหมวด (CHANNEL/BOT/SEARCH) บนหน้า `/placements` — สร้าง Placement ได้โดยไม่ต้องผูกแคมเปญ, กันชื่อซ้ำด้วยการเช็ค id ที่ backend คืนกลับมา (`page.tsx`, `placements-client.tsx`) — ทำผ่าน subagent-driven-development (3 task, task review ทุก task + final whole-branch review โดย opus) → **Ready to merge: Yes**, ไม่มี Critical/Important issue — 81 tests pass, production build + browser verified ✅ — pushed ขึ้น `origin/main` แล้ว (commits `ed8e234`, `60c00fa`, `49d4f88`, `5691a79`)
  - Spec: `docs/superpowers/specs/2026-07-01-add-placement-standalone-design.md`
  - Plan: `docs/superpowers/plans/2026-07-01-add-placement-standalone.md`
  - Minor follow-up ที่ยังไม่ทำ (ไม่บล็อก ไม่กระทบข้อมูล): ถ้าพิมพ์ชื่อซ้ำกับ placement แบบ "เก่า" (legacy `Campaign.placementName` string ที่ยังไม่ migrate เป็น M2M) จะเห็นแถวคล้ายซ้ำในหน้าจนกว่าจะ refresh เพราะ client ไม่รู้จัก legacy entry — แก้ได้ด้วยการเพิ่ม `router.refresh()` หลัง add สำเร็จใน `placements-client.tsx`

## เสร็จแล้ว (session 37)
- [x] **feat: Campaign row accordion expand** — กด row → expand panel แสดง entries เดือนปัจจุบัน (filter ด้วย `date.slice(0,7)` ตาม UTC convention เดิม), summary row ด้วย `calcAggregateMetrics`, empty state "ยังไม่มีข้อมูลเดือนนี้", ปุ่ม "ดูทั้งหมด →" เสมอ, ChevronDown rotate 180°, bid chip + pencil ยัง stopPropagation ถูกต้อง — 81 tests pass, browser verified ✅

## เสร็จแล้ว (session 36)
- [x] **feat: Placement master list + many-to-many campaign linking** — Schema `Placement` + `CampaignPlacement` (migration `add_placement_model`), API GET/POST/PATCH/DELETE `/api/placements`, campaign POST/PUT รับ `placementIds[]`, form multi-select dropdown + inline-create, campaign-row/card/detail แสดง placement chips (M2M ก่อน fallback legacy), หน้า `/placements` list + linked campaigns, Nav เพิ่ม "ปลายทาง", export/import ครบ — 81 tests pass ✅ (commit `b812802`)
- [x] **fix: ปลายทาง (placementName) ไม่บันทึกในหน้า Edit Campaign** — `edit/page.tsx` ไม่ได้ส่ง `placementName` เข้า `initialData` ทำให้ form โหลดขึ้นมาว่างเสมอ — เพิ่ม `placementName: campaign.placementName ?? ''` + เพิ่ม field ใน interface ของ `CampaignForm` (ลบ `as any` cast) — 81 tests pass ✅

## เสร็จแล้ว (session 35)
- [x] **fix: BSP ไม่ตรงกันระหว่าง campaign-row กับ performance-table** — สาเหตุ: entries เก็บ `dailyBudgetTon` ขณะบันทึก ถ้าเปลี่ยน budget ภายหลังจะ mismatch — แก้ให้ทั้งสองที่ใช้ `campaign.dailyBudgetTon` (ค่าปัจจุบัน) เป็นหลักเสมอ — `campaign-row.tsx` + `performance-table.tsx` (commits `8eb5639`, `edce4eb`)
- [x] **Conversions: Campaign Breakdown ตามช่องทาง** — บันทึกว่าแต่ละวันมีสมัคร/ฝากมาจากช่องทาง/แคมเปญไหนบ้าง
  - Schema: `DailyConversionBreakdown` model ใหม่ — `channelName String` (key), `campaignId String?` (nullable link), unique `[conversionId, channelName]`, onDelete: SetNull/Cascade — migrations `add_daily_conversion_breakdown` + `add_channel_name_to_breakdown`
  - Form ใหม่: กรอกแบบ channel-first — วันที่ + channel rows (ช่องทาง dropdown | สมัคร | ฝาก | รายการ | ยอดฝาก) + หมายเหตุ — ยอดรวม compute อัตโนมัติจาก sum ของทุก channel row ไม่ต้องกรอกแยก
  - Dropdown: "tgc (organic)" fixed อยู่บนสุด + optgroup แคมเปญทั้งหมดในระบบ (รองรับแคมเปญใหม่อัตโนมัติ) — เลือกซ้ำไม่ได้
  - ตาราง: แถวที่มี breakdown แสดงปุ่ม ▶ กดขยายดูรายละเอียดช่องทาง
  - API POST/PATCH รับ `breakdowns[]` พร้อม `channelName` + `campaignId?` — PATCH ใช้ replace strategy (deleteMany + createMany)
  - export/import: รองรับ `dailyConversionBreakdowns` array ครบถ้วน
  - UX: number inputs ทุกช่อง `onFocus → select()` ไม่ต้องลบ 0 ก่อนพิมพ์
  - 81 tests pass (commits `0cc0f74`, `2de0944`, `27799da`, `a72ce7f`)

## เสร็จแล้ว (session 34)
- [x] **fix: historical TON/USD rate auto-fetch กลับมาทำงาน** — `src/lib/rates.ts`: `fetchHistoricalRates` เปลี่ยนจาก CryptoCompare `histoday` (ตอบ 401 — ต้องใช้ API key แล้ว) → CoinGecko `coins/the-open-network/market_chart/range` (unix timestamp from/to, hourly granularity ใน ~90 วัน) + Frankfurter `.app` → `.dev` (ตัด 301 redirect) — gap-fill logic เดิมไม่เปลี่ยน, browser verified ✅ (deposit form auto-fill TON/USD=1.7046, USD/THB=32.7450, 81 tests pass) — กระทบ: deposit-form, wallet-client (edit allocation), refund-button, csv-import ทั้งหมดใช้ endpoint เดียวกัน

## เสร็จแล้ว (session 33)
- [x] **Dashboard Daily Performance: เพิ่มคอลัมน์ CPR/CPD** — `daily-total-table.tsx`: `sumRows()` คำนวณ `cpr = spendThb/registrations`, `cpd = spendThb/depositCount` (null ถ้าไม่มีข้อมูล), `RowCells` + monthly summary เพิ่ม 2 คอลัมน์ "CPR (฿)"/"CPD (฿)" สีเหลือง (amber) ต่อจาก CPS — สูตรเดียวกับหน้า Conversions, browser verified ✅ (81 tests pass)
- [x] **Dashboard Trend chart: เพิ่มเส้นสมัคร/ฝาก** — `lib/chart.ts`: `ChartDataPoint` เพิ่ม `registrations?`/`depositCount?` (optional, ไม่กระทบ `groupEntriesByDate` เดิม), `page.tsx`: ย้าย `conversionByDate` map ขึ้นมาก่อน merge เข้า `chartData` ตามวันที่, `dashboard-chart.tsx`: เพิ่ม `Line` สีม่วง (สมัคร #c084fc) + สีฟ้า (ฝาก #60a5fa) บน count axis พร้อม `dot={{r:3}}` + `connectNulls` (ข้อมูล conversion มักไม่ครบทุกวัน), legend + tooltip label ภาษาไทย — browser verified ✅ (81 tests pass)

## เสร็จแล้ว (session 32)
- [x] **Inline Bid Edit บน Campaigns list** — กดที่ chip "Bid X.XX TON" หรือ "+ Bid" ได้เลยจากหน้า list โดยไม่ต้องเข้าหน้า edit
  - API: เพิ่ม PATCH `/api/campaigns/[id]` รับเฉพาะ `{ bidCpmTon }` + log changelog
  - `campaign-row.tsx`: เพิ่ม `'use client'`, state `editingBid/bidInput/saving`, Enter=save, Escape=cancel, blur=save
  - `campaign-list.tsx`: เพิ่ม `handleBidUpdate` callback → อัปเดต state ทันทีหลัง save
  - browser verified ✅ (เพิ่ม bid ใหม่, แก้ bid เดิม, Escape ยกเลิก ทุกกรณีทำงานถูก)

## เสร็จแล้ว (session 31)
- [x] **fix: TypeScript build error (campaignScope)** — ลบ `campaignScope: form.campaignScope` บรรทัดเดียวออกจาก `GoalEntryItem.save()` — commit `9bb0fdc` ✅
- [x] **Goals: Campaign dropdown multi-select** — เปลี่ยน checkbox list ยาว → Popover dropdown (search + checkboxes) `CampaignMultiSelectDropdown` component ใน `goals-client.tsx` — commit `59e9973` ✅
- [x] **Goals: Auto-fill Baseline จาก campaign ที่เลือก** — เมื่อเลือก campaign จาก dropdown → baseline textarea auto-fill ด้วย BSP/Bid/CPS, เปลี่ยน CPM → Bid (`bidCpmTon`), เพิ่ม `bidCpmTon` ใน interface + page.tsx query — commit `c63cb4a` ✅
- [x] **fix: campaignIds ไม่ถูก save ตอน edit entry** — `GoalEntryItem.save()` (PATCH) ไม่ได้ส่ง `campaignIds` ทำให้ campaign relation ไม่ถูก update — เพิ่ม `campaignIds: form.campaignIds` ในบอดี้ PATCH — commit `290ce20` ✅
- [x] **Analysis Chat: Design Spec** — brainstorm ครบ → spec อนุมัติ → commit `db0b9cc` ✅

## เสร็จแล้ว (session 30)
- [x] **Goals: Planner form ครบ 6 องค์ประกอบ** — เพิ่ม 4 columns (successCriteria, constraints, risks, doneCriteria) + migration `20260605103157` — 81 tests pass ✅
- [x] **Goals: Collapse/expand cover** — entry card พับแสดงแค่เป้าหมาย + วันที่ กดขยายดูรายละเอียดครบ — commit `2144b05` ✅
- [x] **Goals: Baseline field** — เพิ่ม `baseline String?` + migration `20260605111859`, font-mono, placeholder BSP/CPM/CPS — commit `ee85da5` ✅
- [x] **Goals: Campaign multi-select + relation** — เปลี่ยน `campaignScope String?` → join table `GlobalGoalEntryCampaign` (migration `20260605113123`), form แสดง checkbox list ของแคมเปญ active พร้อม BSP%/CPM/CPS จาก last entry เมื่อ check, ชื่อแคมเปญแสดงเป็น chip สีน้ำเงินใน cover — commit `92c2f10` ✅
- [x] **Goals: Linked planners ใน campaign goal cards** — section "แพลนที่เชื่อม" ด้านล่าง CampaignGoalCard แสดง planner ที่ link มา (วันที่ + เป้าหมาย) — commit `92c2f10` ✅

## เสร็จแล้ว (session 29)
- [x] **Goals: บันทึกรายวันใน "บันทึกรวม"** — เพิ่ม `GlobalGoalEntry` model + migration `20260604125844_add_global_goal_entries`, API GET/POST `/api/goals/entries` + PATCH/DELETE `/api/goals/entries/[id]`, GoalsClient section ใหม่ใต้ textarea (list entries + AddEntryForm + GoalEntryItem inline edit/delete), export/import รองรับ backward compat — browser verified ✅

## เสร็จแล้ว (session 28)
- [x] **AI Analysis Feature — Implementation Plan** — `docs/superpowers/plans/2026-06-04-ai-analysis.md` ✅
- [x] **AI Analysis Feature — Full Implementation** — 5 tasks เสร็จสมบูรณ์, 74 tests pass, browser verified ✅
  - Schema: `AnalysisType` enum + `AiAnalysis` model + `analyses` relation บน Campaign — migration `20260604115359_add_ai_analysis` (commit `49275aa`)
  - lib: `src/lib/analysis.ts` — `buildOverviewPrompt`, `buildCampaignPrompt`, `parseAnalysisResult` + 14 unit tests (commit `a2f2609`)
  - API: `POST /api/analysis` — ดึง DB, สร้าง prompt, เรียก OpenAI gpt-4o via fetch, parse JSON, persist, return (commit `4619d1d`)
  - UI: `src/app/analysis/page.tsx` + `src/app/analysis/analysis-client.tsx` — overview card + per-campaign list + inline expand, JSON.parse error-safe (commit `2e69fa6`)
  - Nav: เพิ่ม "วิเคราะห์" link + `.env.example` เพิ่ม `OPENAI_API_KEY` (commit `6649de0`)

## เสร็จแล้ว (session 26)
- [x] **Campaign List Edit Button** — เพิ่มปุ่ม pencil icon ท้ายแต่ละ campaign row ให้ไปหน้า edit ได้เลย โดยไม่ต้องผ่าน detail — แก้เฉพาะ `campaign-row.tsx` (commit `21f5e67`) — pushed ✅

## เสร็จแล้ว (session 25)
- [x] **Goals Page — Full Implementation** — 8 tasks ครบทุก step, browser verified ✅ (6 commits: `d216624`–`737e661`)
  - Schema: 4 goal fields บน Campaign + GlobalGoal singleton model — migration `20260530185505_add_goals`
  - API: GET/PUT `/api/goals/global` + ขยาย PUT `/api/campaigns/[id]` รับ goal fields (ไม่ log changelog)
  - UI: Server Component `src/app/goals/page.tsx` + Client Component `goals-client.tsx` (global note auto-save + campaign goal cards + PaceBar linear pace)
  - Nav: เพิ่ม "เป้าหมาย" link พร้อม active highlight
  - Export/Import: รองรับ globalGoal + goal fields ทุก campaign + backward compat

## เสร็จแล้ว (session 24)
- [x] **Goals Page — Brainstorm + Design** — ออกแบบหน้า `/goals`: global note (GlobalGoal singleton) + per-campaign goals (goalText, planText, targetJoins, targetDate) + progress bar แบบ linear pace — spec + advisor review ผ่าน ✅
- [x] **Goals Page — Implementation Plan** — เขียน plan ครบ 8 tasks พร้อม code จริงทุก step — `docs/superpowers/plans/2026-05-31-goals-page.md`

## เสร็จแล้ว (session 23)
- [x] **Campaigns: กลุ่มตาม placementType** — เปลี่ยนจาก targetType → placementType (Channels บน / Bots ล่าง / Search / ไม่ระบุ), sort ใน group ตาม startDate desc — แก้แค่ `campaigns/page.tsx` — browser verified ✅
- [x] **Campaigns: กลุ่ม Cancelled ล่างสุด** — แยก CANCELLED ออกจากกลุ่มอื่น แสดงเป็น section ท้ายสุด — browser verified ✅
- [x] **Campaign row: แสดง Bid CPM chip** — chip "Bid X.XX TON" ในบรรทัด metadata ฝั่งซ้าย, ซ่อนถ้า bidCpmTon = null — `campaign-row.tsx` — browser verified ✅

## เสร็จแล้ว (session 22)
- [x] **Daily Performance header: เพิ่ม สมัคร + ฝาก ในแถบสรุปรายเดือน** — accordion header แสดง สมัคร (สีม่วง) และ ฝาก (สีน้ำเงิน) ต่อจาก Joins เดือนที่ไม่มีข้อมูล Conversion จะไม่แสดง — browser verified ✅
- [x] **Campaign Change Log** — บันทึกประวัติการเปลี่ยนแปลงแคมเปญ: schema `CampaignChangeLog` + migration, helper `lib/changelog.ts` (logCampaignChanges + diffCampaignFields), API GET/POST `/api/campaigns/[id]/changelog`, auto-log ใน PUT (field diff + changeNote), refund→CANCELLED, auto-stop→STOPPED, passive reactivate, create "สร้างแคมเปญ", export/import backward compat, UI timeline + manual note form ท้ายหน้า Campaign Detail — browser verified ✅ (9 commits)

## เสร็จแล้ว (session 21)
- [x] **Daily Performance Summary บน Dashboard** — สรุปยอดรวมทุกแคมเปญรายวัน ล่างสุดของหน้า Dashboard: component ใหม่ `DailyTotalTable`, aggregate entries ทุก campaign ที่มีข้อมูลวันนั้น, accordion รายเดือน (ล่าสุดเปิดอัตโนมัติ), columns: Views/Clicks/Joins/Spend TON/฿/CTR/CR/CPC/CPS/BSP, monthly summary row — browser verified ✅ (commit `2a83216`)
- [x] **Daily Performance: เพิ่มคอลัมน์ สมัคร + ฝาก** — join DailyConversion ตาม date เข้า dailyTotals, สมัคร (สีม่วง) / ฝาก (สีน้ำเงิน), แสดง `—` วันที่ไม่มีข้อมูล Conversion, monthly summary รวมยอด — browser verified ✅ (commit `5d4f92a`)
- [x] **Daily Performance: Day/Week toggle** — ปุ่ม รายวัน | รายอาทิตย์, week mode aggregate Mon–Sun UTC, label range "27 เม.ย. – 3 พ.ค.", group ตาม Monday's month — client-side ล้วน (commit `be1c04b`)
- [x] **Daily Performance: Drill-down week → days** — week mode: คลิก week row ที่มี 2+ วัน → ขยาย daily sub-rows ข้างใน, ▶/▼ toggle, muted indent style, หลาย week expand พร้อมกันได้ — browser verified ✅ (commit `bdfa24e`)

## เสร็จแล้ว (session 20)
- [x] **entry form default date → เมื่อวาน** — เปลี่ยน `today` → `yesterday` ใน entry-form.tsx, ปุ่ม "บันทึกวันนี้" → "บันทึกข้อมูล" (commit `df96a44`)
- [x] **Campaign status badge colors** — ACTIVE เขียว, STOPPED เหลือง, CANCELLED แดง (เดิม), PAUSED เทา — เปลี่ยนจาก `variant` เป็น `className` โดยตรง (commit `0d648b1`)
- [x] **Conversions: เพิ่ม depositTxCount** — schema migration `add_deposit_tx_count`, form 5 field: วันที่/สมาชิกสมัครใหม่/สมาชิกที่ฝากเงิน/จำนวนรายการฝาก/ยอดฝาก, API + export/import รองรับ backward compat (commit `9735e94`)
- [x] **auto-activate STOPPED on allocation** — POST `/api/campaigns/[id]/allocation` ทั้ง single-deposit และ FIFO path: ถ้า campaign status = STOPPED → เปลี่ยนเป็น ACTIVE อัตโนมัติ (commit `c23d326`)
- [x] **Wallet: รวม STOPPED ใน dropdown** — filter `ACTIVE | PAUSED | STOPPED` เพื่อให้จัดสรรงบให้ STOPPED campaign ได้ (commit `a1d22c4`)
- [x] **Wallet: newest-first + limit 20 rows** — displayRows reverse + slice(0,20), ปุ่ม "ดูทั้งหมด (X รายการ)" (commit `9c6a7cf`)
- [x] **Conversions: grouped by month + summary cards** — แต่ละเดือนมี header + 6 summary cards (สมาชิกใหม่/ฝากเงิน/รายการฝาก/ยอดฝาก/CPR/CPD) + ตารางรายวัน newest-first (commit `0752f20`)
- [x] **auto-activate STOPPED on page load** — campaign detail page: ถ้า STOPPED แต่ totalSpent < totalAllocated → เปลี่ยนเป็น ACTIVE passive check ตอนเปิดหน้า (commit `bedbb69`)
- [x] **WoW: calendar week + Conversions metrics** — เปลี่ยน rolling 7d → จันทร์–อาทิตย์ UTC, เพิ่มคอลัมน์ Conversions (สมัคร/ฝากเงิน/ยอดฝาก/CPR/CPD), full-width card แยก Ads | Conversions, แสดง date range label (commit `ec26e78`)

## เสร็จแล้ว (session ก่อนหน้า)
- [x] **Daily Conversions feature** — DailyConversion table, /api/conversions CRUD, หน้า /conversions (form + inline-edit table + CPR/CPD), Dashboard strip 30d, export/import — browser verified ✅ (session 19)
- [x] **Daily Conversions — Spec + Plan** — brainstorm → design approved → spec `docs/superpowers/specs/2026-05-28-daily-conversions-design.md` → plan `docs/superpowers/plans/2026-05-28-daily-conversions.md` — รอ implement (session 19)
- [x] **fix: Wallet passbook sort** — swap primary key จาก `date` → `createdAt` ป้องกัน deposit ใหม่กระโดดขึ้นไปก่อน allocation เก่าเมื่อมีวันที่เดียวกัน — running balance ถูกต้องตามลำดับที่บันทึกจริง (session 18)
- [x] **Dashboard V2** — Hero Summary Bar (5 slots) + WoW Strip + Campaign Leaderboard 3×2 (Joins/CPS/Spend/CTR/Clicks/Views) — layout C, ลบ Budget Alerts + Top Performers + Wallet Card + KPI grid เดิม — browser verified ✅ (session 18)
- [x] **Dashboard Enhancements** — delta indicators บน KPI cards (วันนี้ vs เมื่อวาน), Budget Alerts (critical/warning/ok เรียง urgency), Top Performers 7d (Best CPS, Most Startbot/Joins, Best CTR) — browser verified ✅ (session 18)
- [x] **feat: split Trend chart — Joins (CHANNEL) และ Startbot (BOT) แยกเส้นตาม targetType** — groupEntriesByDate แยก field, chart แสดง/ซ่อนเส้นตามข้อมูลจริง, 51 tests pass (session 17)
- [x] **fix: Dashboard tooltip text contrast** — labelStyle + itemStyle ใช้ foreground color แทนสีเส้น (session 17)
- [x] **fix: Dashboard joins label dynamic** — KPI card "Total Joins/Startbot", chart tooltip+legend, CPS subtitle แสดง label ตาม targetType จริง (BOT ล้วน → "Startbot", CHANNEL ล้วน → "Joins", mix → "Joins / Startbot"), ซ่อน subtitle "รวม CHANNEL + BOT" ถ้าไม่ mix — 49 tests pass (session 17)
- [x] **Dashboard Redesign** — aggregate overview (Wallet + 5 KPI cards + Trend chart recharts 7d/30d/ทั้งหมด toggle), campaign grid ย้ายไป `/campaigns` page ใหม่, Nav เปลี่ยนเป็น Campaigns link + startsWith active state — browser verified ✅ (session 16)
  - spec: `docs/superpowers/specs/2026-05-27-dashboard-redesign.md`
  - plan: `docs/superpowers/plans/2026-05-27-dashboard-redesign.md`
- [x] Wallet passbook: แสดงยอด THB (฿) ใต้ตัวเลข TON ทุก row (ฝาก + จัดสรร) — คำนวณจาก rate ที่บันทึกไว้ตอน deposit, allocation ที่ split หลาย deposit ใช้ weighted sum
- [x] Init project: Next.js 16 + Prisma + PostgreSQL + Auth (JWT, single password)
- [x] Docker + EasyPanel deployment configuration
- [x] Fix Prisma v6 + Docker runner issues (copy node_modules, migrate path)
- [x] เพิ่ม `placementName` field + merge targetType/targetName เป็น input เดียว
- [x] แสดง "Startbot" label สำหรับ BOT campaigns แทน Joins (card + table)
- [x] CSV import สำหรับ bulk performance entries
- [x] ย้าย `dailyBudgetTon` ไปอยู่ระดับ Campaign + auto pre-fill ลง entry form
- [x] ขยาย AGENTS.md ด้วย project context + กฎ session/progress + AI behavior rules
- [x] CSV import: รองรับหลายไฟล์พร้อมกัน (multiple file select)
- [x] CSV parser: auto-detect tab/comma delimiter (Telegram Ads export เป็น TSV)
- [x] CSV import: support billing file (Amount TON, comma-decimal) + auto-merge กับ performance file by date
- [x] CSV import: skip "Total" row, fix UTC timezone bug ใน date parsing
- [x] Historical rates: ดึง TON/USD (CryptoCompare) + USD/THB (Frankfurter) รายวันอัตโนมัติ 2 API calls ต่อ import
- [x] ซ่อน Impressions column ทุกที่ (Telegram Ads ไม่มีข้อมูลนี้)
- [x] CTR/CPM ใช้ Views เป็นฐานแทน Impressions
- [x] เพิ่ม CR, CPC, CPS columns ในตาราง
- [x] Redesign performance table: เรียง Views→Clicks→Joins→Spend→฿→stats, CPC/CPS/CPM เป็น ฿
- [x] Metric cards (summary): CPC/CPS/CPM เป็น ฿
- [x] `dailyBudgetTon` เป็น primary required field ใน Campaign (schema migration)
- [x] `budgetTon` เปลี่ยนเป็น optional
- [x] Campaign card: progress bar ใช้ avg BSP จาก entries จริง
- [x] Performance table: จัดกลุ่มรายเดือน + summary row ท้ายแต่ละเดือน
- [x] BSP fix: entries ที่ import โดยไม่มี dailyBudgetTon ใช้ campaign.dailyBudgetTon เป็น fallback
- [x] BSP color scale: แดง (0%) → เหลือง (50%) → เขียว (100%) ทั้งในตารางรายวัน, summary รายเดือน, และ metric card
- [x] **fix: BSP 0.0% บน campaign card** — `campaign-card.tsx` ขาด fallback `|| campaignDailyBudget` (commit `99aa461`)
- [x] fix: JWT_SECRET ใน .env local สั้น 31 ตัว (ต้องการ ≥32) ทำให้ login ไม่ได้ใน local dev
- [x] fix: DATABASE_URL ใน .env local ชี้ไป postgres user ที่ไม่มี — เปลี่ยนเป็น `wolfy@localhost`
- [x] **Monthly Accordion Performance Table** — `performance-table.tsx` เป็น Client Component + useState accordion (commit `0bae611`)
- [x] fix: serialize Prisma Decimal/Date ก่อนส่งไป Client Component ใน campaign detail page (commit `95d5430`)
- [x] feat: แสดง Views/Clicks/Joins รวมรายเดือนใน collapsed header ด้วย (commit `930d879`)
- [x] Edit + Delete PerformanceEntry — edit page `/entries/[id]/edit`, PATCH + DELETE API, action buttons ใน PerformanceTable
- [x] Fragment Wallet Balance — AppSettings model, `/api/settings` GET+PUT, Settings page input, Dashboard wallet card (balance/burn rate/วันคงเหลือ), Campaign card total budget progress bar, export/import backward compat
- [x] fix: BSP คำนวณจาก campaign.dailyBudgetTon เป็นหลัก (ไม่ใช่ entry.dailyBudgetTon)
- [x] fix: CSV import validate NaN rate ก่อน submit — ป้องกัน "Import ล้มเหลว" เมื่อ historical rates ขาดหาย (csv-import.tsx) — แก้กรณี import CSV ตอน budget เก่า แล้วเปลี่ยน budget ใหม่ BSP เพี้ยน (performance-table.tsx + campaign detail page)
- [x] **Wallet System Task 1: Prisma Schema Migration** — ลบ `AppSettings`, เพิ่ม `WalletDeposit` + `CampaignAllocation`, `Campaign` ได้ optional `allocation` relation — migration `20260525000000_wallet_system` applied, 24 tests ผ่าน (commit `6bb9eac`)
- [x] **Wallet System Tasks 4–7: API Routes** — `GET /api/wallet/balance`, `GET+POST /api/wallet/deposits`, `DELETE /api/wallet/deposits/[id]`, `GET+POST+DELETE /api/campaigns/[id]/allocation` — FIFO deposit assignment, 33 tests ผ่าน (commits `04b6a9b`–`95c89e8`)
- [x] **Wallet System Tasks 8–9: UI** — Wallet page (`/wallet`), DepositForm, AllocationCard บน Campaign detail (commits `4ce503d`, `a8fa955`)
- [x] **Wallet System Tasks 10–11: Rate Locking** — EntryForm + CsvImport รับ `allocationRate` prop ล็อค rate จาก deposit (commits `af40343`, `96301be`)
- [x] **Wallet System Tasks 12–14: Integration + Cleanup** — entries/new page ส่ง allocationRate, Dashboard ใช้ computed balance, Settings ลบ wallet card, Nav เพิ่ม Wallet link, ลบ `/api/settings` (commits `0b1ef83`, `4ce5a5a`, `26be88f`)
- [x] **Allocate from Wallet Page** — จัดสรรงบจากหน้า Wallet ได้เลยโดยไม่ต้องไปหน้า Campaign: API POST allocation รับ `depositId` โดยตรง, `AllocateForm` component inline ใน deposit card, WalletClient toggle state, WalletPage fetch unallocated campaigns, Dashboard+CampaignCard แสดงยอดที่จัดสรร (commits `685b286`–`701ecc4`)
- [x] **Wallet Flat-List + allocatedAt** — เพิ่ม `allocatedAt` field ใน CampaignAllocation (schema migration), API expose/accept field, export/import preserve, WalletClient redesign เป็น flat transaction list เรียง desc by date (deposit ↑ เขียว, allocation → แดง), AllocateForm ใหม่มี date picker + ใช้ wallet balance แทน per-deposit max (commits `e57fcc1`–`730ac92`) — browser verified ✅
- [x] **Edit + Delete Allocation** — แก้ไขและลบ allocation ได้จาก wallet page: ปุ่ม "แก้ไข"/"ลบ" ในทุก allocation row, inline edit form พร้อม date picker + amount field (pre-filled, max = balance + allocation เดิม), ไม่มีการเปลี่ยนแปลง API (commit `38e94fa`) — browser verified ✅
- [x] **Campaign Remaining Budget** — แสดง "ใช้ไปแล้ว / คงเหลือ" ใน AllocationCard (campaign detail) และ allocation row (wallet page): คำนวณ SUM(spendTon) ทุก entry, แดงถ้าติดลบ — wallet page ใช้ Prisma groupBy + Map (commit `38e2c0f`)
- [x] **AllocateForm แสดงทุก campaign** — เปลี่ยน query จาก `allocation: null` เป็นทุก campaign พร้อม currentAllocationTon, form แสดง "มีแล้ว X TON" + "ยอดรวมใหม่" (commit `aab2cd1`)
- [x] **Multi-allocation per campaign** — schema migration ลบ `@unique` จาก CampaignAllocation.campaignId, Campaign.allocation → Campaign.allocations[], POST สร้าง record ใหม่เสมอ, edit/delete ใช้ allocation ID ผ่าน `/api/wallet/allocations/[id]`, AllocationCard แสดงยอดรวม + "จัดการใน Wallet →" (commit `d2a6f2c`)
- [x] **fix: AllocateForm ส่ง additional ไม่ใช่ total** — หลัง API เปลี่ยนเป็น CREATE เสมอ ฟอร์มต้องส่งแค่ยอดเพิ่มเติม ไม่ใช่ existingAllocation + additional (commit `fef19fa`)
- [x] **fix: historical rates ขาดเมื่อ range เริ่มวันหยุด** — Frankfurter ไม่มีอัตรา weekend ทำให้ lastThb = 0 สองวันแรก แก้โดย fetch 7 วันก่อน from เพื่อ seed ค่าก่อนเข้า loop (commit `0e6c76e`)
- [x] **Campaign Refund feature — Tasks 1–9 เสร็จ, รอ smoke test** (session 6)
  - Schema: `DepositType` enum (DEPOSIT/REFUND), `CANCELLED` CampaignStatus, `refundCampaignId` + relation ใน WalletDeposit (migration `20260525130329`, commit `8da8c0d`)
  - API: `POST /api/campaigns/[id]/refund` — atomic: สร้าง REFUND deposit + เปลี่ยน status CANCELLED (commit `5b7654b`)
  - UI: `RefundButton` component inline form พร้อม rate auto-fetch (commit `143fd75`)
  - Campaign Detail: CANCELLED badge (destructive), RefundButton ใน header, ซ่อน "+ บันทึกวันนี้" (commit `723a84d`)
  - CampaignCard: CANCELLED badge destructive (commit `723a84d`)
  - Wallet page: include `refundCampaign` relation, ส่ง `type`+`refundCampaignName` (commit `2a913b8`)
  - WalletClient: REFUND rows แสดง ↩ icon + "คืนจากแคมเปญ: [ชื่อ]", ซ่อน "คงเหลือ", ซ่อนปุ่มลบ (commits `2a913b8`, `6241403`)
  - Export/Import: include type+refundCampaignId, backward compat `?? 'DEPOSIT'` (commit `42558bc`)
  - Tests: 35 tests pass, TypeScript clean
  - Spec: `docs/superpowers/specs/2026-05-25-campaign-refund-design.md`
  - Plan: `docs/superpowers/plans/2026-05-25-campaign-refund.md`
- [x] **Task 10: Smoke Test ผ่าน** — browser verified ✅ (session 7)
  - ปุ่ม "ยกเลิกแคมเปญ" แสดงสำหรับ ACTIVE ✅
  - form submit → CANCELLED badge (destructive) ✅, form + "ยกเลิก" หายไป ✅
  - "+ บันทึกวันนี้" หายไป, "แก้ไข" ยังอยู่ ✅
  - Wallet: ↩ row + "คืนจากแคมเปญ: [ชื่อ]" ✅, ไม่มีปุ่มลบ ✅, ไม่แสดง "คงเหลือ" ✅
  - Wallet balance อัปเดตถูกต้อง (100 + 5.5 = 105.5 TON) ✅
  - Dashboard card badge CANCELLED ✅, Active Campaigns → 0 ✅
  - DONE/CANCELLED ไม่แสดงปุ่ม (code verified: `refund-button.tsx:92`) ✅
- [x] **fix: API guard — double-cancel + delete REFUND** (commit `48aec8b`, session 7)
- [x] **Campaign CPM Bid — Tasks 1–7 เสร็จ push แล้ว** (session 9)
  - Schema: `bidCpmTon Decimal?` migration `20260525175704_add_bid_cpm_ton` (commit `670d169`)
  - API: POST/PUT validate + store bidCpmTon (commit `7a43fd5`)
  - Form: field CPM Bid (TON) required ใน grid คู่ Daily Budget (commit `acb5689`)
  - Card: CPM Bid box + ~imp/วัน (commit `1888cd3`)
  - Detail: CPM Bid line + ~imp/วัน ใน header (commit `66278ae`)
  - Export/Import: include bidCpmTon, backward compat `?? null`, test เพิ่มเป็น 36 (commit `e4f35a1`)
  - Edit page: pass bidCpmTon ใน initialData (commit `06fe07c`)
  - `POST /refund` reject 409 ถ้า campaign ถูก CANCELLED แล้ว
  - `DELETE /deposits/[id]` reject 409 ถ้า deposit type = REFUND
- [x] **FIFO Wallet Deposit Pricing** — computeFifoRate ใน lib/wallet.ts (8 unit tests), entries/new ใช้ FIFO แทน latestAllocation, UI แสดง deposit date + remaining TON — browser verified ✅ (session 11)
  - `computeFifoRate(allocations, totalSpentTon)` sort by allocatedAt ASC, walk FIFO, คืน rate ของ batch ปัจจุบัน (commits `13e430f`, `473030e`, `1d6f619`)
- [x] **Campaign Grouping by Target Type** — แบ่ง Dashboard campaign list เป็น 2 sections (CHANNEL / BOT) พร้อม heading + count badge, ซ่อน section ว่าง — แก้แค่ `page.tsx` ไม่มี client state (commit `cf3f95b`, session 12)
- [x] **fix: Wallet transaction sort** — เรียงตาม `createdAt` (เวลากดจริงใน DB) แทน user-facing date — deposit กดก่อนอยู่ล่าง, จัดสรรทีหลังอยู่บน (commit `bd20262`, session 12)
- [x] **fix: FIFO allocation ข้าม deposit** — เดิมต้องหา deposit เดี่ยวที่มีพอ ทำให้ error ทั้งที่ยอดรวมพอ — แก้ให้ตัด deposit เก่าสุดให้หมดก่อนแล้วต่อ deposit ถัดไป (FIFO split) สร้าง allocation records หลายรายการในครั้งเดียว (commit `2acef32`, session 12)
- [x] **fix: REFUND deposit ถูก exclude จาก allocation API** — `where: { type: 'DEPOSIT' }` filter ทำให้ยอดที่คืนจาก campaign ถูก block — ลบ filter ออก รวม REFUND+DEPOSIT ในการคำนวณ FIFO (commit `54eb4c8`, session 13)
- [x] **Wallet history: group FIFO-split rows** — allocation ที่ split ข้าม 2+ deposits แสดงเป็น 1 แถว (groupKey = campaignId+createdAt), total amount, note "(N ยอด)" — ซ่อนปุ่มแก้ไขสำหรับ batch, ลบลบทั้ง batch (commit `54eb4c8`, session 13)
- [x] **Wallet history: FIFO spend display** — "ใช้/เหลือ" ในแต่ละแถวคำนวณ FIFO จริง — ยอด spend ตัดจาก allocation เก่าสุดก่อน แทนที่ `amountTon - totalCampaignSpend` ที่ทำให้ติดลบทุกแถว (commit `9ced84e`, session 13)
- [x] **Wallet history: passbook table** — เปลี่ยน card-list เป็นตาราง 5 คอลัมน์ วันที่/รายการ/ฝาก/ถอน/คงเหลือ, เรียงเก่า→ใหม่, running balance สะสม, summary row ยอดคงเหลือ (commit `0a39653`, session 13)
- [x] **Wallet: THB sub-text ทุก row** — ฝาก: แสดง `$X.XX/TON · ฿X,XXX` ใต้ตัวเลข TON, จัดสรร: แสดง `฿X,XXX` — คำนวณ weighted sum per deposit, FIFO-correct (session 14)
- [x] **Wallet: THB balance header/footer** — ยอดคงเหลือ TON มี `≈ ฿X,XXX` subtitle, footer row แสดง THB ใต้ TON — คำนวณ `Σ (remaining × tonPriceUsd × usdThbRate)` ต่อ deposit (session 14)
- [x] **Wallet: filter CANCELLED/DONE จาก AllocateForm** — ช่อง Campaign ใน form จัดสรรแสดงเฉพาะ ACTIVE และ PAUSED (session 14)
- [x] **Wallet: แสดง rate ต่อ deposit row** — `$X.XX/TON · ฿XX,XXX` แสดงใต้ยอด TON ทุก deposit row สำหรับ cross-deposit comparison (session 14)
- [x] **Deposit edit + delete** — ปุ่มแก้ไข/ลบใน deposit rows: inline edit form (amountTon, วันที่, tonPriceUsd, usdThbRate, note) พร้อม auto-fetch rate by date, PATCH API validate amountTon ≥ totalAllocated, ล็อก delete ถ้ามี allocation (commit `e14b78c`, session 15)
- [x] **Auto-stop depleted campaigns** — status ใหม่ `STOPPED` (migration `20260527074851_add_stopped_status`): หลัง POST entry (single+bulk) ถ้า totalSpent ≥ totalAllocated และ status=ACTIVE → เปลี่ยนเป็น STOPPED อัตโนมัติ, passive check บน dashboard+detail page สำหรับ campaigns ที่ depleted ก่อนเปิด feature (commits `55d500e`, `126bd97`, session 15)

## ขั้นตอนถัดไป (chat ใหม่)
1. **Deploy + migrate** — รัน `npx prisma migrate deploy` บน production หลัง deploy เพื่อสร้างตาราง `DailyConversionBreakdown`
2. **Analysis Chat** — implement ตาม spec ที่อนุมัติแล้ว (`docs/superpowers/specs/2026-06-05-analysis-chat-design.md`)
3. **(optional, low priority) fast-follow หน้า /placements** — เพิ่ม `router.refresh()` ใน `placements-client.tsx` หลัง add placement สำเร็จ เพื่อแก้ 2 จุด minor: (a) ตัวเลขรวม "N ปลายทาง" บนหัวหน้า (server-computed, ไม่ live update) กับตัวนับต่อหมวด (client-computed, live) เห็นไม่ตรงกันชั่วคราวหลัง add, (b) เคสพิมพ์ชื่อซ้ำกับ legacy placement (`Campaign.placementName` ที่ยังไม่ migrate) จะดูเหมือนมีแถวซ้ำจนกว่าจะ refresh

## Decision log
- 2026-05-11: ใช้ single-password auth + JWT cookie แทน NextAuth — ระบบใช้คนเดียว ไม่ต้องการ multi-user
- 2026-05-11: ใช้ Prisma Decimal(18,8) สำหรับ TON amount — หลีกเลี่ยง floating point error
- 2026-05-20: merge targetType + targetName เป็น input เดียว — ลด UX friction
- 2026-05-21: dailyBudgetTon อยู่ระดับ Campaign แล้ว pre-fill ลง entry — ข้อมูล Campaign เป็นต้นทาง
- 2026-05-22: CTR/CPM ใช้ Views ไม่ใช่ Impressions — Telegram Ads ไม่ expose Impressions
- 2026-05-22: Historical rates ใช้ CryptoCompare + Frankfurter (ฟรี ไม่ต้อง API key ใหม่) — 2 calls ต่อ import — **[REVERSED 2026-06-13]** CryptoCompare เปลี่ยนนโยบาย ตอบ 401 ต้องใช้ API key แล้ว
- 2026-06-13: Historical TON/USD เปลี่ยนเป็น CoinGecko `market_chart/range` (ไม่ต้อง API key, รองรับ from/to unix timestamp ภายใน 365 วันจาก "now") + Frankfurter `.dev` แทน `.app` — ยังคง 2 calls ต่อ import
- 2026-05-22: BSP fallback ใช้ campaign.dailyBudgetTon แทนการ migrate data เก่า — non-destructive fix
- 2026-05-22: swap budgetTon/dailyBudgetTon nullability — dailyBudgetTon required, budgetTon optional
- 2026-05-22: BSP color ใช้ HSL interpolation (hue 0°→120°) — ไม่ใช้ Tailwind class เพราะ dynamic value ไม่ work ใน production build
- 2026-05-23: monthly accordion ใช้ Client Component + useState<Set<string>> — ไม่เก็บ state ใน URL เพราะไม่จำเป็น
- 2026-05-23: weekly view เลื่อนไปทำ phase ถัดไป — monthly accordion ก่อน ลด complexity
- 2026-05-24: ต้อง serialize Decimal/Date จาก Prisma ก่อนส่งไป Client Component — Next.js 19 ไม่อนุญาต non-plain objects ข้าม Server/Client boundary
- 2026-05-24: AppSettings ใช้ id=1 fixed row (singleton pattern) — ไม่มี multi-row settings
- 2026-05-24: walletBalanceTon = 0 → ซ่อน wallet card บน Dashboard, แสดงเมื่อ > 0 เท่านั้น
- 2026-05-24: burn rate 7d = avg daily spend จาก entries ที่มีวันที่อยู่ใน 7 วันล่าสุด ÷ 7
- 2026-05-24: BSP ใช้ campaign.dailyBudgetTon เป็น primary — เหตุผล: single-user, campaign budget คือ "target" ที่ถูกต้องเสมอ, เปลี่ยน budget = เปลี่ยน target ทั้ง campaign

## ปัญหา / ข้อควรระวังที่เจอ
- Prisma v6 ใน Docker: ต้อง copy `node_modules` ทั้งหมดไปยัง runner stage และใช้ `PRISMA_CLIENT_ENGINE_TYPE=library` ตอน build
- Decimal จาก Prisma: ต้อง `Number(value)` ก่อนคำนวณทุกครั้ง ไม่งั้น arithmetic ผิด
- Next.js 16 มี breaking changes — อ่าน `node_modules/next/dist/docs/` ก่อนเขียนโค้ดเสมอ
- Telegram Ads CSV เป็น TSV (tab-separated) ไม่ใช่ comma — ต้อง auto-detect delimiter
- Billing file ใช้ comma เป็น decimal separator (`1,339` = 1.339 TON) — European format
- "Total in May 2026" row ใน billing file ถูก JS parse เป็น date — ต้อง skip ด้วย regex
- UTC timezone bug: `new Date('1 May 2026').toISOString()` ให้วันผิดใน UTC+7 — ใช้ `getFullYear/getMonth/getDate` แทน
- schema change ที่ทำ nullable field ต้องตรวจ TypeScript ทุกไฟล์ที่ใช้ field นั้น (budgetTon.toString() → budgetTon?.toString())
- ~~CoinGecko market_chart/range ใช้ไม่ได้บน free tier สำหรับ date range ที่ต้องการ — ใช้ CryptoCompare histoday แทน~~ **[แก้ 2026-06-13]** ทดสอบจริงแล้ว market_chart/range ใช้ได้ปกติ (from/to เป็น unix timestamp, ขอย้อนหลังได้ไม่เกิน 365 วันจาก "now" จริงของ CoinGecko) — สาเหตุที่พังคือ CryptoCompare ตอบ 401 (ต้องใช้ API key) ไม่ใช่ CoinGecko
- local .env: JWT_SECRET ต้องมี ≥32 ตัวอักษร และ DATABASE_URL ต้องใช้ user ที่มีจริงใน local PostgreSQL
- CampaignAllocation เคยเป็น @unique campaignId — เปลี่ยนเป็น @index แล้ว (multi-allocation) ระวัง code เก่าที่ใช้ `campaign.allocation` (singular) ต้องเปลี่ยนเป็น `campaign.allocations[]`
- Frankfurter API ไม่มีอัตราวันหยุดสุดสัปดาห์/นักขัตฤกษ์ — ต้อง seed lastThb จากวันก่อน from เสมอ ไม่งั้น weekend range start ขาด rate 2 วัน
