# เพิ่มปลายทาง (Placement) แบบไม่ผูกแคมเปญ

## บริบท

หน้า `/placements` แสดง `Placement` (M2M ผ่าน `CampaignPlacement`) จัดกลุ่มตาม CHANNEL/BOT/SEARCH พร้อม chip ชื่อแคมเปญที่ผูกอยู่ ตอนนี้วิธีเดียวที่สร้าง `Placement` ใหม่ได้คือพิมพ์ชื่อใหม่ในช่อง multi-select ตอนสร้าง/แก้ไข Campaign (`campaign-form.tsx`) ผู้ใช้ต้องการเพิ่ม Placement ล่วงหน้าได้จากหน้า `/placements` เอง โดยยังไม่ต้องผูกกับแคมเปญใด ๆ — ถ้ามีแคมเปญไหนมาผูกทีหลัง (ผ่าน campaign form ตามปกติ) chip ก็จะขึ้นเองอัตโนมัติ

Backend (`Placement` model + `POST /api/placements`) รองรับการสร้างแบบไม่ผูกแคมเปญอยู่แล้ว ไม่ต้องแก้ schema หรือ API — งานนี้เป็นการเพิ่ม UI ล้วน ๆ

## ดีไซน์

**`src/app/placements/page.tsx`**
- เปลี่ยนการ build `sections`: แสดง CHANNEL/BOT/SEARCH เสมอแม้ยังไม่มี placement ในหมวดนั้น (ตัดเงื่อนไข `s.m2m.length + s.legacy.length > 0` ออกสำหรับ 3 หมวดนี้ คง filter ไว้เฉพาะ `OTHER`)
- ลบ block "empty state เต็มหน้า" (`total === 0 ? ... : <PlacementsClient .../>`) เพราะแต่ละหมวดจะมีปุ่มเพิ่มของตัวเองอยู่แล้วแม้ว่างเปล่า — เรนเดอร์ `<PlacementsClient>` ตรง ๆ เสมอ
- ลบ import `MapPin` ที่จะเหลือ unused หลังลบ block ข้างต้น

**`src/app/placements/placements-client.tsx`**
- เพิ่ม state ต่อหมวด (key ด้วย `typeKey`): กำลังเปิดฟอร์มเพิ่มอยู่ไหม, ชื่อที่พิมพ์, error message, saving flag, และรายการ placement ที่เพิ่งเพิ่มสำเร็จในเซสชันนี้ (`addedPlacements: Record<string, PlacementItem[]>`)
- ท้ายแต่ละหมวด (หลัง list ของ m2m + legacy, ก่อนปิด section) เพิ่มปุ่ม "+ เพิ่มปลายทาง" → กดแล้วโผล่ inline input (สไตล์เดียวกับแถว edit ที่มีอยู่) กรอกแค่ชื่อ (name) → Enter/ปุ่ม save = submit, Escape/ปุ่ม X = ยกเลิก
- Submit → `POST /api/placements` ส่ง `{ name, type: section.typeKey }`
  - ถ้า id ที่ตอบกลับมามีอยู่แล้วใน state `placements` (แปลว่าเป็นชื่อซ้ำกับที่มีอยู่แล้ว ไม่ว่าหมวดไหน — เพราะ backend ใช้ `upsert` แล้วคืนของเดิมโดยไม่ error) → แสดง error "มีปลายทางชื่อนี้อยู่แล้ว" ไม่เพิ่มแถวซ้ำ
  - ถ้าเป็น id ใหม่จริง → สร้าง `PlacementItem` ด้วย `campaigns: []` เสมอ (ของใหม่ยังไม่มีแคมเปญผูก ไม่ต้องพึ่ง shape ของ response.campaigns ซึ่งไม่ตรง type) ใส่เข้า `placements` state (เพื่อให้ edit/delete ที่มีอยู่ทำงานกับมันได้ปกติ) และเข้า `addedPlacements[typeKey]`
- จุดที่ compute `visibleM2m` ของแต่ละหมวด เปลี่ยนจาก `section.m2m.filter(...)` เป็น `[...section.m2m, ...(addedPlacements[typeKey] ?? [])].filter(p => !deletedIds.has(p.id))` — ตัวนับ "· N ปลายทาง" คำนวณจาก array นี้อยู่แล้วจึงอัปเดตอัตโนมัติ

**ไม่แตะ**: schema.prisma, migration, API routes (`/api/placements`, `/api/placements/[id]`) — ใช้ของเดิมได้ตรง ๆ

## Known limitation (ยอมรับ ไม่ต้องแก้)

ตัวเลข "N ปลายทาง" ในหัวข้อบนสุดของหน้า (`page.tsx` — `{total} ปลายทาง`) คำนวณฝั่ง server ตอน request แรกเท่านั้น จะไม่อัปเดตทันทีตอนเพิ่ม/ลบฝั่ง client (ต้อง refresh) — พฤติกรรมเดิมเป็นแบบนี้อยู่แล้วสำหรับปุ่ม delete จึงถือว่าเป็น scope เดิม ไม่ใช่ regression ใหม่

## Scope / Reversibility

R2 — แก้ UI component + เพิ่ม field optional ผ่าน API ที่มีอยู่แล้ว ไม่แตะ schema/auth/data-destructive path
