# Onboarding

<!-- Charted 2026-07-30 when this repo retired its GitHub issue tracker: every ticket
     here was a GitHub issue, migrated verbatim. This map is an INDEX, not a store —
     each decision lives in its own ticket; the map gists it and links. -->

## Destination

The first-run experience made concretely smoother: the friction a new person actually hits,
named and fixed — from the cold sign-up through to the first moment inside a course — not a
vague aspiration.

## Notes

- **Moved out 2026-09-01** in the `.plan` consolidation, which took 33 map directories
  down to 7 active maps. Ticket 01 (improve the onboarding flow, which is a walk) is
  now [learning-experience/05](../learning-experience/tickets/05-improve-onboarding-flow.md)
  and ticket 03 (the dashboard empty state contradicting the catalogue) is now
  [learning-experience/06](../learning-experience/tickets/06-dashboard-empty-state-ignores-catalogue.md).
  Only resolved ticket 02 (the first-open welcome panel) is left here, so this map is
  closed. **This map's Destination is not met**, it moved: it now hangs off
  learning-experience/05.

  Renumbering was forced: `blocked_by` is map-local and the numbers collided across the
  donor maps. **Do not reuse the old numbers here**, they remain those tickets' identity in
  this map's history, and do not mint a replacement for a moved ticket.

<!-- Ticket 02 arrived 2026-08-01 from the retired single-ticket `welcome` map; it carries
     that map's context folded in under a "Context folded from" heading. -->

- **Two tickets, two moments, one funnel.**
  [Improve onboarding flow](tickets/01-improve-onboarding-flow.md) is everything *up to and
  including* getting an account; [the welcome panel](tickets/02-first-open-welcome-panel.md)
  is the first moment *inside* a course, for a signed-in learner or a Guest on a Public link.
  They were charted apart and kept colliding — 01's walkthrough will land squarely on 02.
- **02 is done** — it was already built when this map was charted, and nobody noticed until
  ywampotch-launch went looking for stale facts (2026-08-01). See Decisions so far.
- **01 was a one-sentence stub** (*"This should be as smooth as possible"*) until 2026-08-01,
  when the same sweep wrote the walk into its body. Its real job is **turning the aspiration
  into observations**: walk a genuine cold sign-up on prod, on a tenant subdomain, on a phone,
  and write down every place a person stalls. Until that exists there is nothing to build —
  and with 02 shipped, 01 is now the whole of this map.
- **Two funnel leaks were already diagnosed** for the ywampotch launch — checkout abandonment
  and sign-up friction — and the mechanical half was attacked there (Google sign-in, the
  manual EFT rail, brand continuity). Read
  [ywampotch-launch](../ywampotch-launch/map.md) before re-diagnosing.
- **Two adjacent maps own pieces of this; do not absorb them:**
  [Scope the onboarding & marketing video](../media-generation/tickets/03-scope-onboarding-and-marketing-video.md)
  (the pre-signup pitch) and
  [Review session management](../technical-foundation/tickets/08-review-session-management.md)
  (having to sign in repeatedly, which is onboarding friction every single visit).
- **This map carries one fix ticket, deliberately** (wayfinder's default is plan-don't-do):
  [Dashboard empty state contradicts the catalogue below it](tickets/03-dashboard-empty-state-ignores-catalogue.md)
  is a verified bug with nothing to decide, filed here 2026-08-07 rather than left as prose
  in another map's ticket. It renders as unstarted work because it *is* unstarted work.
- Skills: `/grilling`, `/run` (walk the real app — this map is worthless from the armchair).

## Decisions so far

<!-- one line per resolved ticket -->

- [First-open welcome panel in the reader](tickets/02-first-open-welcome-panel.md) —
  **it was already built**; the ticket was open on stale context and is closed on the
  evidence, not on new work. `Welcome.tsx` + `welcomeDerive.ts`, rendered by *both*
  shells, `mission` on the `publicCourse` allowlist. Two deliberate deviations: it is a
  **modal** (`da02161`, the user reversing the spec's inline-card default), and dismissal
  is per-tab-session — "once" is enforced by the **trigger** (server progress, latched)
  rather than by a persisted dismissal. It has since grown a purchase variant
  (`welcomeVariant`, ywampotch-launch 17) that wins over the generic welcome; read that
  before touching the panel. **Walked in a browser 2026-08-01** against prod data on a
  Public link — every acceptance criterion ticked, and the walk caught one real defect:
  the mission excerpt glued the mission's own heading onto the sentence below it
  (`ac16180`). The signed-in half is still code-evidence only; it needs prod credentials.

## Not yet specified

- **Everything downstream of the walkthrough.** Fog stays fog here deliberately: the observations
  come first, and the tickets are cut from them. clears-with: 01
- **Whitelabel treatment of the welcome panel.** A tenant's panel arguably needs that tenant's
  voice, not just its palette. Not yet sharp — and now genuinely floating, since the panel it
  would restyle is built and 01 won't sharpen it.

## Out of scope

- Checkout mechanics — owned by the launch work and [marketplace](../marketplace/map.md).
- ~~The dashboard empty state (`EmptyLibrary`) — already shipped, different audience.~~
  **Corrected 2026-08-07: it is shipped and broken, and the audience is this map's.**
  `emptyLibrary` ignores the site catalogue, so a new tenant learner is told "a marketplace
  is coming soon" directly above a buyable course. "Different audience" was true when a
  tenant had no catalogue; tenants have one now. Back in scope as
  [ticket 03](tickets/03-dashboard-empty-state-ignores-catalogue.md).
