# course-publishing/13: Self-enroll mutation

**Status:** ready-for-agent
**Depends on:** 09, 10
**Labels:** ready-for-agent
**Loop:** `/tdd` (test-first) + `/ponytail`

Child of [Course-publishing PRD](PRD.md). Ground truth: [ticket 01](01-model-self-enroll-grant.md),
[ADR 0023](adr-0023-draft-self-enroll-access-primitive.md), [ticket 03](03-define-publish-action.md)
(the `published` guard), [ticket 07](07-language-scoped-access.md) (the language pick).

## Why

The write side of self-enroll: the one-click Join that turns a browsed free published course into an
`enrollments` grant. Split from the primitive ([issue 09](09-enrollments-and-enrolled-grant.md))
because its creation-side guards reference the publish status ([issue 10](10-publish-lifecycle.md)).

## Scope

A mutation — `enroll({ topicSlug, lang })` (or `catalogue.join`) in a new/appropriate module:

- **Auth:** signed-in caller (`getAuthUserId`); throw if not.
- **Guard — published:** the topic's `status === "published"`. A private/unpublished course has no
  catalogue path, so no self-enroll (ADR 0023). Throw otherwise.
- **Guard — free:** `editionPrice(ctx, topic._id, lang) === null`. Enroll is the **free** grant; a
  priced Edition is bought via `startCheckout`, never enrolled. Throw if priced.
- **Guard — real Edition:** `lang` is an Edition the course actually holds — the source `en` or a
  language with a **ready** translation job. Reuse `heldLangs(ctx, topic, topic.ownerId)` (the owner's
  held set = the sellable/enrollable Editions) or an equivalent check. Throw for a bogus language.
- **Guard — language flag:** when `lang !== "en"`, require the topic's tenant `translations` flag on
  (`assertTenantFlag(ctx, topic.tenantSlug, "translations")`). Flag off ⟹ English-only Join (ticket
  07). English (`en`) is always allowed.
- **Idempotent write:** if an `enrollments` row already exists for `(userId, topicId, lang)` (via
  `by_topic_user`, matching `lang` in memory), no-op; else insert `{ userId, topicId, lang }`. Re-Join
  in another language is just another call → an additive per-Edition grant (grandfathered, permanent —
  no un-enroll in v1).
- **Returns:** enough for the catalogue to flip the card to "Joined / Continue" (e.g. `null` and let
  the catalogue query re-run, or the joined `lang`). Keep it lazy.

**No resolver change** — issue 09 already added the `enrolled` branch; this only writes the row.

## Tests (write first)

- Join a free `published` Edition → one `enrollments` row; the caller now resolves `enrolled` and can
  read it (compose with issue 09's resolver).
- Idempotent: Join twice on the same `(user, topic, lang)` → still one row.
- Re-Join a different language → a second row; both grant access.
- Throws: unpublished/`completed` topic; a priced Edition; a language with no Edition; a non-English
  language when the tenant `translations` flag is off.
- Grandfather: enroll free, then `setEditionPrice` on that Edition → the enrollee still reads it
  (resolver check from issue 09), and a *new* caller can no longer enroll (it's priced now).

## Acceptance criteria

- Typecheck / codegen clean.
- All guard + idempotency + grandfather tests pass.
- No un-enroll path exists (out of scope, v1).

**Unblocks:** 14, 15.
