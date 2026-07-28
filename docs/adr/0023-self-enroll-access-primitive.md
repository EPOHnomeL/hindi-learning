# Self-enroll as a first-class access primitive

> Deliverable of [course-publishing/01](../../.scratch/course-publishing/01-model-self-enroll-grant.md).
> Promoted from the [draft](../../.scratch/course-publishing/adr-0023-draft-self-enroll-access-primitive.md)
> when course-publishing implementation started ([issue 09](../../.scratch/course-publishing/09-enrollments-and-enrolled-grant.md)).
> The draft reserved "ADR 0023"; that number was still free at graduation.

## Status

accepted — decision agreed during course-publishing ticket 01 (`/grilling` +
`/domain-modeling`, 2026-07-18); the `enrollments` table + `enrolled` resolver
branch implemented in course-publishing issue 09 (2026-07-19). Additive — does
not supersede any prior ADR.

**Amended 2026-07-28 by [ADR 0024](0024-publish-at-the-edition-grain.md).** Two things below have
moved, and the reader should hold them in mind throughout:

- **"Published" is a row, not a status.** Where this ADR says a course is `published` (a
  `topics.status` value from the then-current ticket 03), it now means "this Edition has a
  `publishedEditions` row with `published: true`" — per-Edition, off the authoring lifecycle.
- **Nothing writes an `enrollments` row today.** A *free published* Edition reads ≡ a Viewer for any
  signed-in account, granted live by the resolver, so the one-click join this ADR was designed for
  never shipped. The table, the `enrolled` level and the resolver branch **all stay in place and are
  still honoured** — an existing row grants exactly what is described below, including the
  grandfathering the live grant deliberately does not do. It is the primitive to reach for the day a
  grant must outlive the owner's publish decision (a grandfathered free cohort, expiry, revocation).

## Context

The app has **no "enroll" concept**. Read access to a course Edition `(topic, lang)` resolves at one
seam — `editionAccessLevel` in [`convex/lib.ts`](../../convex/lib.ts) — from exactly four grants:
**ownership**, a **`shares`** row (owner-granted), an **`entitlements`** row (paid via PayFast or
admin-granted), or a **`publicLinks`** token (anonymous). A free Edition with no grant returns `none`
(not-found). So a tenant member has *nothing* on a free course unless someone shares it, they buy it,
or they have a link.

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
  badge and a future "my enrolled courses" query. `heldLangs` and `getViewableTopic` union in enrolled
  languages, so an enrollee reads their Edition, tracks their own Progress, and earns a Certificate
  exactly like a Viewer.
- **Grandfathered / permanent.** An enrollment is a permanent grant like an entitlement: if the owner
  later **prices** a previously-free Edition, already-enrolled users keep full access; only *new* free
  joins stop. The resolver's enrollment check wins regardless of the current price, so there is no
  price re-check.
- **Created only for a currently-free, published Edition** (creation-side guard — the enroll mutation,
  [issue 13](../../.scratch/course-publishing/13-self-enroll-mutation.md); the resolver itself is
  status-agnostic and grandfathers even after unpublish). Idempotent per `(user, topic, lang)`.
- **Private/unpublished courses stay grant-only** — not in the catalogue, so no self-enroll path;
  existing enrollments grandfather if a course is later unpublished.

## Scope boundaries

- **Per-language enrollment only** here. *Whether a user is permitted to enroll in a given language*
  was the separate **language-scoped access** question (course-publishing ticket 07), which
  **collapsed**: content translation already ships, so there is no content-language *access* layer —
  only a per-card language pick (default English), gated by the tenant `translations` flag, on the
  catalogue. No `users.contentLang`, no disabled cross-language cards.
- **Un-enroll is out of scope** for v1 — self-enroll is one-way.

## Consequences

- One new table, one new resolver branch, one new `enrolled` enum value that every `EditionAccess`
  consumer must handle (small, mechanical — the client-facing surface is `content.courseHeader.role`).
- The paid and shared read paths are untouched; enrollment is additive.
- A free→paid Edition can carry a cohort of grandfathered free readers — acceptable and intended.
