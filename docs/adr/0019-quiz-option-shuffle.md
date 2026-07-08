---
status: proposed
---

# Quiz option order is shuffled at publish, not authored

Multiple-choice quiz options are reordered by a deterministic shuffle at publish
time, and a one-shot backfill applied the same shuffle to every already-stored
lesson and translated Edition. This ADR records why placement was moved out of
the authoring contract and into code, and the invariants the shuffle must hold.

## Context

Quizzes are authored as HTML embedded in the lesson body (`AUTHORING.md` §3), not
as structured data. The only defence against a guessable answer position was an
authoring instruction to balance the options. The authoring model does not follow
it reliably — it clusters the correct answer at the first option, so a learner who
always picks the first choice scores far above chance.

The correct-answer marker is a **key letter**, not a position: `.quiz[data-correct]`
holds a `data-k` value (`"a"`/`"b"`/…) and the matching `.opt[data-k]` button is
correct. Both scoring layers — the in-lesson visual feedback (`foot.html`) and the
reader's capture bridge (`lessonSrcDoc.ts` `QUIZ_BRIDGE`) — resolve correctness by
matching `data-k`, never by DOM position. The learner sees no A/B/C labels
(`head.html` renders `.opt` as plain buttons), so the only thing option DOM order
controls is the on-screen order.

## Decision

- **A pure helper `shuffleQuizOptions` (`convex/quizShuffle.ts`) reorders the
  `.opt` buttons within each quiz**, keeping each button's `data-k` + text together
  and leaving `data-correct` unchanged. It runs in both the Convex runtime and Node.
- **Publish-time (`scripts/publish.ts`) is the guarantee.** Every newly authored
  lesson is shuffled before it is stored, regardless of what the model produced.
  The authoring contract now says position is randomised at publish — author for
  correctness, not placement.
- **The shuffle is deterministic and idempotent.** Options are canonicalised by
  `data-k`, then permuted with a PRNG seeded from the order-invariant option-text
  set. Same content → same order in publish and backfill; re-running the backfill
  is a no-op.
- **A one-shot backfill (`convex/backfill.ts` + `scripts/backfill-quiz-shuffle.ts`)
  reshuffled existing rows** — the `lessons` table and every `translations` row of
  kind `lesson`. `publishLesson` is insert-only (immutability, ADR 0003), so the
  backfill uses a dedicated secret-gated patch mutation, paginated. Future
  translations inherit the shuffled source, so only pre-existing ones needed it.

## Consequences

- **No collateral.** Reordering preserves the `(data-k, text)` multiset and
  `data-correct`, so: captured `responses` (keyed by `data-k`, with a frozen
  `correct` boolean) stay valid; the translate structure guard
  (`quizStructureMatches`, which only counts markers) is unaffected; and quiz
  identity (`quizId`, positional by `.quiz` block) is unchanged.
- **Editing the immutable `lessons` HTML was a deliberate, bounded exception** to
  ADR 0003 — a one-time content-neutral migration, not an ongoing mutation path.
- **Distribution is "good enough", not perfectly uniform.** Per-quiz hash seeding
  spreads the answer across positions and removes the "always first" tell; it does
  not guarantee an exactly even split, which is not required.
- **Placement is no longer an authoring concern.** Anyone reintroducing a
  position-sensitive quiz format must revisit this decision.
