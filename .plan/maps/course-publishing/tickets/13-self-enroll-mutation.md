---
type: task
blocked_by: [09, 10]
---

# Self-enroll mutation

## Question

The write side of self-enroll: the one-click Join that turns a browsed free published course into an
`enrollments` grant. Split from the primitive ([issue 09](09-enrollments-and-enrolled-grant.md))
because its creation-side guards reference the publish status ([issue 10](10-publish-lifecycle.md)).
Ground truth: [ticket 01](01-model-self-enroll-grant.md), ADR 0023, [ticket 03](03-define-publish-action.md)
(the `published` guard), [ticket 07](07-language-scoped-access.md) (the language pick).

Scope — a mutation `enroll({ topicSlug, lang })` (or `catalogue.join`):
- **Auth:** signed-in caller (`getAuthUserId`); throw otherwise.
- **Guard — published:** the topic's `status === "published"` (a private/unpublished course has no
  catalogue path). Throw otherwise.
- **Guard — free:** `editionPrice(ctx, topic._id, lang) === null` — enroll is the **free** grant; a
  priced Edition is bought via `startCheckout`. Throw if priced.
- **Guard — real Edition:** `lang` is an Edition the course holds (source `en` or a **ready**
  translation) — reuse `heldLangs(ctx, topic, topic.ownerId)`. Throw for a bogus language.
- **Guard — language flag:** when `lang !== "en"`, require the tenant `translations` flag
  (`assertTenantFlag(ctx, topic.tenantSlug, "translations")`); English always allowed.
- **Idempotent write:** if an `enrollments` row exists for `(userId, topicId, lang)` (via
  `by_topic_user`), no-op; else insert `{ userId, topicId, lang }`. Re-Join in another language is
  another call → an additive per-Edition grant (permanent — no un-enroll in v1).
- **Returns:** enough for the catalogue to flip the card to "Joined / Continue" (keep it lazy).

**No resolver change** — issue 09 already added the `enrolled` branch; this only writes the row.

Tests (write first): Join a free `published` Edition → one row, caller resolves `enrolled` and reads
it; idempotent (Join twice → one row); re-Join a different language → a second row, both grant access;
throws on unpublished/`completed`, a priced Edition, a language with no Edition, a non-English language
when the `translations` flag is off; grandfather (enroll free, then price → enrollee still reads, a new
caller can't enroll).

## Done when

Typecheck / codegen clean; all guard + idempotency + grandfather tests pass; no un-enroll path exists.

## Answer

Shipped, but **the one-click Join mutation was not needed** (build 2026-07-28; decision of record
`docs/adr/0024-publish-at-the-edition-grain.md`). Because publishing went per-Edition, a **free
published Edition reads ≡ a Viewer for any signed-in account** — access is granted live in `grantsFor`,
with **no join click and no `enrollments` row written**. The `enrollments` table and the `enrolled`
resolver branch (ADR 0023 / [issue 09](09-enrollments-and-enrolled-grant.md)) stay in place and are
still honoured — nothing writes them. So the `enroll`/`catalogue.join` mutation this ticket specced was
superseded: the free-acquisition path it guarded collapsed to zero-step read access. (A priced Edition
still goes through the existing Preview + paygate, unchanged.)

**Unblocks:** 14, 15.
