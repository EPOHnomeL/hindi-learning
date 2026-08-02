---
type: prototype
blocked_by: [01]
---
# Does a naturalizing conversion prompt actually hold up on a real lesson?

> `/wayfinder .plan/maps/hindi-devanagari-edition/tickets/02-does-naturalizing-conversion-hold.md`

## Question

The whole effort rests on an unproven claim: that a cheap model, told to convert script and
naturalize register *without* re-translating, produces Devanagari good enough to read. Prove
or break it on real content before anything else is designed.

Take one whole prophetic-school lesson's `hi-Latn` HTML — the real stored row, markup and
all, not the eval packet's flattened prose — and run it through the model 01 recommends. Then
look at four things:

1. **Orthography.** Are the Devanagari spellings right where the romanization was ambiguous?
   The known traps: retroflex vs dental (`t/d/n`), vowel length (`i/ee`, `u/oo`), missing
   aspiration, and nukta (`jad` → जड़, `badh` → बढ़).
2. **Register.** Did it naturalize as asked — पाठ for `Sabak` — or did it either transliterate
   letter-for-letter, or drift into re-translating and change the meaning? Both failures matter
   and they fail in opposite directions.
3. **Markup survival.** Does the HTML come back intact — tags, attributes, `id`s, anchors, the
   lesson's structural classes? Establish the largest chunk that survives reliably: whole
   document, per-section, or per-block. This decides the script's feeding strategy, so answer
   it here rather than leaving it to the build.
4. **Leaks.** Any English left standing, any Latin-script Hindi left unconverted, any
   invented content. Note in particular what it does with the John 16:13 block that `hi-Latn`
   left in English — that is the fog patch on the map.

## Done when

A converted lesson exists as an asset under `assets/`, with a written verdict on each of the
four axes and a recommended chunk size. States plainly whether the approach holds, needs a
better model, or fails — and if it holds, the prompt that made it hold is captured verbatim
for the spec.

## Answer

**It holds — and the converter is this Claude Code harness, not an API model.** Resolved
2026-08-02 by running the conversion twice over the same input: once on
`gemini-3.1-flash-lite` (four calls), then again by the Claude Code session itself after the
user ruled Gemini out on cost. Both were graded by the same checks against the real stored
prod row for lesson `0001-learning-to-listen`, pulled through `readEditionBodies` — not the
eval packet. Every number below was measured.

**The Claude Code conversion is the recommendation.** It beat the API run on every axis and
costs nothing per Edition, which is what the user asked for.

Assets:

- [02-conversion-prompt.md](../assets/02-conversion-prompt.md) — the instructions verbatim, plus the two amendments the run established.
- [02-lesson-0001.hi-Latn.source.html](../assets/02-lesson-0001.hi-Latn.source.html) — the input, the real row.
- [02-lesson-0001.hi.converted-by-claude-code.html](../assets/02-lesson-0001.hi.converted-by-claude-code.html) — **the graded output, and the one to build from.**
- [02-lesson-0001.hi.converted-by-gemini.html](../assets/02-lesson-0001.hi.converted-by-gemini.html) — the recorded comparison.
- [02-split-harness.ts](../assets/02-split-harness.ts) + [02-check-harness.ts](../assets/02-check-harness.ts) — strip-and-grade, no API; **the build reuses these per item.**
- [02-gemini-convert-harness.ts](../assets/02-gemini-convert-harness.ts) — the API harness, kept as the record of the comparison run.

### Head to head, same input, same checks

| | Claude Code (pick) | `gemini-3.1-flash-lite` |
| --- | --- | --- |
| tag sequence (402) | 402 = 402 | 402 = 402, 4/4 runs |
| text nodes (436) / non-empty (172) | 436 / 172 | 436 / 172, 4/4 runs |
| `class` 84 · `data-k` 9 · `href` 4 · `data-correct` 3 · `<mark>` 4 | all exact | all exact |
| `&nbsp;` (32) | 32 | 32 in 3 runs, **22 in one** |
| `§` 4 · `•` 1 · placeholders 2 | all exact | all exact |
| `quizStructureMatches` / `swapBackStatic` | pass / ok | pass / ok, 4/4 |
| rule 3 — repair the source's English | **all of it repaired** | obeyed once, on `<title>`, 4/4 |
| API cost per Edition | **$0** | ~$0.61 measured |

The one structural instability found anywhere — a run that dropped 10 of 32 `&nbsp;` — was
Gemini's. The Claude Code conversion had none.

### 1. Orthography — good, and better than the source deserved

Every trap the ticket named came back right, unprompted by any per-word list: nukta
(`rozana` → रोज़ाना, `zaroorat` → ज़रूरत, `waqt` → वक़्त, `khilaaf` → ख़िलाफ़, `nazar-andaz` →
नज़र-अंदाज़), aspiration + nasalisation (`badhun` → बढ़ूँ, `pahunchne` → पहुँचने, `jaanch` → जाँच,
`lagaein` → लगाएँ), vowel length (`zaruri` → ज़रूरी, `shuruat` → शुरुआत). It also *repaired*
misspellings in the romanization rather than transliterating them faithfully: `sanchep` →
संक्षेप, `nichae` → नीचे, `thae` → थे, `dhyan lgaein` → ध्यान लगाएँ, `1 yuhanaa` → 1 यूहन्ना, and
`Luka (luke) 11:13` → लूका (Luke) 11:13. Nothing in the file reads as misspelt Devanagari.

### 2. Register — naturalized as asked. Scripture snapping is *intended*, not drift.

The register call the map made is what happened, in both runs. `Lesson 1 · …` → पाठ 1 · …,
`tareeqa` → तरीका, `pathyakram` → पाठ्यक्रम, `parakh` → परख. Neither run transliterated
letter-for-letter, and neither drifted into re-translation — read the paragraphs side by side
and the sentences say what they said. (`Sabak` does not occur in this lesson, so the map's
exact example is untested; the equivalent — English `Lesson` → पाठ — is.)

**Correction to my own first reading.** I flagged scripture-snapping as a risk after the
Gemini run: the source's John 16:13 reads `wahi karega` ("that he will *do*"), a slip, and the
output read वही कहेगा ("that he will *speak*"), the published Hindi wording. On checking the
repo before repeating it, that is the **stated intent** of this project's translate path, not
a failure — [convex/translate.ts:773](../../../../convex/translate.ts#L773) instructs the run
to "substitute the exact wording of a widely-used published Hindi Bible (Bible Society of
India / HHBD Devanagari text) VERBATIM … so the learner meets Scripture in its familiar
published form". The Claude Code conversion therefore snaps deliberately, on all four verses
(John 16:13, Luke 11:13, John 3:16, 1 John 4:1–2), and the instruction set has been amended to
say so instead of forbidding it. 04's gate should check the verses **match** the published
text, not that they match the romanized source.

One infelicity in the Gemini run, absent from the Claude Code one: `Zariya :` → `ज़रिए :`, an
oblique form where ज़रिया was wanted.

### 3. Markup — the whole document survives. Chunk = one whole lesson.

This settles the feeding strategy: **one entire `swapOutStatic`-stripped lesson per
conversion, no sectioning.** The Claude Code conversion is exact on every counted property —
402/402 tags in order, 436/436 text nodes, 172/172 non-empty, `class` 84, `data-k` 9, `href`
4, `data-correct` 3, `data-answer` 1, `data-alt` 1, `<mark>` 4, `&nbsp;` 32, `§` 4, `•` 1,
both `<!--⟦N⟧-->` placeholders once each; `quizStructureMatches` true and `swapBackStatic`
non-null (31,033 chars restored). See the head-to-head table above for Gemini's numbers.

Attribute *values* are converted where they hold prose — the quiz `data-ok` / `data-no`
feedback strings come back in Devanagari while `data-correct="a"` stays `a`. That is correct,
and it means "attributes must be byte-identical" is the wrong guard; use the counts.

**Except `data-answer` / `data-alt`, which must stay Latin.** Quiz 4 is a fill-in;
[lessons/_partials/foot.html:36](../../../../lessons/_partials/foot.html#L36) compares the
learner's typed string to those two attributes, and translate.ts:773 deliberately keeps such
answers in the source language. So `peace`/`Peace` and the `p‑e‑a‑c‑e` hint are preserved
verbatim while the sentence around them converts. Whether a Devanagari reader should be typing
a Latin word at all is a real question — it goes to 06, not to the conversion.

Throughput, which is now the binding cost instead of dollars: one lesson is ~20.5 K chars in
and ~19 K out. There are 59 items. That is a few hours of agent sessions rather than the
~2 minutes an 8-way API fan-out would take. The trade is deliberate and it is the honest risk
in this approach — 03 has to say how the run is split and resumed.

### 4. Leaks — repaired here, shipped by Gemini

No invented content and no Latin-script Hindi left unconverted in either run. The difference
is what happened to the English the *source Edition* never translated:
`<button>Check</button>`, the `Sources — Scripture: …` footer, the `Glossary` link text, the
`Lesson 2 ke liye tayyar` heading and the two `Source: Vorster, …` citations. These are
genuine source defects — authored English at
`topics/prophetic-school/lessons/0001-learning-to-listen.html` lines 307, 343, 347 that the
original English→hi-Latn run failed to translate, so they are English in the shipped hi-Latn
Edition today.

- **Claude Code repaired all of them** — जाँचें, स्रोत — पवित्रशास्त्र:, शब्दावली, पाठ 2, स्रोत:,
  अध्याय, पृ. — while correctly leaving author names and cited-work titles (`Wikus Vorster`,
  *Holy Spirit Course*, `"Ways God can speak"`, `YWAM Potchefstroom`) in Latin, which
  translate.ts:773 explicitly requires.
- **Gemini repaired one**, the `<title>`, and shipped the rest in 4 runs out of 4.

Everything Latin still standing in the Claude Code output is deliberate: parenthetical glosses
the source itself carries (`(new covenant)`, `(skill)`, `(recap)`, `(repent)`,
`(circumstances)`), scripture book names (`John`, `Luke`), proper nouns and work titles, and
the fill-in answer key.

This mostly answers 06's question before 06 is worked — repair *is* achievable, in the same
pass, at no extra cost — but 06 still has to settle whether repairing is in scope at all (it
makes the Devanagari Edition better than its source), and whether the same defect should be
handed upstream to the English→X path. 06 has been narrowed accordingly rather than closed.

### A stale claim in 01, corrected

01's Answer and the map's fog patch both list `"naye vachisth (new covenant)"` as an
inherited defect of the shipped `hi-Latn`. **It is not in the shipped Edition.** The stored
prod row reads `nayi vacha (new covenant)` — ordinary, correct Hindi (वाचा = covenant), and
it converted cleanly to नयी वाचा. `naye vachisth` exists only in
`topics/prophetic-school/eval/gemini/hi-Latn.html`, the trial artifact; prod diverged from it
after the trial. Corrected on the map and noted on 01 on 2026-08-02. The lesson generalises:
**the eval packet is not the Edition** — grade against `readEditionBodies`, not `eval/`.

### Verdict

The approach holds, at whole-lesson granularity, with **the Claude Code session as the
converter** — no API model, no per-Edition cost, and a cleaner result than the API run on
every axis measured. `gemini-3.1-flash-lite` also holds and is recorded as the fallback if
throughput ever beats cost; it is not the pick, because the user ruled paid API calls out on
2026-08-02 and the free path also happens to be better here.

Three things the spec must carry forward:

1. **Scripture is snapped to the published HHBD wording deliberately** (translate.ts:773), so
   04's gate checks verses against the published text, not against the romanized source.
2. **`data-answer` / `data-alt` stay Latin** or quiz 4 stops working; every other attribute
   holding prose converts.
3. **Throughput replaced dollars as the cost.** 59 items × ~20 K chars is agent-session work,
   not a two-minute fan-out. 03 must say how the run is split, checkpointed and resumed.

<!-- Superseded reading: this ticket first resolved on 2026-08-02 recommending
     gemini-3.1-flash-lite at ~$0.61/Edition. The user ruled out paid API calls the same day;
     the conversion was re-run by the Claude Code harness and re-graded by the same checks,
     and the Answer above rewritten around that result. The Gemini numbers are kept because
     they are the only measured comparison anyone has, not because they are the plan. -->

<!-- Evidence, stated plainly (CLAUDE.md: say which you had). Both conversions were RUN, and
     graded mechanically by the harnesses linked above. The orthography and register verdicts
     are a careful side-by-side reading of source vs output, not a native speaker's review and
     not a browser walk-through — nothing here has been rendered in the reader. That is 04's
     job, and the fact that nobody on this project necessarily reads Devanagari is a live
     constraint 04 already names. -->

