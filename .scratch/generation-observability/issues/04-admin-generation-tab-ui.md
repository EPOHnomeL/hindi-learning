# 04 — `/admin` "Generation" tab UI

**Status:** open · **Blocked by:** [02](02-admin-queries-live-and-history.md)
**PRD:** [`../PRD.md`](../PRD.md)

## What to build

A third tab in the **sys-admin** dashboard (`src/app/_components/AdminPanel.tsx`,
`SysAdminDashboard`) — "Generation" — alongside Allowlist and Tenants. Tenant
admins never see it (they don't reach `SysAdminDashboard`).

### Layout

A `GenerationManager` section with two blocks, both live `useQuery` reads:

- **Generating now** (`api.routine.generatingNow`)
  - Empty → "Nothing generating right now."
  - Each entry: course title, an elapsed time from `startedAt` (e.g. "3m ago" /
    live-ish; a simple relative string is fine), and a "stale — will retry" chip
    when `stale` is true.
- **History** (`api.routine.runHistory`)
  - Empty → "No runs recorded yet."
  - Reverse-chronological rows: course title, an outcome badge
    (`published` / `nothing` / `failed` with distinct colours — reuse the existing
    badge/pill styling), the produced Lesson title for `published`, the timestamp
    (`endedAt`), and the error text for `failed`.

Match the existing panel idioms: `useQuery === undefined` skeletons, the
`rounded-xl border border-line bg-card` row styling, `text-soft`/`text-accent`
palette tokens, and the section header pattern (`h2` + hint) used by
`SellersManager` / `PayoutsManager`.

### Wiring

- Extend `SysAdminDashboard`'s `tab` union to `"allowlist" | "tenants" | "generation"`,
  add a `TabButton`, and render `<GenerationManager />` for the new tab.

## Acceptance criteria

- [ ] A "Generation" `TabButton` appears in the sys-admin dashboard; selecting it
      shows the two sections.
- [ ] "Generating now" lists live locks with elapsed time and a stale chip; empty state
      renders when none.
- [ ] "History" lists runs newest-first with outcome badges, produced Lesson (for
      published), timestamp, and error (for failed); empty state renders when none.
- [ ] Loading skeletons while either query is `undefined`.
- [ ] Tenant-admin view is unaffected (no Generation tab).

## Notes

- Both queries are sys-admin-gated server-side; the tab is only rendered inside
  `SysAdminDashboard`, so no extra client guard is needed.
- Styling is verified by eye (PRD: not unit-tested). Keep it consistent, not novel.
