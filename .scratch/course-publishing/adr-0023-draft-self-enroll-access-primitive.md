# ADR 0023 (draft): Self-enroll as a first-class access primitive

**Status:** draft (resolves course-publishing ticket 01; finalise into `docs/adr/0023-*` at the PRD step)
**Date:** 2026-07-18
**Context effort:** [Course publishing map](00-course-publishing-map.md)

## Context

The app has **no "enroll" concept**. Read access to a course Edition `(topic, lang)` resolves at one
seam — `editionAccessLevel` in `convex/lib.ts` — from exactly four grants: **ownership**, a
**`shares`** row (owner-granted), an **`entitlements`** row (paid via PayFast or admin-granted), or a
**`publicLinks`** token (anonymous). A free Edition with no grant returns `none` (not-found). So a
tenant member has *nothing* on a free course unless someone shares it, they buy it, or they have a
link.

The course-publishing effort needs members to **browse a catalogue and join free courses themselves**
— a self-initiated grant that none of the four existing primitives models honestly.

## Decision

Introduce **`enrollments`** as a fifth, first-class grant.

- **Table:** `enrollments` — a row `{ userId, topicId, lang }`. Per-**Edition** `(topic, lang)`,
  matching the grain of shares/entitlements/listings/public-links and the resolver seam. Indexed
  `by_user`, `by_topic`, and `by_topic_user` (siblings of the entitlements indexes).
- **Not `entitlements` or `shares` reused.** A free join written as a zero-amount entitlement would
  surface under "Purchases" and pollute the ledger/refund invariants; written as a share it would
  surface under "Shared with me" and carry owner/editor-role baggage. This is a *discovery* feature
  where that mislabelling is what the learner sees. A dedicated table keeps `entitlements` = money and
  `shares` = owner-granted, and gives the deferred fog items (expiry, notifications, the later
  un-enroll effort) an honest home.
- **Resolver:** `editionAccessLevel` gains one check returning a distinct **`enrolled`** access level
  — parallel to `entitled`, treated ≡ `viewer` for access, but keeping provenance for a "joined"
  badge and a future "my enrolled courses" query.
- **Grandfathered / permanent.** An enrollment is a permanent grant like an entitlement: if the owner
  later **prices** a previously-free Edition, already-enrolled users keep full access; only *new* free
  joins stop. The resolver's enrollment check wins regardless of the current price, so there is no
  price re-check.
- **Created only for a currently-free, published Edition** (creation-side guard — see tickets 03/05).
  Idempotent per `(user, topic, lang)`.
- **Private/unpublished courses stay grant-only** — not in the catalogue, so no self-enroll path;
  existing enrollments grandfather if a course is later unpublished.

## Scope boundaries

- **Per-language enrollment only** here. *Whether a user is permitted to enroll in a given language*
  is the separate **language-scoped access** decision (gated by the tenant `translations` flag) —
  ticket 07 on this map.
- **Un-enroll is out of scope** for v1 — self-enroll is one-way.

## Consequences

- One new table, one new resolver branch, one new `enrolled` enum value that every `EditionAccess`
  consumer must handle (small, mechanical).
- The paid and shared read paths are untouched; enrollment is additive.
- A free→paid Edition can carry a cohort of grandfathered free readers — acceptable and intended.
