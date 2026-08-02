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

**It holds.** Resolved 2026-08-02 by *running it* — four live `gemini-3.1-flash-lite` calls
over the real stored prod row for lesson `0001-learning-to-listen`, pulled through
`readEditionBodies`, not the eval packet. This is evidence, not inference; every number below
was measured.

Assets:

- [02-conversion-prompt.md](../assets/02-conversion-prompt.md) — the prompt verbatim, plus the
  call shape and the one rule in it that does **not** work.
- [02-lesson-0001.hi-Latn.source.html](../assets/02-lesson-0001.hi-Latn.source.html) — the input, the real row.
- [02-lesson-0001.hi.converted.html](../assets/02-lesson-0001.hi.converted.html) — the graded output.
- [02-convert-harness.ts](../assets/02-convert-harness.ts) — the measuring harness; the build should reuse its checks.

### 1. Orthography — good, and better than the source deserved

Every trap the ticket named came back right, unprompted by any per-word list: nukta
(`rozana` → रोज़ाना, `zaroorat` → ज़रूरत, `waqt` → वक़्त, `khilaaf` → ख़िलाफ़, `nazar-andaz` →
नज़र-अंदाज़), aspiration + nasalisation (`badhun` → बढ़ूँ, `pahunchne` → पहुँचने, `jaanch` → जाँच,
`lagaein` → लगाएँ), vowel length (`zaruri` → ज़रूरी, `shuruat` → शुरुआत). It also *repaired*
misspellings in the romanization rather than transliterating them faithfully: `sanchep` →
संक्षेप, `nichae` → नीचे, `thae` → थे, `dhyan lgaein` → ध्यान लगाएँ, `1 yuhanaa` → 1 यूहन्ना, and
`Luka (luke) 11:13` → लूका (Luke) 11:13. Nothing in the file reads as misspelt Devanagari.

### 2. Register — naturalized as asked, with one real caveat

The register call the map made is what happened. `Lesson 1 · …` → पाठ 1 · …, `tareeqa` →
तरीका, `pathyakram` → पाठ्यक्रम, `parakh` → परख. It neither transliterated letter-for-letter
nor drifted into re-translation: read the paragraphs side by side and the sentences say what
they said. (`Sabak` does not occur in this lesson, so that exact example is untested; the
equivalent — English `Lesson` → पाठ — is.)

The caveat is **scripture-snapping**. The source's John 16:13 reads `jo kuch sunega wahi
karega` — "whatever he hears, that he will *do*", a slip. The output reads `जो कुछ सुनेगा वही
कहेगा` — "…that he will *speak*", the canonical Hindi Bible wording. That is a meaning change
the prompt forbade, and it happened anyway because the model recognised the verse. Here it
improved the text. It is still the failure mode to watch: on scripture the model will reach
for what it remembers over what it was given. The quality gate (04) should read the verse
blocks specifically.

One infelicity: the label `Zariya :` (source) → `ज़रिए :` — an oblique form where ज़रिया was
wanted. Cosmetic, one occurrence.

### 3. Markup — the whole document survives. Chunk = one whole lesson.

This is the strongest result and it settles the feeding strategy: **feed one entire
`swapOutStatic`-stripped lesson per call, no sectioning.** 4 runs out of 4:

| check | result |
| --- | --- |
| tag sequence (402 openers/closers, in order) | 402 = 402, identical, every run |
| text nodes / non-empty text nodes | 434 = 434 / 172 = 172, every run |
| `id` / `class` / `href` / `data-correct` / `data-answer` / `data-k` counts | no drift, every run |
| `<!--⟦N⟧-->` static placeholders | both reproduced exactly once, every run |
| `quizStructureMatches(stripped, out)` | true, every run |
| `swapBackStatic(out, blocks)` | non-null, every run |
| `§` and `•` markers | preserved, every run |

The only instability found in 4 runs: one run dropped 10 of 32 `&nbsp;` entities (the other
three kept all 32). Cosmetic spacing, not structural — but it is the reason the build should
still run the guards per item rather than trusting the model, and 01 already requires that.

Attribute *values* are translated where they hold prose — the quiz `data-ok` / `data-no`
feedback strings come back in Devanagari while `data-correct="a"` stays `a`. That is correct
behaviour, and it means the naive "attributes must be byte-identical" check is the wrong
guard; use the counts above.

Measured, so the build can plan: **7,210 in / 5,943 out tokens, `thoughts=0`, ~15 s** for one
lesson. Scaled to 57 lesson-equivalents that is ~411 K in / ~339 K out → **$0.61 for the
whole Edition** at 0.25→1.50, tightening 01's ~$1. ~14 min serial, ~2 min at 8-way.

### 4. Leaks — the source's English survives, and the prompt cannot talk it out

No invented content, no Latin-script Hindi left unconverted. Every Latin word remaining in
the body is one of: a deliberate parenthetical gloss the prompt was told to keep
(`(new covenant)`, `(skill)`, `(recap)`, `(repent)`, `(prompting)`, `(circumstances)`), a
scripture book name (`John`, `Luke`), or — the finding — **English the source Edition never
translated**.

Rule 3 of the prompt explicitly ordered those repaired. It obeyed exactly once, on the
`<title>`. It left all of these English in all four runs:

- `<button>Check</button>` (the quiz submit label)
- `Sources — Scripture: John 16:13; Luke 11:13; 1 John 4:1–2 …` (the whole footer line)
- `<a …>Glossary</a>` link text
- `<h3>Lesson 2 ke liye tayyar</h3>` → `<h3>Lesson 2 के लिए तैयार</h3>` — half-converted
- the two `Source: Vorster, Holy Spirit Course …` citations, incl. `"Ways God can speak"`

**These are genuine source defects, not chrome.** All three of `Check`, `Sources — Scripture`
and `Glossary` are authored English text in
`topics/prophetic-school/lessons/0001-learning-to-listen.html` (lines 307, 343, 347) that the
original English→hi-Latn translate run failed to translate — so they are equally English in
the shipped hi-Latn Edition today, and the conversion pass faithfully carried them across.

So the fog patch's question answers itself for the *conversion* pass: **it ships them.**
Asking it to repair them in the same breath as converting does not work, and the spec should
either drop rule 3 or make repair a separate, targeted pass over a known list of strings.
That is a real call and it is now sharp enough to be its own ticket — see 06.

### A stale claim in 01, corrected

01's Answer and the map's fog patch both list `"naye vachisth (new covenant)"` as an
inherited defect of the shipped `hi-Latn`. **It is not in the shipped Edition.** The stored
prod row reads `nayi vacha (new covenant)` — ordinary, correct Hindi (वाचा = covenant), and
it converted cleanly to नयी वाचा. `naye vachisth` exists only in
`topics/prophetic-school/eval/gemini/hi-Latn.html`, the trial artifact; prod diverged from it
after the trial. Corrected on the map and noted on 01 on 2026-08-02. The lesson generalises:
**the eval packet is not the Edition** — grade against `readEditionBodies`, not `eval/`.

### Verdict

The approach holds on `gemini-3.1-flash-lite` at whole-lesson granularity. No better model is
needed for the proof. Two things the spec must carry forward that this run exposed: the
scripture-snapping risk (watch it, don't try to prompt it away), and the fact that inherited
English is shipped, not repaired.
