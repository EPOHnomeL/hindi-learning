# UI/UX overhaul

## Destination

A spec (`spec.md` here) for an agent-driven UI/UX overhaul of both learner-facing and
authoring surfaces — visual polish, flow fixes, and mobile experience — grounded in
Mobbin MCP references, foundation-first. Done when every decision needed to open a
sibling `ui-overhaul-impl` map is resolved. This effort runs **before** the
[pwa](../pwa/map.md) effort resumes.

## Notes

- Grilled 2026-08-01. The problem is all three of: visual polish ("looks amateur"),
  clunky flows, and a weak mobile experience. Scope is **learner + authoring** — the
  whole app.
- The pass is **agent-driven**; references come via the **Mobbin MCP** (launched
  May 2026, remote endpoint `api.mobbin.com/mcp`, paid plans only, currently beta —
  agents can search and view 620K+ real app screens). Decided: buy **Pro on monthly
  billing first**, validate the MCP on one real surface, then switch to yearly
  (~€10/mo) if it earns its keep.
- Stack facts: Next.js 15 + React 19 + Tailwind v4, **no component library** — the UI
  is hand-rolled. The app is **whitelabeled** (per-tenant branding), so any design
  foundation must keep tenant theming expressible.
- Structure: **foundation first** — the design-system decision lands before any
  surface redesign ticket opens.
- Planning only: implementation is handed off to `ui-overhaul-impl` once `spec.md`
  exists.
- Skills: `/grilling`, `/prototype`, `/ponytail`.

## Decisions so far

<!-- one line per resolved ticket -->

- [Surface inventory and priority order](tickets/04-surface-inventory.md) — 21 surfaces
  ranked worst-first; no design system exists (6 theme toggles, 7 confirm dialogs,
  `PublicReader` is a fork of `CourseShell`), the lesson quiz lives outside React in an
  iframe, and **no PWA has shipped** despite the pwa map assuming otherwise.

## Not yet specified

- **Per-surface redesign directions** — one direction ticket per surface, in the
  inventory's priority order, cut once the foundation and the collapse plan exist.
  clears-with: 06
- **Flow fixes** — which journeys are actually clunky and what they should become. The
  inventory names candidates (authoring composer stuffed in a dashboard grid cell;
  pricing, payouts and access control sharing one modal; `/admin` role-branching on a
  single route) but choosing among them needs real usage input. clears-with: 03
- **Mobile-readiness bar** — what "good on a phone" means per surface, and the single
  breakpoint scale to replace the current `md:`-only ad-hockery. Feeds the pwa effort
  that follows. clears-with: 03
- **Spec assembly** — folding the resolved decisions into `spec.md` and charting
  `ui-overhaul-impl`; the last patch to clear.

## Out of scope

- PWA/offline itself — that is the [pwa](../pwa/map.md) map; this effort only
  precedes it. Note that ticket 04 found its "groundwork already closed" premise is
  false; correcting it belongs to that map.
- Missing i18n coverage surfaced by the inventory (`AdminPanel.tsx` and
  `YwamPotch.tsx` have zero translation calls; the legal pages are English-only) —
  [app-language-i18n](../app-language-i18n/map.md).
- Whitelabel leaks surfaced by the inventory (legal pages hardcode "My Course" and
  `support@my-course.app`) — [whitelabel](../whitelabel/map.md).
- Session lifetime — [session-management](../session-management/map.md).
