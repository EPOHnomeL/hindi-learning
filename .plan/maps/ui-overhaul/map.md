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

## Not yet specified

- **Per-surface redesign directions** — one direction ticket per surface, cut and
  ordered once the foundation exists and the inventory has ranked them. clears-with: 03
- **Flow fixes** — which journeys are actually clunky (onboarding, discovery, lesson
  progression?) and what they should become; needs the inventory plus real usage
  input. clears-with: 04
- **Mobile-readiness bar** — what "good on a phone" means per surface; feeds the pwa
  effort that follows this one. clears-with: 04
- **Spec assembly** — folding the resolved decisions into `spec.md` and charting
  `ui-overhaul-impl`; the last patch to clear.

## Out of scope

- PWA/offline itself — that is the [pwa](../pwa/map.md) map; this effort only
  precedes it.
- Session lifetime — [session-management](../session-management/map.md).
