# Issues — Quiz option shuffle

## issue-01 — `shuffleQuizOptions` pure helper (TDD)
`convex/quizShuffle.ts` — pure, dependency-free helper importable by both the
Convex runtime and Node scripts. Tests in `convex/quizShuffle.test.ts` first.
- Reorders `.opt` buttons inside each `.quiz[data-correct] .opts`.
- Deterministic, idempotent (canonical-by-`data-k` seed).
- Preserves `(data-k, text)` multiset and `data-correct`.
- Leaves fill-in quizzes and non-quiz HTML untouched.
- Distribution: correct answer is not pinned to position 1 across a fixture set.

## issue-02 — Publish-time shuffle
`scripts/publish.ts` — call `shuffleQuizOptions` inside `assembleLesson` on the
authored fragment content before wrapping. Already-complete (immutable legacy)
docs pass through as today. Manual/type check only (script, no unit test).

## issue-03 — Backfill mutation + script
- `convex/backfill.ts` — `backfillQuizShuffle` admin mutation (secret-gated via
  `assertAdmin`). Iterates all `lessons` and all `translations` of kind `lesson`
  with html, patches `html = shuffleQuizOptions(html)`. Idempotent. Returns
  `{ lessons, translations }` counts.
- `scripts/backfill-quiz-shuffle.ts` — thin driver following `migrate-hindi.ts`
  (dev + `--prod`), logs counts. Wire `backfill-quiz-shuffle[:prod]` npm scripts.

## issue-04 — Docs
- Update AUTHORING.md §3 (both `.claude` and `.agents` copies): option order is
  randomized at publish; author for correctness, not position; keep equal-length
  options.
- ADR `docs/adr/0019-quiz-option-shuffle.md`.
