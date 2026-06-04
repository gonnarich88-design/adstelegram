# Campaign Manual Sort Order — Design Spec
> Date: 2026-06-04

## Overview

Allow the user to manually reorder campaigns within each placement-type group (Channels, Bots, Search, ไม่ระบุ) using ▲ ▼ buttons. Order is persisted to the database.

---

## Schema

Add `sortOrder` field to `Campaign`:

```prisma
sortOrder Int @default(0)
```

- All existing campaigns default to `0` (safe — tiebreaker `createdAt desc` preserves current display order)
- Migration required: `npx prisma migrate dev`

---

## Query Change

`campaigns/page.tsx`:

```ts
orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }]
```

---

## API

New endpoint: `PATCH /api/campaigns/reorder`

Request body: `[{ id: string, sortOrder: number }]`

- Validates array is non-empty
- Runs `prisma.$transaction` to update all records atomically
- Returns `200 OK`

---

## Swap Logic (Client-Side)

Before swapping, always materialize sequential sortOrders for the group to avoid the all-zero problem:

1. Get current ordered list of campaigns in the group (as displayed)
2. Assign sequential sortOrder: index 0 → 0, index 1 → 1, ...
3. Swap the two target indices
4. Send **all records in the group** to `PATCH /api/campaigns/reorder` (not just changed ones — avoids sortOrder collision when multiple items share the same value)

Example — pressing ▲ on Bot_v3 (index 1):
```
Before:  [Bot_v2(0), Bot_v3(0), Bot_v4(0)]
Assign:  [Bot_v2(0), Bot_v3(1), Bot_v4(2)]
Swap:    [Bot_v3(0), Bot_v2(1), Bot_v4(2)]
Send:    [{id: Bot_v3, sortOrder:0}, {id: Bot_v2, sortOrder:1}, {id: Bot_v4, sortOrder:2}]
```

---

## UI

### Component Split

`campaigns/page.tsx` (Server Component) fetches campaigns and passes to:

`CampaignList` (new Client Component) — handles:
- Rendering each group with ▲ ▼ buttons
- Optimistic state update on click
- API call to persist order

### Button Visibility

- First item in group: hide ▲, show ▼
- Last item in group: show ▲, hide ▼
- Only item in group: hide both (no buttons rendered)

### Placement

Buttons appear at the left edge of each row, small and unobtrusive (16px icons, muted color, hover highlight).

---

## No New Dependencies

Uses only `useState`, `useCallback`, and native `fetch`. No drag-and-drop library.

---

## Cancelled Group

Cancelled campaigns are excluded from reordering (no ▲ ▼ buttons rendered for that section).

---

## Scope

- Does NOT affect Goals page, Dashboard, or any other view
- Does NOT reorder within the Cancelled group
- sortOrder is global per campaign but only compared within group context
