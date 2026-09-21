# Lighthouse: the public front door scores like the product it sells

<!-- INDEX, not a store. Each unit lives in its own ticket; this map gists and
     links. Load once per session, zoom into tickets on demand. -->

Chartered 2026-09-21 from a request to "optimise the website for a great Lighthouse
score", after an investigation of the tree at `8d721a5`.

## Destination

The four **ungated** URLs (`/` signed out, `/terms`, `/privacy`, `/refunds`) score in
the green on all four Lighthouse categories against a Vercel preview deploy, and cannot
silently fall back out.

Done when tickets 01 to 06 are resolved and 07 holds the floor they reached.

Scope is fixed by one test: **would Lighthouse fire on it, on a URL a stranger can
open?** Bundle weight on the landing page, image encoding, accessible names, crawl
metadata and console errors all pass. The cold-start chain behind the auth gate does
not: Lighthouse scores a Convex skeleton there, and that surface belongs to
`perceived-performance` (see Out of scope).

## Notes

- **This map carries build tickets, deliberately.** wayfinder's default is
  plan-don't-do, and this is the Notes override the convention requires. 01 is a
  prefactor ("make the change easy, then make the easy change"); 02 to 07 are
  execution, each a tracer-bullet slice sized for one session.
- **Two rulings were taken from the human at charter time (2026-09-21), and neither is
  reopenable without them:**
  - **The score of record comes from a Vercel preview URL**, not a local
    `next start`. Brotli, the CDN and the Vercel image optimizer only exist on the
    deploy, and a local build reads pessimistically enough that its absolute numbers
    would mislead.
  - **Authed surfaces are out of scope.** No cookie injection, no authenticated run.
- **Nothing here is scored yet.** The findings in the tickets are structural facts read
  off the tree, not audit output. Ticket 01 exists to produce the first real score, and
  every other ticket is blocked by it so that no fix lands before the number it claims
  to move has been observed once.
- **`perceived-performance` is the adjacent map and it was checked ticket by ticket on
  2026-09-21 so nobody merges the two.** It was chartered 2026-09-09 from a measured
  build scan and already owns: font preload weight (02), the reader's three serial
  round trips (03, 05), optimistic writes (04, 09), the message catalogue (07), the
  dashboard's pop-in (06), field web vitals (01) and server-side first paint (08).
  **None of that is repeated here.** If a Lighthouse finding lands on one of those,
  it belongs on that map, not this one.
- **Three claims on that map are stale as of 2026-09-21**, noted here because a session
  working this map will read it and be misled. They are *its* to fix, not this map's.
  Ticket 01 there asks for `capture_performance`, which `src/app/PostHogClient.tsx`
  already sets. Ticket 02 asks for `preload: false`, which `src/app/layout.tsx` already
  has on both escape-hatch faces. Ticket 03 states there is no `loading.tsx` anywhere
  in `src/app`, but `(app)/courses/loading.tsx` and `share/loading.tsx` both exist. All
  three tickets are still open. Built is not resolved, and an unresolved ticket sitting
  over built code is exactly the trap CLAUDE.md's "verify the claim" section is about.
- **Skills per session:** `/implement` with `/tdd` and a `/ponytail` posture. `pnpm
  typecheck` is the cheap whole-repo verification and needs no dev server. **Never
  start or stop a dev server**; the user runs their own on port 3000.
- **Ticket 04 wants a human at a keyboard**, not a green audit. axe catches a missing
  accessible name; it does not catch a control that is reachable but lands focus
  somewhere nonsensical.

## Decisions so far

<!-- one line per resolved ticket: gist + link -->

*Nothing resolved yet.*

## Not yet specified

<!-- fog patches: named, but not yet sharp enough to be a ticket -->

- **Whether a tenant host scores the same as the bare domain.** Every route is dynamic
  because the root layout resolves the tenant from `Host`, a tenant may ship a bespoke
  landing (`src/app/_landing/registry.ts`) and its own uploaded logo at an arbitrary
  aspect. So there is not one landing page to score, there are as many as there are
  tenants, and the worst one is the real number. Whether 01's harness should take a
  host list rather than a URL list is not yet decided. *clears-with: 01*
- **Whether the three legal pages want to stop being dynamic.** They are `f` in the
  build only because the root layout reads `headers()`; they carry no tenant-specific
  content beyond the header lockup. `perceived-performance` rules this out of its own
  scope as "a much larger change than anything here earns", which is true of *that*
  map's destination and may not be true of a TTFB-shaped Lighthouse score. Not a
  ticket until 01 says TTFB is actually costing points. *clears-with: 01*
- **What the floor in 07 should cost a contributor.** A budget that fails a build is
  only worth having if the failure is actionable and rare. Whether that is a hard gate,
  an advisory comment, or a scheduled run depends on how noisy the preview-URL numbers
  turn out to be run to run. *clears-with: 01*

## Out of scope

- **Every authenticated surface.** Ruled by the human at charter, 2026-09-21. The
  dashboard and the reader are client-rendered against Convex behind `AppGate`, so
  Lighthouse scores a skeleton; the real cost there is the cold-start chain, which is
  `perceived-performance` 01, 06 and 08.
- **Everything `perceived-performance` already owns.** See the Notes for the
  ticket-by-ticket list.
- **The token-gated routes' SEO.** `/share/[token]`, `/certificate/[token]` and
  `/poster/[token]` all set `robots: { index: false, follow: false }` deliberately
  (ADR 0013: the token is the credential and must not be indexed or leaked via
  `Referer`). Their SEO score is moot by design and must stay that way.
- **Backend read amplification and the Convex bill.** `technical-foundation`'s subject.
  Invisible to Lighthouse on a public route, which asks no authed query.
- **The PWA category.** Lighthouse removed it in v12. The service worker and the
  manifest are `installable-app`'s subject and no score depends on them.
- **Replacing the skeletons, the motion vocabulary or `useMutationRun`.** They are the
  part that already works.
