---
type: task
blocked_by: [01]
---
# The service worker and its three caching rules

## Question

What does the service worker cache, such that the app opens offline **and** a deploy can never
white-screen a returning learner?

Two things ride on this worker. Chrome will not offer installation without a worker that has a
**fetch handler** at all - so one ships regardless. And the Offline Catalogue of ticket 05 is
worthless without shell caching: if the HTML document and JS chunks are not cached, launching
offline shows the browser's error page and the cached list is data that nothing ever loads to read.

Hand-rolled, roughly 60 lines, **not** `next-pwa` (effectively abandoned) or Serwist (a dependency
and a build-step integration for a worker that does three things). Three rules:

- **`/_next/static/*` -> cache-first, indefinitely.** Safe precisely because those filenames are
  content-hashed: a changed file is a changed name, so a cached one can never be stale.
- **Navigation requests -> network-first, falling back to a cached `/` document.** This rule is the
  one that matters. Network-first means an online learner always gets fresh HTML, so a deploy can
  never serve a stale cached document that references chunks the deploy deleted - the classic PWA
  white screen. The cached `/` is only ever reached when the network genuinely fails.
- **Everything else -> network only, never cached.** Explicitly including App Router `?_rsc=`
  payloads (cache those and client navigation goes stale in ways that are miserable to debug) and
  every Convex call.

Plus: versioned cache names purged on `activate`, and `skipWaiting()` / `clients.claim()` so a
deploy takes effect on the next launch rather than the one after.

Registered client-side after load, so registration never competes with first paint. Each tenant
subdomain is a separate origin and therefore registers its own worker independently - no
cross-tenant cache sharing is possible, which is the correct behaviour for free.

## Done when

- DevTools -> Application -> Service Workers shows it active, and the app now reports as
  **installable**.
- Offline (DevTools offline, or airplane mode on a device), launching the installed app renders the
  shell rather than the browser error page.
- A **deploy-skew test passes**: load the app, ship a build that changes the chunk hashes, reload
  online - the learner gets the new build, with no blank screen and no console errors about missing
  chunks.
- `?_rsc=` requests appear in the network tab as network hits, never as `(from ServiceWorker)`.
- Old caches are gone from Cache Storage after a version bump.
- Convex still connects normally online; the worker is not in that path.

## Answer
