---
type: task
blocked_by: [01]
---
# The green ask block disappears from the lesson

## Question

A learner reads a lesson on a course whose owner has turned Teacher Q&A off. The green
"ask your teacher" block at the foot of the lesson is not there. The lesson's `<footer>` and its
source citations are untouched, as are its quizzes, recap and every other component. The owner turns
the setting back on and the block returns on every lesson, including ones authored while it was off.

The block lives inside each **Lesson**'s stored HTML, and Lessons are **immutable**. This ticket
does not rewrite them. Every lesson iframe on every reader path (the owner's reader, the public
reader for a **Guest**, and a paid **Preview**) is built by one function in the lesson source
document module, which already injects conditional CSS for other purposes. Hiding is a rule injected
there. That single seam is why this ticket is small, and it is what keeps the setting instantly
reversible.

The owner's in place lesson editor is built by a **second** function in the same module and must
receive the same treatment, so that what the owner edits matches what a learner sees. Both builders,
not one.

Consume the boolean by the route ticket 01 established. Do not re-decide it.

A concern that looked like a blocker and is not: the block in the motivating course carries a
"Main source for this week's reading" citation as well as the invitation. That citation is redundant
with the `<footer>` `Sources` line directly below it, which carries the fuller attribution. Nothing
is lost. Do not try to preserve half the block.

## Done when

- Both the reader's document builder and the in place editor's document builder accept the setting
  and, when it is off, emit a rule that hides the ask block.
- With the setting on, the output carries no such rule, and behaviour is identical to today.
- The lesson body itself is unchanged in both cases. Assert this directly: it is the immutability
  guarantee, and it is the reason no backfill exists.
- Tests live beside the existing tests for that module, following their prior art for theme,
  direction and injection.
- Walked in a browser on a real lesson: with the setting off there is no green block, with it on the
  block is back, and the footer citation is present either way.
- Both light and dark themes are correct, which they should be for free, since hiding is a display
  rule rather than a colour change.
- No stored Lesson HTML is modified anywhere, and no backfill or migration is written.
- `pnpm typecheck` is green.
