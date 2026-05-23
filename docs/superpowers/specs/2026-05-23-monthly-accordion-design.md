# Monthly Accordion Performance Table

**Date:** 2026-05-23  
**Status:** Approved

## Problem

หน้า Campaign Detail แสดงข้อมูลทุกเดือนพร้อมกันในตารางยาว ทำให้อ่านยากเมื่อมีข้อมูลหลายเดือน

## Solution

เปลี่ยน `PerformanceTable` ให้แสดงข้อมูลแบบ accordion ยุบ/ขยายทีละเดือน โดยเดือนล่าสุดขยายไว้อัตโนมัติ

## Behaviour

- **Default state**: เดือนล่าสุดขยาย, เดือนเก่ากว่าทั้งหมดยุบ
- **Toggle**: คลิก header ของเดือนเพื่อขยาย/ยุบ
- **Multi-open**: เปิดหลายเดือนพร้อมกันได้ (ไม่บังคับปิดเดือนอื่น)
- **State scope**: `useState` ใน Client Component — reset เมื่อ refresh หน้า (ไม่เก็บใน URL)

## Month Header (ทั้งยุบและขยาย)

```
[ ชื่อเดือน ปี   N วัน ]  [ ฿spend   BSP XX%   ▲/▼ ]
```

- ซ้าย: ชื่อเดือน + จำนวนวัน
- ขวา: total spend ฿ (สีเขียว) + Avg BSP พร้อม color scale (แดง→เหลือง→เขียว) + chevron ▲/▼
- Header แสดง summary เสมอ ไม่ว่าจะยุบหรือขยาย — ให้ scan ภาพรวมทุกเดือนได้ทันที

## Expanded Content

ตาราง daily rows เหมือนปัจจุบันทุกอย่าง:
- Header row: วันที่, Views, Clicks, Startbot/Joins, Spend (TON), มูลค่า (฿), CTR, CR, CPC, CPS, CPM, BSP
- Daily rows: เรียงจากใหม่ไปเก่า
- Summary row "รวมเดือน": ท้ายสุดของ expanded section

## Code Changes

**`src/components/performance-table.tsx`**
- เพิ่ม `'use client'` directive
- เพิ่ม `useState<Set<string>>` เก็บ key เดือนที่เปิด (YYYY-MM format) — initial = key เดือนล่าสุด
- เปลี่ยน month header จาก `<tr>` ใน `<table>` เป็น clickable div นอกตาราง
- Render table + rows เฉพาะเดือนที่อยู่ใน open set (conditional render ไม่ใช่ CSS hidden)
- แต่ละเดือนอยู่ใน container แยก มี border-radius และ border รอบ

## Scope

- แก้ `performance-table.tsx` ไฟล์เดียว
- ไม่แก้ `page.tsx`, `metrics.ts`, `bsp-color.ts`, หรือ API ใดๆ
- ไม่เพิ่ม dependency ใหม่

## Out of Scope

- Weekly grouping (ทำในรอบหน้า)
- URL-based state persistence
- Animation/transition CSS
