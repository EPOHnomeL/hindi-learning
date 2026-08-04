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

## Answer

**Repair — all three classes, including the answer keys.** Decided with the user on 2026-08-04
against a count taken from the already-converted output.

### The counted basis, and why the question had to be re-framed to get one

The ticket asked for the count "across all 56 lessons" of the *source*. **That count cannot be
taken.** The `hi-Latn` source is romanized Hindi, so it is Latin script from end to end — 17,424
distinct Latin runs in its stripped text — and untranslated English is indistinguishable from
translated Hinglish by script alone. English only becomes *visible* once the surrounding text is
Devanagari. So the measurement was taken on `topics/_devanagari/converted/` instead, where every
Latin island stands out, and spot-checked back to `stripped/` to confirm inheritance rather than
introduction (two long quotes verified present in the source: lessons 0036, 0044).

Counting visible text only — markup, attributes and `⟦N⟧` static placeholders excluded, so the
deliberately-Latin `data-answer`/`href`/`class` don't pollute it — **13,531 Latin word-instances
remain across the 57 converted HTML items**, in 1,646 distinct runs. Partitioned by where they sit:

| Where | Latin words | Share | Items affected |
|---|---|---|---|
| `<footer>` "Sources — Scripture / Teaching" citation block | 6,720 | 49.7% | 57 of 57 |
| Fill-in-the-blank quiz quote fragments | 482 | 3.6% | 51 of 57 |
| Lesson prose and chrome | 6,329 | 46.8% | 57 of 57 |

**It is not a small closed set, and the ticket's lesson-1 hypothesis was wrong at Edition scale.**
1,120 of the 1,646 runs occur in exactly one file, and 349 distinct runs are six words or longer —
whole English sentences, not chrome labels. A find-and-replace table cannot do this job; it is a
second AI pass. What *is* closed is the recurring-chrome subset — roughly 25 strings carrying the
high frequencies (`Glossary` 39, `Sources` 33, `Scripture` 33, `Teaching` 30, `Check` 21, `Recap`
10, `Application`/`Description`/`Fulfillment`/`Interpretation` 9 each, `Lesson N`, `min`, `entries`,
`journal`, `feedback`, `uploaded resources`, `Source`) — and a table *would* handle those, but it
would leave 90% of the volume standing.

**The conversion pass repaired this unevenly.** 02 reported that the harness repaired all inherited
English in lesson 1 "at no extra cost", and that is true of lesson 1 — but the run fanned out one
subagent per lesson and they did not agree: `Glossary` survives in 39 of 57 items, `Check` in 21.
Uniform repair therefore cannot be assumed from 02's single-lesson evidence; it has to be a
specified, checked step.

### The three decisions

1. **Footer citations — translate the quoted English too** (the 49.7%). Author names, organisation
   names and cited-work titles stay Latin (`Kris Vallotton`, `Wikus Vorster`, `YWAM Potchefstroom`,
   *Basic Training for Prophetic Ministry*, *Walking in Power*); the quoted sentences and the labels
   around them become Devanagari. The cost accepted knowingly: the quote is then *our* translation
   of a published English line, no longer verbatim. Chosen because a Devanagari-only reader
   otherwise cannot read half of every lesson's footer, which is teaching content, not apparatus.
2. **Lesson prose and chrome — repair** (the 46.8%), same rule: proper nouns and work titles stay
   Latin, everything else converts. `L<N>` cross-reference tags (`L1`, `L15`, …) convert to the
   Devanagari lesson label form used elsewhere in the item.
3. **Quiz fill-ins — convert the quote *and* the answer key** (the 3.6%), so a Devanagari reader
   types Devanagari. This is the one decision that changes what the learner *does*, and it
   deliberately departs from upstream: `data-answer` stays Latin by design at
   [translate.ts:773](../../../convex/translate.ts#L773). Two consequences the build session
   inherits, both real:
   - **02's carry-forward "`data-answer`/`data-alt` must stay Latin or quiz 4 breaks" is now
     superseded.** It is not a technical constraint. `norm()` at
     [lessons/_partials/foot.html:35](../../../lessons/_partials/foot.html#L35) is
     `replace(/\s+/g,' ').trim().toLowerCase()`, and `toLowerCase()` is a no-op on Devanagari, so
     the comparison is a plain string equality that works fine in either script.
   - **But `norm()` never calls `.normalize()`, and that *is* a blocker.** The converted output is
     already NFC (0 of 57 files differ under NFC) — and for Devanagari NFC means nukta consonants
     stay **decomposed**, because the precomposed forms (क़ ख़ ग़ ज़ ड़ ढ़ फ़) are Unicode composition
     exclusions. There are **4,513 decomposed nukta sequences** in the converted output. A learner
     whose IME emits precomposed ड़ (U+095C) would fail an answer key stored as U+0921 U+093C
     despite typing the visually identical word. So converting answer keys requires **either** a
     one-line `.normalize('NFC')` added to `norm()` in `foot.html` — shared authored chrome, so it
     touches all nine Editions — **or** answer keys chosen to contain no nukta consonant. Prefer
     the `normalize` fix; it is strictly a robustness improvement for every Edition.

### Handed upstream

**Filed as a separate effort:** [The English the English→X path never translates](../../english-source-untranslated-chrome/map.md).
These strings are English in all nine Editions, so the defect is in the English→X pipeline, not in
this conversion; repairing only here would remove the evidence that motivates fixing it there. This
effort still repairs its own Edition — it does not wait on that one.

### Carry-forwards for the rest of this map

- **03 (write path):** the repair is a second pass over the 57 already-converted files, so the disk
  layout needs a `repaired/` stage between `converted/` and publish, and the resume logic keys off
  it. Nothing publishes pre-repair.
- **04 (quality gate):** the mechanical check list gains "no Latin-script run in visible text
  outside the proper-noun whitelist", which is now a *measurable* gate with a baseline of 13,531 —
  and **loses** `data-answer`/`data-alt` byte-identity, which the answer-key decision invalidates.
  `check.ts`'s quiz guard must be rewritten to assert *round-trip answerability* (key matches
  `data-alt` under `norm()`) rather than byte-identity, or all 57 items will fail a check that is
  now testing the wrong thing.
- The whitelist of keep-Latin proper nouns is itself a deliverable of the repair pass, not an
  afterthought: ~12 names and work titles carry most of the legitimately-Latin volume.
