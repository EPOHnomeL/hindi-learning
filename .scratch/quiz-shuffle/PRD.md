# PRD — Quiz option shuffle (fix answer-position clustering)

## Problem

Multiple-choice quizzes cluster the correct answer at the first option position.
The only guard today is an AUTHORING.md instruction telling the authoring model to
balance options — which the model does not reliably follow (LLMs randomize poorly).
Result: a learner can often guess "first option" and be right.

## Mechanics (why the fix is safe)

- Quizzes are HTML embedded in `lessons.html` (and translated copies in
  `translations.html`), not structured data.
- Shape: `<div class="quiz" data-correct="b">` … `<div class="opts">` …
  `<button class="opt" data-k="a|b|c">text</button>` … `</div>`.
- The learner sees **no A/B/C labels** (`head.html` renders `.opt` as plain
  buttons). Visual order == DOM order of the buttons. `data-k` is an internal id
  that `data-correct` points at; `data-correct` is a **key letter**, not a position.
- Correctness (`k === data-correct`) is evaluated in both the visual layer
  (`foot.html`) and the capture bridge (`lessonSrcDoc.ts` `QUIZ_BRIDGE`) by
  matching `data-k`, never by position.

So **reordering the `.opt` buttons within `.opts`, keeping each button's `data-k`
+ text together and leaving `data-correct` unchanged**, moves the correct answer's
*visual* position with zero collateral:
- `responses` rows (keyed by `data-k`) stay semantically valid; frozen `correct`
  booleans stay correct.
- `quizStructureMatches` (`translate.ts`) only counts markers → unaffected.
- `quizId` (positional by `.quiz` block, not by option) → unchanged.

## Solution

1. **Future generations** — a deterministic shuffle applied at **publish time**
   (`scripts/publish.ts`), so distribution is guaranteed regardless of what the
   model authored. Author intent (`data-correct`) is preserved; only display order
   changes. AUTHORING.md updated to say position is randomized at publish.

2. **Backfill** — a secret-gated admin mutation reshuffles every existing quiz in
   the `lessons` table **and** the `translations` table (kind `lesson`), driven by
   a one-shot `tsx` script. `publishLesson` is insert-only, so the backfill uses a
   dedicated patch mutation. Future translations inherit the shuffled source, so
   only existing translations need the backfill.

## Shuffle contract (shared by publish + backfill)

`shuffleQuizOptions(html) -> html`, a pure function used by BOTH paths:

- Operates on each `.quiz[data-correct]`'s `.opts` block. Leaves fill-in quizzes
  (`.quiz.fill[data-answer]`, no `.opt`) and all non-quiz HTML untouched.
- **Deterministic & idempotent**: canonicalize options by `data-k` (stable a,b,c…),
  seed a PRNG from the order-invariant concatenation of option texts, Fisher-Yates
  permute. `shuffle(shuffle(x)) === shuffle(x)`. Same content → same order in both
  publish and backfill, and re-running the backfill is a no-op.
- **Invariants**: the multiset of `(data-k, text)` buttons is preserved; the
  `data-correct` letter is unchanged; the option whose `data-k === data-correct`
  still carries the same text. Handles n≥2 options.

## Out of scope

- Perfectly uniform distribution (hash-seeded per-quiz spread is sufficient to kill
  the "always first" tell).
- Changing quiz identity, quiz count, or `data-k` values.
- Reshuffling on every render (order is baked at publish/backfill for stable
  capture + review).

## Acceptance

- New lessons published via `publish.ts` have shuffled option order.
- Existing lessons + lesson translations reshuffled once via the backfill script.
- Correctness preserved end-to-end (visual layer + capture bridge still score right).
- `pnpm test` + `pnpm typecheck` green.
