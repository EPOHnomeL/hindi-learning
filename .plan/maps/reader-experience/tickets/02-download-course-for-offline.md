---
type: grilling
blocked_by: []
---

# Implement PWA

## Question

Add a download course feature to allow users to download and not need to log in with creds all the time just once and later introduce downloading the course locally to finish offline.

## Done when

The download/offline want is grilled into a decision — what "download" means (credential persistence vs offline content), what it needs beyond the PWA work already closed — and implementation tickets exist.

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
