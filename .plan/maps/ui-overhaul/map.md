# UI/UX overhaul

## Destination

A spec (`spec.md` here) for an agent-driven UI/UX overhaul of both learner-facing and
authoring surfaces — visual polish, flow fixes, and mobile experience — grounded in
Mobbin MCP references, foundation-first. Done when every decision needed to open a
sibling `ui-overhaul-impl` map is resolved. This effort runs **before** the
[reader-experience](../reader-experience/map.md) effort resumes.

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
  exists. **One stated exception** — tickets 07–11 provision and wire **PostHog**,
  which does rather than decides. They earn their place as wayfinder `task` tickets:
  ticket 13 ("which flows are actually clunky") cannot be decided without real usage
  data, and the data does not exist until the instrumentation ships. Same shape as
  ticket 01 buying Mobbin. Nothing else on this map builds.
- **Measurement strand (grilled 2026-08-02).** PostHog Cloud **EU**, one project with
  `tenant` as a property and a group, product analytics **+ session replay**, no
  surveys/flags/experiments (those serve the fix, not the diagnosis). **No consent
  banner** — POPIA legitimate interest, carried by aggressive masking (ticket 09) and
  a privacy-policy disclosure (ticket 11), which is a hard precondition for replay in
  prod. `identify()` sends the **Convex user id only** — no email, name or phone.
  Browser `posthog-js` plus `posthog-node` in the ITN handler for money events, since
  purchase truth lands server-side and asynchronously.
- **Volume reality:** lifetime sales are around **ten**. Funnel percentages are
  statistically meaningless here; the value is replay, few enough to watch every
  session individually. Any ticket that reasons from a drop-off *rate* is reasoning
  from noise.
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
- **Flow fix directions** — what the clunky journeys should *become*, one patch per
  flow once they are named. The "which journeys are clunky" half of this patch
  graduated on 2026-08-02 into the PostHog strand (07–13): the "real usage input" it
  was waiting on is session replay, and ticket 13 names and ranks the flows from it.
  What remains here is the redesign direction for each, which cannot be written until
  there is a ranked list to write it against. (This patch previously read
  `clears-with: 03` — the design-foundation ticket, which could never have cleared it;
  corrected 2026-08-02.) clears-with: 13
- **Mobile-readiness bar** — what "good on a phone" means per surface, and the single
  breakpoint scale to replace the current `md:`-only ad-hockery. Feeds the pwa effort
  that follows. One anchor already exists (2026-08-23): the app-level bottom tab bar
  shipped; the full prototype record and verdict live in
  [assets/mobile-bottom-nav.md](assets/mobile-bottom-nav.md), including the open
  question of what the in-course lesson list becomes underneath it, which belongs
  to this patch. clears-with: 03
- **Spec assembly** — folding the resolved decisions into `spec.md` and charting
  `ui-overhaul-impl`; the last patch to clear.

## Out of scope

- PWA/offline itself — that is the [reader-experience](../reader-experience/map.md) map; this effort only
  precedes it. Note that ticket 04 found its "groundwork already closed" premise is
  false; correcting it belongs to that map.
- Missing i18n coverage surfaced by the inventory (`AdminPanel.tsx` and
  `YwamPotch.tsx` have zero translation calls; the legal pages are English-only) —
  [app-language-i18n](../app-language-i18n/map.md).
- Whitelabel leaks surfaced by the inventory (legal pages hardcode "My Course" and
  `support@my-course.app`) — [whitelabel](../whitelabel/map.md).
- Session lifetime — [auth-sessions](../auth-sessions/map.md).
