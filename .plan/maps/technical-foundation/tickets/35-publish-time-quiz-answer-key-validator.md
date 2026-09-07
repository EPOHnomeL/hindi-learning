---
type: task
blocked_by: []
---
# A publish-time validator for an answer key that names no option

## Question

[02](02-lesson-quiz-architecture.md) decided that the quiz stays authored HTML and the
**server never scores** ([ADR 0035](../../../../docs/adr/0035-lesson-iframe-is-a-permanent-boundary.md)).
That is the right call, and it has one edge: with no scoring downstream, **nothing in
the pipeline ever evaluates the answer key**, so an authored `.quiz[data-correct="d"]`
whose options are only `data-k="a|b|c"` publishes cleanly and stays wrong forever.

What that costs the learner: every option is marked wrong, no option is ever
highlighted as correct, and `QUIZ_BRIDGE` posts `correct:false` for whatever they
picked — so the teaching loop is told the learner failed a question that could not be
passed. Lessons are immutable (ADR 0003), so it cannot be repaired in place; it needs
a republish.

**The existing guard cannot see this.** `quizStructureMatches`
(`convex/translate.ts:1060`) compares the *counts* of `data-correct=`, `data-answer=`
and `data-k=` between a source and its translation. It is a drift check between two
documents, not a validity check on one, and an orphaned key has identical counts on
both sides.

**Verified 2026-09-07, and the news is good:** a scan of all 735 authored HTML files in
the tree found **2069 multiple-choice quizzes and zero real orphans** (the single hit
was `lessons/_template.html`, whose placeholder is literally `data-k="a|b|c"`). So this
is prophylactic, not a live defect — which is exactly why it is a small ticket and not
an urgent one. Prod was not scanned; the local corpus is the authored source of the
published lessons.

## What to build

A publish-time refusal: a lesson whose `.quiz[data-correct="X"]` has options but none
with `data-k="X"` is rejected, with an error naming the quiz and the missing key.

Constraints worth honouring:

- **One door.** [26](26-one-publish-door-for-the-quiz-guard.md) exists because a
  shipping script bypasses the quiz-structure guard. Do not add a second bypassable
  check — if 26 has landed, this belongs behind the same door; if it has not, put this
  where 26 will pick it up rather than where it is convenient.
- **`.quiz.fill` has no options** and is not in scope: its key is `data-answer`, which
  is free text and cannot be orphaned.
- **Shuffle runs at publish** (ADR 0019), which rewrites `data-k` values. Validate on
  whichever side of the shuffle keeps the check meaningful, and say in the code which
  side you chose and why.
- Refuse, do not repair. There is no safe automatic answer.

## Done when

A lesson with an orphaned `data-correct` is refused at publish with a message naming
the quiz, a test proves the refusal (and proves it can fail), and the existing 2069
authored quizzes still publish.

<!-- Filed 2026-09-07 out of the answer to 02. -->
