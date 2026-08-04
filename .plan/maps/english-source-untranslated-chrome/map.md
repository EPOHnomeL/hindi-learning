# The English the English→X path never translates

<!-- Charted 2026-08-04, handed over from
     [hindi-devanagari-edition/06](../hindi-devanagari-edition/tickets/06-inherited-english-repair-flag-or-ship.md).
     The map is an INDEX, not a store — each decision lives in its own ticket. -->

## Destination

A decision on whether the English→X translate path should be translating the strings it
currently leaves in English in **every** Edition — the recurring lesson chrome (`Check`,
`Glossary`, `Sources`, `Scripture`, `Teaching`, `Recap`, `Lesson N`), the `<footer>` citation
quotes, and the fill-in-the-blank answer keys — and if it should, where the fix goes: the
authored English lessons, the prompt in `translate.ts`, or the shared partials. Plan only;
this map does not fix it.

## Notes

**Plan only.** This map decides; nothing here ships a fix.

Why it exists: [hindi-devanagari-edition](../hindi-devanagari-edition/map.md) resolved on
2026-08-04 to repair these strings in its own Devanagari Edition, and doing that would have
quietly removed the evidence that the defect is upstream and affects all nine Editions. The
user chose to file it rather than let it disappear. **The Devanagari effort does not wait on
this one** — it repairs locally and ships.

Facts established there, so no ticket need re-derive them:

- Measured on the 57-item prophetic-school Edition: **13,531 Latin word-instances** in visible
  text — 49.7% in the `<footer>` "Sources — Scripture / Teaching" block, 46.8% in lesson
  prose/chrome, 3.6% in fill-in quiz fragments. Not a closed set: 1,120 of 1,646 distinct runs
  occur in one item only, and 349 runs are six words or longer.
- The strings originate in the **authored English lessons** (e.g.
  [lessons/0001-learning-to-listen.html](../../../topics/prophetic-school/lessons/0001-learning-to-listen.html)
  lines 307, 343, 347), so they are English in the shipped Editions because the translate run
  never touched them — not because the Editions are stale.
- The fill-in answer key staying Latin is **deliberate** at
  [convex/translate.ts:773](../../../convex/translate.ts#L773), not an oversight. Any decision
  here has to say whether that design still holds for non-Latin-script Editions.
- `norm()` at [lessons/_partials/foot.html:35](../../../lessons/_partials/foot.html#L35) does
  no Unicode normalization, which matters the moment any Edition holds a non-Latin answer key.

## Decisions so far

<!-- one line per resolved ticket -->

## Not yet specified

- **Whether this is one defect or three.** Chrome labels, footer citation quotes, and answer
  keys may each want a different verdict and a different fix site; the count says they differ
  by two orders of magnitude in volume. Sharpening that is [01](tickets/01-count-across-editions.md)'s job.
- **Who pays for a re-translate.** Fixing the source means the other eight Editions need
  re-running through the English→X path at real token cost, or they stay inconsistent with a
  fixed English. Nobody has priced that. clears-with: 01

## Out of scope

- **The Devanagari Edition's own repair.** Decided and owned by
  [hindi-devanagari-edition/06](../hindi-devanagari-edition/tickets/06-inherited-english-repair-flag-or-ship.md).
