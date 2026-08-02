---
type: grilling
blocked_by: [02]
---
# The English the source never translated: repair it, flag it, or ship it?

> `/wayfinder .plan/maps/hindi-devanagari-edition/tickets/06-inherited-english-repair-flag-or-ship.md`

## Question

02 showed the source Edition carries untranslated English that a conversion pass inherits.
**Whether it can be repaired is settled: it can.** The Claude Code conversion repaired all of
it in the same pass at no extra cost (`Check` → जाँचें, `Sources — Scripture:` → स्रोत —
पवित्रशास्त्र:, `Glossary` → शब्दावली, `Lesson 2` → पाठ 2), while correctly leaving author names
and cited-work titles in Latin. `gemini-3.1-flash-lite` could not — it obeyed the same
instruction once, on the `<title>`, in four runs out of four — but Gemini is no longer the
converter.

So what is left is not "is repair possible" but **"is repair in scope, and is this the right
place for it"**. Decide what the spec does.

The strings are authored English in the *English* lesson that the original English→hi-Latn
run failed to translate, so they are English in the shipped `hi-Latn` Edition today. In lesson
1 they are: the `<button>Check</button>` quiz label, the `Sources — Scripture: …` footer line,
the `Glossary` link text, the `Lesson 2 ke liye tayyar` heading, and the two
`Source: Vorster, Holy Spirit Course …` citations. See 02's Answer for the graded detail and
`topics/prophetic-school/lessons/0001-learning-to-listen.html` lines 307, 343, 347 for the
origin.

- **How many are there across all 56 lessons, and are they a small closed set?** Lesson 1
  suggests most are the same handful of repeated chrome strings (`Check`, `Sources`,
  `Glossary`, `Lesson N`) plus per-lesson citations. If the set is closed and small, a
  find-and-replace table beats anything AI-shaped. Count them before deciding — this is the
  one thing that most changes the answer.
- **Repair, flag, or ship?** Shipping is honest and matches `hi-Latn`. Repairing makes the
  Devanagari Edition *better* than its source — a scope question, not a technical one, and the
  one thing 02 could not decide on its own. Flagging (a report the owner can act on) is the
  middle path. Note the asymmetry repair creates: the Devanagari Edition would be the only one
  of the nine without these holes.
- **Does the same defect belong upstream?** These strings are English in every Edition, so the
  real fix is arguably in the English→X path — and if it is, repairing here quietly hides the
  evidence that would motivate fixing it there. Say whether this effort hands it upstream.
- **The fill-in answer key is the sharp edge of the same question.** Quiz 4's `data-answer`
  stays `peace` in Latin by deliberate upstream design
  ([convex/translate.ts:773](../../../convex/translate.ts#L773), compared at
  [lessons/_partials/foot.html:36](../../../lessons/_partials/foot.html#L36)), so a Devanagari
  reader must type an English word to pass it. 02 preserved it rather than decide unilaterally.
  Repairing *that* is not cosmetic — it changes what the learner does — so decide it here.

## Done when

A decision — repair, flag, or ship — with a counted basis, not an impression: the number of
untranslated-English strings across the Edition and whether they form a closed set. Settles
quiz 4's `data-answer` explicitly, since that one changes what the learner has to type. Says
whether anything is handed upstream to the English→X path as a separate concern.
