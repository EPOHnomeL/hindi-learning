---
type: grilling
blocked_by: []
---

# Implement PWA

## Question

Add a download course feature to allow users to download and not need to log in with creds all the time just once and later introduce downloading the course locally to finish offline.

## Done when

The download/offline want is grilled into a decision (what "download" means: credential
persistence vs offline content, and what it needs beyond **what actually exists**), and
implementation tickets exist.

<!-- Stale-claim correction, 2026-08-23: this Done-when originally read "beyond the PWA work
     already closed". That was false when it was transcribed from GitHub #44 on 2026-07-30, and it
     is corrected in place per CLAUDE.md rather than left to mislead a future session. Nothing had
     shipped. See the 2026-08-01 premise correction below, re-verified 2026-08-23 by searching the
     whole tree for manifest / serviceWorker / PWA / beforeinstallprompt: zero hits in src/ or
     convex/. -->

<!-- Migrated 2026-07-30 from GitHub issue #44 (filed 2026-07-24), when this repo retired
     its remote tracker; see docs/agents/issue-tracker.md. -->

---

## Context folded from the retired `pwa` map (2026-08-01)

<!-- was .plan/maps/pwa/tickets/02-download-course-for-offline.md; that single-ticket map was consolidated into reader-experience. Ticket 01 of the original pwa effort (implement the website as a PWA) was marked closed on GitHub, but see the correction below: nothing actually shipped. Its number stays retired regardless. -->

- **The ask bundles two unrelated things** and the grilling must split them:
  1. *"not need to log in with creds all the time"* — a **session lifetime** problem, already
     partly addressed by the auth-cookie persistence that shipped with Google sign-in, and
     tracked as
     [Review session management](../../auth-sessions/tickets/02-review-session-management.md).
     It has nothing to do with downloading.
  2. *"later introduce downloading the course locally to finish offline"* — the real offline
     want, explicitly framed as later.
- **Offline is expensive and it collides with the access model.** Lesson bodies live in Convex
  blobs served through a content route; caching them locally means a copy of paid content
  sitting on a device that an Entitlement revocation cannot reach. That is the decision worth
  grilling, not the service-worker mechanics.
- Immutable Lessons (ADR 0003) are at least a gift here: cached content cannot go stale
  underneath a learner.
- **Premise correction (2026-08-01): there is no PWA.** The old map asserted that PWA
  groundwork was already closed. A direct check by
  [Surface inventory](../../ui-overhaul/tickets/04-surface-inventory.md) found `public/`
  holds only `favicon.ico`, `icon.svg` and a stray demo HTML file — no `manifest.json`, no
  service worker, no `next-pwa`, no `viewport`/`themeColor` export, no `apple-touch-icon`.
  **Nothing shipped.** So this ticket carries the installable-shell question too, and
  "check what the installed PWA already caches" is not a step that exists.
- **Sequenced behind [ui-overhaul](../../ui-overhaul/map.md)**, which runs first by its own
  Destination and will settle the mobile and shell questions underneath this.
- Skills: `/grilling`, `/ponytail` (establish what actually exists before building anything).
- **Fog:** offline Progress and quiz answers. If a learner works offline, their Responses have
  to queue and reconcile. Real, and unspecifiable until the offline-content decision lands.
- **Out of scope:** session lifetime itself —
  [auth-sessions](../../auth-sessions/map.md).

---

## Answer

**Decided 2026-08-23 by a /grilling session. DECIDED, NOT BUILT.** The build is
[installable-app](../../installable-app/spec.md) tickets 01-05, which render unstarted until each
lands its own Answer. Full decision record:
[ADR 0030](../../../../docs/adr/0030-installable-per-tenant-app.md).

The ticket asked three things at once, and all three are now separated.

**1. Credential persistence: already solved, and not this ticket's business.** Sessions run
365 days total with a 60-day rolling inactivity window, and the auth cookie carries a matching
`maxAge` (`src/lib/sessionLifetime.ts`). The "logs me out all the time" complaint was the missing
`cookieConfig` bug, fixed. Nothing further needed here.

**2. The installable shell: decided and specified.** The app becomes installable per tenant, which
costs nothing structurally because host-based tenancy (ADR 0022) plus a host-only session cookie
(ADR 0025) already make every subdomain its own origin. A per-tenant `/manifest.webmanifest` route
handler, an **App Icon derived at request time** from the tenant Logo via `next/og` (no new
dependency, no per-tenant design chore), a hand-rolled service worker on three caching rules, and
our own branded bottom sheet on `/` rather than the browser's prompt. Both platforms, because iOS
has no `beforeinstallprompt` and never will, so it gets instructions instead of a button that
cannot work.

**3. Offline: scoped to lists, and the content half re-filed.** What ships is the **Offline
Catalogue**, the last course lists the reader saw. Lesson bodies are not cached.

The reason is not the one this ticket assumed, and the assumption is worth correcting because it
would otherwise be re-derived. This ticket says caching content *"means a copy of paid content
sitting on a device that an Entitlement revocation cannot reach"*. **That is already true today.**
`GET /content?id=<storageId>` serves Lesson bodies with no authentication,
`Access-Control-Allow-Origin: *`, and `max-age=31536000, immutable`; the paygate sits only on the
query that hands out the id. Every learner who has opened a Lesson holds a permanent,
revocation-proof, world-readable URL to it. Caching would not introduce that exposure, only make it
convenient.

Which also disposes of the encryption question raised during the grilling: encrypting an offline
cache would be **strictly weaker** than the URL the learner can already save, since the key must
reach their device and lands in their IndexedDB. Encryption without a lease delivers zero
revocation; a lease without encryption delivers revocation within one lease period. The lease is
the mechanism; encryption is optional decoration on it.

Content was deferred because its real cost is the **writes**, not the cache: the quiz bridge
`postMessage`s answers to the parent, which writes them to Convex, and first-answer-only is
enforced server-side, so offline answers must queue and reconcile against a rule that assumes it
saw the first attempt. That is the fog this ticket listed, now named precisely and given its own
home.

**Two tickets carry the remainder:**

- [reader-experience/05](05-offline-lesson-content-under-a-lease.md) - offline Lesson content, the
  lease, and the Response/Progress queue.
- [marketplace/12](../../marketplace/tickets/12-content-route-is-an-open-bearer-url.md) - the
  `/content` bearer-URL exposure, which may block 05.

**The ui-overhaul sequencing was deliberately jumped.** This ticket said it was sequenced behind
that effort, which is at 2 of 13 tickets with its design foundation unresolved. Overridden on the
user's instruction 2026-08-23. The accepted cost is one component (the install sheet) probably
needing a restyle when the foundation lands.
