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
- **Ticket 02 was sequenced behind the UI overhaul, and that sequencing was overridden**
  ([ui-overhaul](../ui-overhaul/map.md) runs first by its own Destination and was to settle the
  installable-shell and mobile questions underneath 02). Overridden on the user's instruction
  2026-08-23: 02 is resolved and the build is [installable-app](../installable-app/spec.md). The
  accepted cost is that the install sheet is a new UI surface built before the design foundation
  (ui-overhaul ticket 03) that would govern it, so expect to restyle one component later.
- **The offline decision was an access decision, and the access premise was wrong** (corrected
  2026-08-23). This bullet used to read: *"Lesson bodies live in Convex blobs behind a content
  route; caching them locally puts a copy of paid content on a device an Entitlement revocation
  cannot reach."* True, but not a consequence of caching: `GET /content?id=<storageId>` already
  serves Lesson bodies with **no authentication**, `Access-Control-Allow-Origin: *` and
  `max-age=31536000, immutable`, so that copy is reachable today by anyone holding the URL.
  Caching would only make it convenient. The exposure is now
  [marketplace/12](../marketplace/tickets/12-content-route-is-an-open-bearer-url.md); the thing
  that would actually make offline content revocable is a **time-boxed lease**, in
  [ticket 05](tickets/05-offline-lesson-content-under-a-lease.md). Immutable Lessons (ADR 0003)
  still mean cached content cannot go stale underneath a learner.
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

- [Download course for offline](tickets/02-download-course-for-offline.md) (formerly "Implement
  PWA") - the app becomes installable **per tenant** with a derived App Icon and our own branded
  prompt, and offline is scoped to the **Offline Catalogue** (lists) and explicitly not Lesson
  bodies ([ADR 0030](../../../docs/adr/0030-installable-per-tenant-app.md)). Decided, **not
  built**: the build is [installable-app](../installable-app/spec.md). The grilling found that
  `/content` is already an open bearer URL, so the long-standing "revocation cannot reach a cached
  copy" objection described the present, not the risk of caching.

## Not yet specified

<!-- The "offline Progress and quiz answers" fog patch graduated into a ticket on 2026-08-23:
     it is now reader-experience/05, which names the reconciliation problem precisely (the quiz
     bridge posts answers to the parent, which writes to Convex, and first-answer-only is enforced
     server-side). Nothing else on this map is fog. -->

## Out of scope

- Certificates and Completion — already shipped.
- The routing spine and URL scheme — shipped under ADR 0012.
- The anchor contract, reference deep-links and share icons — all shipped.
- Session lifetime — [auth-sessions](../auth-sessions/map.md).
- First-run orientation in the reader — [onboarding](../onboarding/map.md).
