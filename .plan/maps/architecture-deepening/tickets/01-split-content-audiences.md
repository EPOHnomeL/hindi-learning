---
type: task
blocked_by: []
---

# Split content.ts into reader/authoring/publish modules

## Question

`convex/content.ts` (929 lines) mixes three audiences in one file, separated only by comment
banners: public learner reader queries (`listTopics`, `dashboard`, `courseHeader`, `listLessons`,
`getLesson`, `listReferences`, `getReference`), owner-authoring mutations including the
quiz-structure guard (`editLesson`, `deleteLesson`, `editReference`, `editTranslatedLesson`, …),
and `PUBLISH_SECRET`-guarded CLI write-back mutations (`generateContentUploadUrl`, `ensureTopic`,
`publishMission`, `completeCourse`, `publishLesson`, `publishLearningRecord`, `upsertReference`).
A security-relevant seam (the secret-guarded publish path) sharing a file — and a mental model —
with public reads was the top recommendation of the 2026-07-24 architecture review
([map](../map.md)).

Split it into one module per audience — `convex/content/reader.ts`, `authoring.ts`, `publish.ts`
— as thin adapters with no logic changes. Every `api.content.*` / `internal.content.*` call site
(frontend components, `scripts/publish.ts`, `scripts/complete.ts`, `convex/openrouter.ts`, all
affected test files) moves to its new module path. Tests split the same way
(`reader.test.ts`, `authoring.test.ts`, `publish.test.ts`), with shared setup extracted to
`convex/content/testHelpers.ts`.

Out of scope: fixing the pre-existing missing `returns:` validators on several reader queries
(`listTopics`, `dashboard`, `listLessons`, `listReferences`) — pre-existing tech debt, not
introduced by this move. `lib.ts`'s own module boundaries are [ticket 02](02-lib-module-boundaries.md).

## Done when

`content.ts` is split into `reader.ts` / `authoring.ts` / `publish.ts` (one audience each) with
no behavior change — every moved function's args/handler/returns validator byte-identical to the
original — `pnpm typecheck` clean, and the full convex suite green (the one red being the
pre-existing unrelated flaky timestamp-boundary test in `convex/sales.test.ts`).

## Answer

**Landed** as PR #107 (`refactor/content-module-split`). `convex/content.ts` (929 lines, three
audiences under comment banners) was split into `convex/content/reader.ts` / `authoring.ts` /
`publish.ts`; every `api.content.*` / `internal.content.*` call site was updated to its new module
path and the tests split to match. Pure move, `tsc` clean, full convex suite green (458/459 — the
one red is the pre-existing unrelated flaky timestamp-boundary test in `convex/sales.test.ts`).

Implemented via the `convex:convex-expert` agent (mechanical move + reference rename across ~20
files), verified independently (`pnpm typecheck`, `npx vitest run convex/content`) before
committing. Delivered as an actual GitHub PR per the user's explicit request for this batch — a
one-off deviation from this repo's normal trunk-based convention (direct commits to `main`); the
user reverted to trunk commits for tickets 02–05.
