# Reader experience

<!-- Charted 2026-08-01 by consolidating four single-ticket maps — progress-feature,
     pwa, url-routing and reference-cards — that were each a lone issue wearing a map's
     clothes. Each ticket carries the context its old map held, folded in under a
     "Context folded from" heading. This map is an INDEX, not a store. -->

## Destination

The remaining rough edges in the reader closed: progress a learner can see, a course that can
be taken offline (or a decided "no"), deep links that fail clearly, and older reference cards
either backfilled or knowingly left alone.

## Notes

- **Domain:** Progress, Completion, Response, Lesson, Reference, Edition (CONTEXT.md).
- **These four are follow-ups on shipped work, not new ground** — which is exactly why none of
  them deserved a map of its own. The spine each one hangs off has already landed: the reader,
  the PWA groundwork, the routing scheme (ADR 0012), and the reference-card anchor contract.
- **Measure before building — this applies to three of the four.**
  [Progress](tickets/01-progress-feature.md) is most likely half-built already;
  [Backfill existing References](tickets/04-backfill-existing-references.md) may correctly
  resolve as *don't* (References are mutable and may self-heal by being re-authored); and
  [Download for offline](tickets/02-download-course-for-offline.md) has to start by
  re-establishing its own premise — see the next note.
- **There is no PWA. The old `pwa` map's premise was false.** That map's Notes claimed its
  ticket 01 ("implement the website as a PWA") was closed on GitHub and the groundwork was
  done. A direct check by
  [Surface inventory](../ui-overhaul/tickets/04-surface-inventory.md) found `public/` holds
  only `favicon.ico`, `icon.svg` and a stray demo HTML file — **no `manifest.json`, no
  service worker, no `next-pwa`, no `viewport`/`themeColor` export, no `apple-touch-icon`**.
  Nothing shipped. So ticket 02 is not "offline on top of a PWA"; it is the PWA question and
  the offline question together, and it must decide whether the app becomes installable at
  all before it can decide what "download the course" means.
- **Ticket 02 is sequenced behind the UI overhaul** — [ui-overhaul](../ui-overhaul/map.md)
  runs first by that map's own Destination, and it is the effort that will settle the
  installable-shell and mobile questions this ticket depends on.
- **The offline decision is an access decision, not a service-worker one.** Lesson bodies live
  in Convex blobs behind a content route; caching them locally puts a copy of paid content on
  a device an Entitlement revocation cannot reach. Immutable Lessons (ADR 0003) at least mean
  cached content cannot go stale underneath a learner.
- **The routing ticket's interesting half is security, not the 404:** "doesn't exist" and "you
  can't see it" must be *identical* responses, so the routing layer never leaks what the data
  layer protects. No silent fallbacks. Watch the `useQuery`-is-`undefined`-while-loading trap.
- **02 bundles a session complaint that belongs elsewhere** — "not having to log in all the
  time" is [auth-sessions](../auth-sessions/map.md), and the grilling must split it out first.
- Skills: `/ponytail` (three of the four may shrink to nothing), `/tdd`,
  `convex:convex-expert`, `convex:convex-migration-helper` (04, only if a migration is
  warranted), `vercel:nextjs` (App Router `not-found` conventions).

## Decisions so far

<!-- one line per resolved ticket -->

## Not yet specified

- **Offline Progress and quiz answers.** If a learner works offline their Responses have to
  queue and reconcile. Real, and unspecifiable until the offline-content decision lands.

## Out of scope

- Certificates and Completion — already shipped.
- The routing spine and URL scheme — shipped under ADR 0012.
- The anchor contract, reference deep-links and share icons — all shipped.
- Session lifetime — [auth-sessions](../auth-sessions/map.md).
- First-run orientation in the reader — [onboarding](../onboarding/map.md).
