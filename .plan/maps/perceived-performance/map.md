# Perceived performance: the client feels as fast as it already is

<!-- INDEX, not a store. Each unit lives in its own ticket; this map gists and
     links. Load once per session, zoom into tickets on demand. -->

Chartered 2026-09-09 from a measured client performance scan
([assets/2026-09-09-client-performance-scan.md](assets/2026-09-09-client-performance-scan.md)),
run against a real `pnpm build` at `fe1ebe7`. Read the scan before starting any ticket:
it carries the measurements the tickets deliberately compress, and it says for each
finding whether the number was measured or inferred.

## Destination

The app **feels** as considered as it is. The skeleton work is already done and done
well, so this effort is about the waits underneath it: the fonts a locale will never
render, the round trips a click pays for, and the beat between an action and its
consequence appearing.

Done when tickets 01 to 06 are resolved, 07 and 08 have answers (either a build ticket
or a recorded ruling out), and the field numbers from 01 show movement on the reader
and the dashboard.

Scope is fixed by one test: **does a learner notice it?** Font preload, loading
boundaries, optimistic writes and layout shift all pass. Backend read amplification
does not, however large the bill: that is `technical-foundation`'s subject and it stays
there (see Out of scope).

## Notes

- **This map carries build tickets, deliberately.** wayfinder's default is
  plan-don't-do, and this is the Notes override the convention requires. Tickets 01 to
  06 are execution: each is a tracer-bullet slice sized for one session. Tickets 07 and
  08 are genuine open decisions and are grillings.
- **Nothing here is observed in the field yet.** Every number in the scan came from a
  local production build. Ticket 01 exists to fix that, and it is why 08 is blocked on
  it: a structural change to cold start should not be made before the field says cold
  start is the problem.
- **The skeleton and motion layer is already built, and is good.** `ui.tsx` ships four
  purpose-built skeletons, `globals.css` carries around fifteen hand-tuned keyframes all
  gated on `prefers-reduced-motion`, `useMutationRun` gives every control a busy flag
  and a real refusal message, and the two heavy libraries are already behind dynamic
  `import()`. Do not re-derive that as missing. The remaining wins are network and
  round-trip shaped, not animation shaped.
- **Two adjacent tickets on other maps are NOT this effort**, and were checked on
  2026-09-09 so nobody merges them later:
  - [technical-foundation/01](../technical-foundation/tickets/01-slim-the-row-listlessons-collects.md)
    is the biggest performance number in the repo (`listLessons`, 1.16 GB of Database
    I/O). It is backend read amplification, it is open and on its own frontier, and it
    stays there.
  - [technical-foundation/05](../technical-foundation/tickets/05-offline-lesson-content-under-a-lease.md)
    grills **offline** content under a lease. Ticket 05 here is an in-session memory
    cache that persists nothing, so the revocation objection that ticket turns on does
    not reach it.
- **Skills per session:** `/implement` with `/tdd` and a `/ponytail` posture. `pnpm
  typecheck` is the cheap whole-repo verification and needs no dev server. **Never start
  or stop a dev server**; the user runs their own.
- **Ticket 02 wants a human, not a green typecheck.** It trades a small regression for
  Hindi and Urdu chrome against a large win for every other locale, in an app whose
  namesake audience reads Devanagari. Its acceptance criterion is a walked Hindi load.

## Decisions so far

<!-- one line per resolved ticket: gist + link -->

Nothing resolved yet. The map was chartered on 2026-09-09.

## Not yet specified

<!-- fog patches: named, but not yet sharp enough to be a ticket -->

- **Whether the RSC round trip is the dominant cost on the networks that matter.** The
  scan measured bundle sizes and font weights on a local build; it could not measure
  latency from a South African mobile connection, which is the population that decides
  whether any of this was worth doing. *clears-with: 01*
- **Whether the reader wants component tests before it is optimised further.**
  `technical-foundation/33` records that the reader is the highest-traffic surface in
  the app with zero component tests, and that it wants its own session and a browser
  walk. Tickets 04 and 05 both edit it. Whether that debt has to be paid first, or
  whether a browser walk per ticket is enough, is not yet decided. *clears-with: 05*
- **What "fresh and interactive" is worth beyond removing waits.** The request that
  produced this map asked for the app to feel fresh and interactive, and the honest
  finding was that the animation layer is already built. Whether there is a real want
  left underneath that phrase, or whether removing the waits satisfies it entirely, is
  a question for the human once 01 to 06 have landed.

## Out of scope

- **Backend read amplification and the Convex bill.** `listLessons`, `materialiseTopic`
  and the translation row are `technical-foundation`'s subject. This map is what a
  learner perceives, and a query can be both expensive and invisible.
- **Making the legal and marketing routes statically cacheable.** Every route is dynamic
  because the root layout reads `headers()` for the tenant and the buyer country. That
  is whitelabel tenancy working as designed and unpicking it is a much larger change
  than anything here earns.
- **Offline reading.** See the Notes; that is `technical-foundation/05`.
- **Replacing the skeletons, the motion vocabulary, or `useMutationRun`.** They are the
  part that already works.
- **A component library or rendering-strategy migration.** `technical-foundation/03`
  owns the shadcn question; nothing here needs it.
