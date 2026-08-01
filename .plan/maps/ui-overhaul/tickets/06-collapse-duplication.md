---
type: grilling
blocked_by: [03]
---
# Which duplicated surfaces collapse, and into what

> `/wayfinder .plan/maps/ui-overhaul/tickets/06-collapse-duplication.md`

## Question

The inventory found the overhaul would otherwise land twice on several surfaces.
Once the foundation (ticket 03) names the component set, decide what collapses:

- **`PublicReader.tsx` (474 lines) vs `CourseShell.tsx` (591 lines)** — a near
  line-for-line fork, identical drawer, identical inline SVGs. One shell with a guest
  mode, or two that stay separate on purpose?
- **Six theme-toggle implementations** and **seven confirm-dialog implementations**
  (including a `window.confirm` in `AdminPanel`) — one each, presumably; confirm and
  say where they live.
- **Four near-identical course cards** in `Dashboard.tsx` — one card with variants?
- **`YwamPotch.tsx`**, a hardcoded-English fork of `Landing.tsx` — do tenant landings
  become data-driven before a second fork exists?
- The god files — `AdminPanel.tsx` (2255 lines), `Editions.tsx` (1274), `Dashboard.tsx`
  (959) — does the overhaul split them, and along what seams?

## Done when

Each duplicate above has a named destination (collapse into X / stay separate because
Y), so per-surface redesign tickets can be cut without two of them touching the same
markup.
