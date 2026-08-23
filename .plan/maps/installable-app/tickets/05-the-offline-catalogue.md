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
