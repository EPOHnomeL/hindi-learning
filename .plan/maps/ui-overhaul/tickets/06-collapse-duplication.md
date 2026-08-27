---
type: grilling
blocked_by: [03]
---
# Which duplicated surfaces collapse, and into what

> `/wayfinder .plan/maps/ui-overhaul/tickets/06-collapse-duplication.md`

## Question

Ticket 04 found the overhaul would otherwise land twice on several surfaces. Once
ticket 03 names the component set, give each of these a destination:

- **`PublicReader.tsx` (474) vs `CourseShell.tsx` (591)**, a near line-for-line fork.
  One shell with a guest mode, or two kept apart on purpose?
- **Six theme toggles** and **seven confirm dialogs** (one is a `window.confirm`).
  Presumably one each. Say where each lives.
- **Four near-identical course cards** in `Dashboard.tsx`. One card with variants?
- **`YwamPotch.tsx`**, a hardcoded-English fork of `Landing.tsx`. Do tenant landings
  become data-driven before a second fork exists?
- **The god files**: `AdminPanel.tsx` (2255), `Editions.tsx` (2023), `Dashboard.tsx`
  (959). Split, and along what seams? Ticket 16 answers the Editions half first.

## Done when

Each item above has a named destination, collapse into X or stay separate because Y,
so per-surface tickets can be cut without two of them touching the same markup.
