---
type: task
blocked_by: []
---
# One publish door for the quiz-structure guard

## Question

Filed 2026-09-07 from the 2026-09-04 architecture review (candidate 2), re-verified in
the tree on 2026-09-07 before filing.

`quizStructureMatches` is exported from `convex/translate.ts:1060` for testability, but
the **policy** it serves (fetch the other body's bytes, then decide *skip* against
*refuse*) is rewritten at six call sites:

- `translate.ts:588` (`publishTranslationChecked`)
- `translate.ts:734` (`publishTranslation`)
- `translate.ts:973` (`translateTopic`)
- `content/authoring.ts:246` (`editLesson`)
- `content/authoring.ts:452` (`editTranslatedLesson`)
- `backfill.ts:279` (`sweepLessonText`)

Two of those six are the reason this is a ticket and not a tidy-up:

- **`translate.ts:734` is dead for a blob-backed Lesson**, and the comment above it says
  so in its own words: a mutation cannot read a content blob, so `src.html` is
  `undefined` and the guard never fires. The rule that the *real* guard lives in the two
  callers that can read the blob is held **by that comment only**.
- **`translate.ts:694` declares `publishTranslation` a public `mutation`**, not an
  `internalMutation`, and `topics/_devanagari/publish.ts:89` is a shipping script that
  calls it directly. That is a live bypass of positional quiz scoring, not a theoretical
  one: `translate.ts:546-556` records 59 unchecked rows already shipped through it.

## Done when

The read-both-bodies-and-decide policy has **one** implementation returning a three-way
verdict (ok / mismatch / unreadable), every one of the six sites asks it, the dead branch
is **deleted rather than commented**, and `publishTranslation` is an `internalMutation` so
`publishTranslationChecked` is the only door. `topics/_devanagari/publish.ts` is repointed
at the checked action in the same change.

`pnpm typecheck` and `pnpm test` green.

**One test is rewritten, not kept.** `convex/translate.test.ts:372-398` currently asserts
the bypass as correct behaviour, so it pins the hole. Closing the door makes it fail by
construction; replace it with an assertion that the public path refuses.

**Not an ADR conflict.** ADR 0003 (immutable lessons) and ADR 0019 (quiz option shuffle)
both depend on this guard holding, so closing the door serves them. Nothing here reopens
either decision.

**Interaction with [24](24-split-translate-ts.md).** 24 is the mechanical split of
`translate.ts`, this is a behaviour change inside it. They are independent, but whichever
runs second rebases on the other; 24's discipline (moves never share a commit with
behaviour changes) means this ticket's change should be its own commit either way.

## Answer

2026-09-08, built. `convex/quizGate.ts` holds `quizStructureMatches` (the pure core) and
`quizVerdict` (the policy: ok / mismatch / unreadable), and all six call sites ask it.
The dead branch in `publishTranslation` is **deleted, not commented**, and the mutation is
an `internalMutation`, so `publishTranslationChecked` and `translateTopic` are the only
doors. The boundary is asserted on the source text rather than on `api`/`internal`, which
are lazy proxies that answer `in` for any name at all.

The test that pinned the bypass open was rewritten, as this ticket said it must be: it now
asserts the public door refuses the same body.

**Not done, and it could not be:** `topics/_devanagari/publish.ts` does not exist in this
checkout. `topics/` is gitignored, so there was nothing to repoint. Any materialised
workspace script calling the mutation directly must now use the checked action, which the
committed scripts already did.

Verified by test. `pnpm typecheck` and the full suite green.
