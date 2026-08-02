---
type: grilling
blocked_by: [02]
---
# The English the source never translated: repair it, flag it, or ship it?

> `/wayfinder .plan/maps/hindi-devanagari-edition/tickets/06-inherited-english-repair-flag-or-ship.md`

## Question

02 proved the conversion pass ships the source Edition's untranslated English rather than
repairing it, and that **asking it to repair in the same call does not work** — a prompt rule
ordering the repair fired on the `<title>` and nowhere else, in four runs out of four. Decide
what the spec does about it.

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
- **Repair, flag, or ship?** Shipping is honest and cheap and matches `hi-Latn`. Repairing
  makes the Devanagari Edition *better* than its source, which is a scope question, not just a
  technical one. Flagging (a report the owner can act on) is the middle path and costs nothing
  at conversion time.
- **If repair: a second targeted pass, or a table?** 02 rules out doing it in the conversion
  prompt.
- **Does the same defect belong upstream?** If these strings are English in every Edition,
  the real fix is in the English→X path and this effort should say so rather than paper over
  it here.

## Done when

A decision — repair, flag, or ship — with a counted basis, not an impression: the number of
untranslated-English strings across the Edition and whether they form a closed set. If repair,
the mechanism is named and it is not the conversion prompt. Says explicitly whether anything
is handed upstream to the English→X path as a separate concern.
