# PWA & offline

<!-- Charted 2026-07-30 when this repo retired its GitHub issue tracker: every ticket
     here was a GitHub issue, migrated verbatim. This map is an INDEX, not a store —
     each decision lives in its own ticket; the map gists it and links. -->

## Destination

A decision on what "download the course" actually means — staying signed in, or reading
offline — and what it costs on top of the PWA groundwork already closed.

## Notes

- **Ticket 01 of this effort (implement the website as a PWA) was closed on GitHub**; it is not
  present as a file. Numbering starts at 02 because `NN` is a permanent identity.
- **The ask bundles two unrelated things** and the grilling must split them:
  1. *"not need to log in with creds all the time"* — a **session lifetime** problem, already
     partly addressed by the auth-cookie persistence that shipped with Google sign-in, and
     tracked as
     [session-management/01](../session-management/tickets/01-review-session-management.md).
     It has nothing to do with downloading.
  2. *"later introduce downloading the course locally to finish offline"* — the real offline
     want, explicitly framed as later.
- **Offline is expensive and it collides with the access model.** Lesson bodies live in Convex
  blobs served through a content route; caching them locally means a copy of paid content
  sitting on a device that an Entitlement revocation cannot reach. That is the decision worth
  grilling, not the service-worker mechanics.
- Immutable Lessons (ADR 0003) are at least a gift here: cached content cannot go stale
  underneath a learner.
- Skills: `/grilling`, `/ponytail` (check what the installed PWA already caches before
  building anything).

## Decisions so far

<!-- one line per resolved ticket -->

## Not yet specified

- **Offline Progress and quiz answers.** If a learner works offline, their Responses have to
  queue and reconcile. Real, and unspecifiable until the offline-content decision lands.

## Out of scope

- Session lifetime itself — [session-management](../session-management/map.md).
