---
type: task
blocked_by: []
---
# A revisited page paints from what the client already holds

## Question

Filed and resolved 2026-09-21 from the operator's report: "every click needs a load
(skeleton loader) even if I was just there". Ticket [05](05-the-reader-stops-refetching-bodies-it-holds.md)
cached lesson *bodies* across mounts, yet the skeleton still painted on a revisit. Two
causes sat in front of that cache, and neither was the body:

- **Convex drops a query the instant its last subscriber unmounts.** Verified in
  `convex/dist/esm/browser/sync/local_state.js` (`removeSubscriber`): no grace period.
  So `getLesson`, `courseHeader`, `dashboard` and every other read re-ran on the way
  back, and each gate on `=== undefined` painted its skeleton again.
- **Next 15 keeps a dynamic page in the client router cache for zero seconds.** Every route
  here is dynamic (the root layout reads `headers()` for the tenant), so a revisit re-ran
  the RSC round trip and `loading.tsx` from ticket 03 flashed over it.

## Answer

Built 2026-09-21, verified by `pnpm typecheck` and by reading the code. **Not walked in a
browser**: no dev server was listening on port 3000 during the session, and the
`next.config.js` half needs a restart the session may not perform.

- **Convex side:** `ConvexQueryCacheProvider` from `convex-helpers/react/cache` wraps the
  app in `ConvexClientProvider.tsx`, keeping a subscription alive for five minutes after
  its last component leaves, with a ceiling of 64 idle subscriptions so a long session on
  metered data cannot accumulate a whole course. Every `useQuery` under `src/` now imports
  from `convex-helpers/react/cache` (24 files, a one-line import swap each) so it reads
  through that cache. `useQueries` in `TenantContext` was left on the plain client on
  purpose: it is a single query at boot that never unmounts.
- **Next side:** `experimental.staleTimes.dynamic: 300` in `next.config.js`. The page
  payloads carry no data (the pages render client components that read Convex), so a
  five-minute-stale payload is indistinguishable from a fresh one.
- **What this is not:** offline reading. Both caches die with the tab, so the revocation
  question on `technical-foundation/05` does not reach this.

**Addendum, same day.** A revisit still flashed a skeleton for a frame or two. A 150ms
opacity hold on the three skeletons (`.skeleton-hold`) was tried and **reverted** the same
day (`2e29a8b`): the lesson route mounts two skeletons in a chain, `loading.tsx` and then
the reader's own, and every fresh mount restarted the hold, so a real load flickered
skeleton, blank, skeleton. Traced from source instead: the Convex hook reads its cached
result synchronously (`use_queries.js`, `getLocalResults`), and Next reuses a visited
sibling segment's cache node when the sidebar prefetch entry is `reusable`
(`fill-lazy-items-till-leaf-with-head.js`, `hasReusablePrefetch`), which it is for five
minutes after the first visit once `staleTimes.dynamic` is live. That setting is inlined
at dev-server start, so the flash is expected until the server restarts. **The residual
flash, if any survives a restart, has not been seen in a browser by an agent** and needs a
walk with devtools before another fix is attempted.

Walk to confirm, once the dev server has restarted: open a lesson, go to the next, go back,
then to the dashboard and back into the course. None of those should show a skeleton; the
first open of an unvisited lesson still does.
