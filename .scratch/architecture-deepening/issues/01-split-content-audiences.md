# architecture-deepening/01: Split content.ts into reader/authoring/publish modules

**Status:** done
**Labels:** —

## Why

`convex/content.ts` (929 lines) mixed three audiences in one file, separated only by comment
banners: public learner reader queries (`listTopics`, `dashboard`, `courseHeader`, `listLessons`,
`getLesson`, `listReferences`, `getReference`), owner-authoring mutations including the
quiz-structure guard (`editLesson`, `deleteLesson`, `editReference`, `editTranslatedLesson`, …),
and `PUBLISH_SECRET`-guarded CLI write-back mutations (`generateContentUploadUrl`, `ensureTopic`,
`publishMission`, `completeCourse`, `publishLesson`, `publishLearningRecord`, `upsertReference`).
A security-relevant seam (the secret-guarded publish path) sharing a file — and a mental model —
with public reads was the top recommendation of the 2026-07-24 architecture review
([map](00-architecture-deepening-map.md)).

## Scope

- `convex/content/reader.ts`, `authoring.ts`, `publish.ts` — one audience each, thin adapters,
  no logic changes.
- Every `api.content.*` / `internal.content.*` call site updated to its new module path
  (frontend components, `scripts/publish.ts`, `scripts/complete.ts`, `convex/openrouter.ts`, all
  affected test files).
- Tests split the same way (`reader.test.ts`, `authoring.test.ts`, `publish.test.ts`), shared
  setup extracted to `convex/content/testHelpers.ts`.

## Out of scope

- Fixing the pre-existing missing `returns:` validators on several reader queries
  (`listTopics`, `dashboard`, `listLessons`, `listReferences`) — pre-existing tech debt, not
  introduced by this move, out of scope for a behavior-preserving split.
- `lib.ts`'s own module boundaries — [ticket 02](02-lib-module-boundaries.md).

## Acceptance criteria

- [x] `pnpm typecheck` clean.
- [x] Full convex suite green (458/459 — the one red is a pre-existing unrelated flaky
      timestamp-boundary test in `convex/sales.test.ts`, not touched by this change).
- [x] No behavior change: every moved function's args/handler/returns validator byte-identical
      to the original.

## Notes

Landed as PR #107 (`refactor/content-module-split`), delivered as an actual GitHub PR per the
user's explicit request for this batch (this repo's normal convention is trunk-based, direct
commits to `main` — see `CLAUDE.md`).

## Comments

### Claude — 2026-07-24

Implemented via `convex:convex-expert` agent (mechanical move + reference rename across ~20
files), verified independently (`pnpm typecheck`, `npx vitest run convex/content`) before
committing. Merged/open status of PR #107 to be tracked separately — this ticket marks the work
as landed on the branch.
