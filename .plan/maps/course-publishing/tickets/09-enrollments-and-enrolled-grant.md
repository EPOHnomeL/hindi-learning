---
type: task
blocked_by: []
---

# Enrollments table & the `enrolled` access grant

## Question

The foundation. Self-enroll is the **new fifth access primitive** — today read access resolves only
from ownership, `shares`, `entitlements`, and `publicLinks`. Every downstream issue (the enroll
mutation, the catalogue, the dashboard) reads this table or the `enrolled` level. Build the primitive
and thread it through the read paths **before** any surface exists. Ground truth:
[ticket 01](01-model-self-enroll-grant.md), ADR 0023.

Scope:
- **Schema** (`convex/schema.ts`) — the new `enrollments` table `{ userId, topicId, lang }`, siblings
  of the `entitlements` indexes: `by_user`, `by_topic`, `by_topic_user`.
- **Resolver** (`convex/lib.ts`) — extend `EditionAccess` (`lib.ts:325`) with `"enrolled"`; add
  `enrolledLangs(ctx, topicId, userId)` (twin of `entitledLangs`); in `editionAccessLevel`
  (`lib.ts:354`), after the `entitled` check, return `"enrolled"` for a held enrollment — the check
  must sit inside the `if (userId)` block and win over the free-`none`/paid-`preview` fallbacks so a
  grandfathered enrollee on a now-priced Edition keeps full access (no price re-check); union enrolled
  langs into `heldLangs` (`lib.ts:245`, non-owner branch) and grant topic visibility in
  `getViewableTopic` (`lib.ts:170`).
- **Consumers** — widen every `EditionAccess`-derived returns validator (notably
  `content.courseHeader.role`, `content.ts:625`, += `v.literal("enrolled")`).
- **ADR** — graduate the ADR 0023 draft to `docs/adr/0023-self-enroll-access-primitive.md`.

**Not here:** the `enroll` mutation (needs the publish gate — [issue 13](13-self-enroll-mutation.md));
the "my enrolled courses" dashboard query ([issue 16](16-enrolled-on-dashboard.md)).

Tests (write first): `editionAccessLevel` returns `"enrolled"` for a held enrollment on a free
Edition, still `"enrolled"` after that Edition is priced (grandfather), `"none"`/`"preview"` unchanged
without an enrollment; an enrollee reads the joined Edition and tracks own progress; owner / Share /
entitlement / public-link paths unchanged (regression). Idempotency is the mutation's job (issue 13) —
no unique index here.

## Done when

Typecheck / `npx convex codegen` clean with the new table + widened union; the resolver + read-path
tests pass with no regressions; `courseHeader.role` exposes `enrolled`; ADR 0023 lives at
`docs/adr/0023-*.md`.

## Answer

Done 2026-07-19 (`/tdd` + `/ponytail`). Built test-first. Seams (confirmed with the user): the
resolver helpers directly via `t.run` (precedence + grandfather), and the reader query end-to-end.

- **Schema** (`convex/schema.ts`): the `enrollments` table (`{ userId, topicId, lang }`, indexes
  `by_user` / `by_topic` / `by_topic_user`).
- **Resolver** (`convex/lib.ts`): `EditionAccess` extended with `"enrolled"`; new `enrolledLangs`
  helper; `editionAccessLevel` gains the `enrolled` branch (checked before the price fallback →
  grandfathered, no price re-check); `heldLangs` (non-owner branch) and `getViewableTopic` union in
  enrollments.
- **Consumer** (`convex/content.ts`): `courseHeader.role` union += `enrolled` (the only
  `EditionAccess` level that leaks to the client). `lessonLocked` locks only `preview`, so an enrollee
  reads freely — no change needed.
- **ADR** graduated to `docs/adr/0023-self-enroll-access-primitive.md`; the scratch draft is now a
  redirect stub.
- **Tests** (`convex/enrollment.test.ts`): 6 cases — resolver returns `enrolled`; grandfather after
  pricing; per-Edition isolation; `getViewableTopic`/`heldLangs`; reader end-to-end; owner-regression.

**Verified:** `tsc --noEmit` clean; full convex suite **395 passed / 31 files**, no regressions.

**Unblocks:** 13, 14, 16.
