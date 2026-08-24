---
type: task
blocked_by: [02]
---
# The Offline Catalogue

## Question

What does the app show when it opens with no connection?

The last course lists the reader saw, plus an honest answer when they tap a course. Two queries get
a last-known-good cache:

- `api.catalogue.list` - the tenant's public catalogue, keyed by tenant slug. Public data, no
  access model, nothing to leak.
- `api.content.reader.dashboard` - the signed-in learner's own courses and progress.

**Why a cache is the right shape here, and not error handling.** Convex is a **WebSocket**. Offline
it never connects, so `useQuery` does not throw and does not return an error - it sits at
`undefined` **forever**, indistinguishable from still-loading. So the render rule keys off exactly
that: when the live query is `undefined` and a cached value exists, render the cached value. When
the live query resolves, it overwrites the cache and the UI. No error boundary is involved because
no error is ever raised.

**Storage.** localStorage under the `hindi:` prefix - `hindi:cache:catalogue:<tenant>` and
`hindi:cache:dashboard`. Under that prefix and **not** in the `KEEP` set, unlike the install
dismissal: the dashboard list is per-account, so the existing sign-out sweep in
`accountLocalState.ts` clearing it is exactly right, and gets the shared-browser case correct for
free.

**Honesty in the UI.** When a cached list is showing and the network is down, say so quietly - one
line, not a banner that shouts. Tapping a course offline must say plainly that the lesson needs a
connection. The failure this ticket exists to prevent is a learner staring at a spinner that will
never resolve, which is what today's behaviour would be.

**Lesson bodies are not cached** ([ADR 0030](../../../../docs/adr/0030-installable-per-tenant-app.md)
§3). That is
[reader-experience/05](../../reader-experience/tickets/05-offline-lesson-content-under-a-lease.md),
and its real cost is the offline Response/Progress queue, not the caching.

Note the asymmetry worth remembering: `dashboard` is per-user and its cache is a *stale* view, so
progress shown offline may be behind. Acceptable - it is a list, and the live query corrects it
within a second of reconnecting.

## Done when

- Load `/` online while signed in, go offline, relaunch the installed app: the course list renders
  from cache with a quiet offline note, no spinner-forever.
- Same signed out: the tenant's public catalogue renders from cache.
- Tapping a course offline gives a plain "needs a connection" message, not a hang.
- Reconnecting replaces the cached view with live data without a reload.
- Signing out clears both cache keys (covered by a test alongside the existing sweep tests).
- A first-ever visit offline (nothing cached) shows an honest empty/offline state rather than a
  broken one.
- Cached progress being slightly stale is confirmed acceptable in the walkthrough.

## Answer

Built 2026-08-24. As specified, with one correction the walkthrough forced on the design
(below). Pieces: `offlineCache.ts` (pure read/write over Storage, corrupt JSON reads as
null, keys `hindi:cache:dashboard` and `hindi:cache:catalogue:<tenant>`, 4 tests);
cache writes where the two queries live (Dashboard for `api.content.reader.dashboard`,
AvailableSection for `api.catalogue.list`, trimmed to slug/title/counts); `OfflineHome`
renders the cached list with the quiet note, a plain needs-a-connection line when a
course is tapped, and an honest empty state when nothing is cached. Both keys are
outside `KEEP`, and the sweep clearing them is pinned by a test beside the existing
sweep tests. Strings are a `next-intl` `Offline` namespace in all five locales.

**The correction: the ticket's render rule was aimed at the wrong gate.** The
useQuery-undefined-forever trap is real, but it sits BEHIND the auth gate, and walked in
a real browser the gate itself does something different offline: Convex Auth's client
resolves UNAUTHENTICATED (its server-state fetch fails and it drops its localStorage
tokens), so a signed-in learner relaunching offline got the marketing landing with a
dead sign-in form, not an eternal spinner. So `/` swaps its whole auth-gated tree for
OfflineHome whenever `useOffline()` is true: navigator.onLine false, OR the Convex
WebSocket still unconnected 3s after mount (the dead-router case a bare onLine misses,
and the ticket's undefined-forever rule expressed at the connection where it is
actually observable). And because an offline BOOT drops the auth client's tokens while
the real session survives in the httpOnly cookie, reconnection reloads the document
once (sessionStorage-stamped against flap loops) so the learner comes back signed in
instead of stranded on the landing.

**Evidence: walked in a browser** (headless Chromium, production build, a real
throwaway password account on the dev deployment, real caches written by the live
queries): signed-in offline relaunch renders the offline note and list, not a spinner;
cached courses render with their (stale-by-design, confirmed acceptable) progress; a
tap says plainly it needs a connection; nothing-cached shows the honest empty state;
reconnecting restored the live signed-in dashboard with no user action; sign-out
cleared both cache keys. Also walked: the dev deployment was missing yesterday's
`capture:myLastRead` (frontend committed 2026-08-23, functions never pushed), which
crashed every signed-in page against a local build; fixed by `npx convex dev --once`.

**Two honest limits.** (1) Signed out, the catalogue cache only fills from the
signed-in dashboard's Available section, because no signed-out surface queries
`api.catalogue.list` today; a signed-out first-ever offline visit gets the empty state.
(2) "Walked" here is DevTools-style offline emulation on desktop Chromium, not
airplane mode on a device; the device pass rides the ticket 04 release-gate walk.
