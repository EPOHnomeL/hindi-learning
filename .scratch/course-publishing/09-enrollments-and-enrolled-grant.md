# course-publishing/09: Enrollments table & the `enrolled` access grant

**Status:** done (2026-07-19, `/tdd` + `/ponytail`)
**Depends on:** —
**Labels:** ready-for-agent
**Loop:** `/tdd` (test-first) + `/ponytail`

Child of [Course-publishing PRD](PRD.md). Ground truth:
[ticket 01](01-model-self-enroll-grant.md), [ADR 0023 draft](adr-0023-draft-self-enroll-access-primitive.md).

## Why

The foundation. Self-enroll is the **new fifth access primitive** — today read access resolves only
from ownership, `shares`, `entitlements`, and `publicLinks`. Every downstream issue (the enroll
mutation, the catalogue, the dashboard) reads this table or the `enrolled` level. Build the primitive
and thread it through the read paths **before** any surface exists — no catalogue, no UI yet (a
test-only insert exercises the resolver).

## Scope

**Schema** (`convex/schema.ts`) — the new table, siblings of the `entitlements` indexes:

```ts
enrollments: defineTable({
  userId: v.id("users"),
  topicId: v.id("topics"),
  lang: v.string(),
})
  .index("by_user", ["userId"])
  .index("by_topic", ["topicId"])
  .index("by_topic_user", ["topicId", "userId"]),
```

**Resolver** (`convex/lib.ts`):

- Extend `EditionAccess` (`lib.ts:325`) to `"owner" | "viewer" | "entitled" | "enrolled" | "preview" | "none"`.
- Add `enrolledLangs(ctx, topicId, userId)` — the twin of `entitledLangs` (`lib.ts:232`), reading
  `by_topic_user`.
- In `editionAccessLevel` (`lib.ts:354`), after the `entitled` check, add: if the caller holds an
  enrollment for `lang` → return `"enrolled"`. **Order matters** — an enrollee who is *also* later a
  buyer/sharee is fine either way (all read ≡ viewer), but the enrollment check must sit inside the
  `if (userId)` block and win over the free-`none` / paid-`preview` fallbacks so a grandfathered
  enrollee on a now-**priced** Edition keeps full access (no price re-check — ADR 0023).
- In `heldLangs` (`lib.ts:245`), for the **non-owner** branch, union enrolled langs alongside
  viewer + entitled langs (so `readableLang`, the editions switcher, progress, and certificate
  eligibility all follow).
- In `getViewableTopic` (`lib.ts:170`), grant topic-level visibility to an enrollment holder — add an
  `enrollments` `by_topic_user` `.first()` check beside the existing `shares` / `entitlements` ones.

**Consumers** — widen every `EditionAccess`-derived returns validator that enumerates the levels. The
one that leaks to the client today is **`content.courseHeader.role`** (`content.ts:625`): add
`v.literal("enrolled")` to its union (an `enrolled` caller reads exactly like `viewer`; kept distinct
only for the "Joined" badge). Grep `EditionAccess` / the literal unions across `convex/` and fix each
(`content.ts`, `public.ts` currently return `none`-guarded levels — confirm none narrow the type).

**ADR** — graduate [ADR 0023 draft](adr-0023-draft-self-enroll-access-primitive.md) to
`docs/adr/0023-self-enroll-access-primitive.md` (mirrors how whitelabel finalized its ADR at build
start). Drop the "draft" marker; keep the content.

**Not here:** the `enroll` mutation (needs the publish gate — [issue 13](13-self-enroll-mutation.md));
the "my enrolled courses" dashboard query ([issue 16](16-enrolled-on-dashboard.md)).

## Tests (write first)

- `editionAccessLevel` returns `"enrolled"` for a held enrollment on a free Edition; still `"enrolled"`
  after that Edition is later priced (grandfather); `"none"`/`"preview"` unchanged with no enrollment.
- An enrollee reads the joined Edition via the reader path (`heldLangs` includes it; `getViewableTopic`
  returns the topic) and tracks their own progress.
- Owner / Share / entitlement / public-link paths are unchanged (regression guard).
- Idempotency of the *grant* is enforced by the mutation (issue 13), not the table — no unique index
  here; the resolver treats duplicate rows as one hold.

## Acceptance criteria

- Typecheck / `npx convex codegen` clean with the new table + widened union.
- The resolver + read-path tests above pass; no existing test regresses.
- `EditionAccess` consumers all compile against the widened type; `courseHeader.role` exposes
  `enrolled`.
- ADR 0023 lives at `docs/adr/0023-*.md`.

**Unblocks:** 13, 14, 16.

## Resolution (2026-07-19)

Built test-first. **Seams** (confirmed with the user): the resolver helpers directly via
`t.run` (precedence + grandfather), and the reader query end-to-end (an enrollee reads the course).

- **Schema** ([`convex/schema.ts`](../../convex/schema.ts)): the `enrollments` table
  (`{ userId, topicId, lang }`, indexes `by_user` / `by_topic` / `by_topic_user`).
- **Resolver** ([`convex/lib.ts`](../../convex/lib.ts)): `EditionAccess` extended with `"enrolled"`;
  new `enrolledLangs` helper; `editionAccessLevel` gains the `enrolled` branch (checked before the
  price fallback → grandfathered, no price re-check); `heldLangs` (non-owner branch) and
  `getViewableTopic` union in enrollments.
- **Consumer** ([`convex/content.ts`](../../convex/content.ts)): `courseHeader.role` union += `enrolled`
  (the only `EditionAccess` level that leaks to the client). `lessonLocked` locks only `preview`, so an
  enrollee reads freely — no change needed.
- **ADR** graduated to [`docs/adr/0023-self-enroll-access-primitive.md`](../../docs/adr/0023-self-enroll-access-primitive.md);
  the scratch draft is now a redirect stub.
- **Tests** ([`convex/enrollment.test.ts`](../../convex/enrollment.test.ts)): 6 cases — resolver
  returns `enrolled`; grandfather after pricing; per-Edition isolation; `getViewableTopic`/`heldLangs`;
  reader end-to-end (`courseHeader` role + `getLesson` unlocked); owner-regression.

**Verified:** `tsc --noEmit` clean; full convex suite **395 passed / 31 files**, no regressions. The
`enroll` mutation (creation-side `published`+free guards) is [issue 13](13-self-enroll-mutation.md);
"my enrolled courses" surfacing is [issue 16](16-enrolled-on-dashboard.md).
