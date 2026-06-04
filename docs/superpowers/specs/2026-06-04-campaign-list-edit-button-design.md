# Campaign List — Edit Button

**Date:** 2026-06-04  
**Status:** Approved

## Problem

หน้า `/campaigns` แสดง campaign แต่ละแถวเป็น `<Link>` เต็มแถว ผู้ใช้ต้องเข้า campaign detail แล้วกด "แก้ไข" อีกที ไม่สะดวกเมื่อต้องการแก้ข้อมูลหลาย campaign ต่อกัน

## Goal

เพิ่มปุ่ม edit icon บน campaign row ให้กดได้เลยจากหน้า campaigns list โดยไม่เพิ่ม complexity หรือ API ใหม่

## Design

### Behavior

- ทุก campaign row (รวม CANCELLED) มีปุ่ม pencil icon ท้ายแถว
- คลิกปุ่ม → navigate ไปหน้า `/campaigns/[id]/edit` ที่มีอยู่แล้ว
- คลิกส่วนอื่นของ row → navigate ไปหน้า `/campaigns/[id]` (เหมือนเดิม)

### Component Change — `campaign-row.tsx`

**ปัจจุบัน:** `<Link>` ครอบทั้ง row

```
<Link href="/campaigns/[id]">
  [ชื่อ + meta] [metrics] [ChevronRight]
</Link>
```

**หลังแก้:** outer container เป็น `<div>` flex, แยก content link กับ edit button

```
<div flex>
  <Link href="/campaigns/[id]" flex-1>   ← content area
    [ชื่อ + meta] [metrics] [ChevronRight]
  </Link>
  <Link href="/campaigns/[id]/edit">     ← edit button
    <Pencil icon />
  </Link>
</div>
```

### Visual

- ปุ่ม edit: `w-8 h-8`, icon `Pencil` ขนาด 14px, style `rounded-md border border-border bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted transition-colors`
- วางระหว่าง metrics กับขอบขวาของแถว, `shrink-0`
- outer container รับ style `hover:bg-muted/30` ที่เคยอยู่บน `<Link>` มาอยู่แทน

## Scope

- แก้เฉพาะ `src/components/campaign-row.tsx`
- ไม่แตะ schema, API, หรือไฟล์อื่น
- ไม่เพิ่ม state ใหม่

## Testing

- รัน `npm test` — 44 tests ผ่าน (ไม่มี unit test สำหรับ UI component นี้)
- Browser verify: คลิก content area → detail page, คลิกปุ่ม pencil → edit page
