# The conversion instructions — verbatim, as run on 2026-08-02

The **converter is the Claude Code session itself**, not an API model (decided 2026-08-02;
see 01's superseding answer). So this is not a system prompt sent over the wire — it is the
instruction set the converting session follows, and it is reproduced verbatim because both the
Gemini run and the Claude Code run were graded against *this* string and no other.

It produced [02-lesson-0001.hi.converted-by-claude-code.html](02-lesson-0001.hi.converted-by-claude-code.html)
from [02-lesson-0001.hi-Latn.source.html](02-lesson-0001.hi-Latn.source.html), and — as a
recorded comparison — [02-lesson-0001.hi.converted-by-gemini.html](02-lesson-0001.hi.converted-by-gemini.html).

```text
You convert a Hindi lesson document from informal romanized Hindi (Hinglish, Latin script) into Devanagari.

This is a SCRIPT CONVERSION, not a translation. The Hindi is already written — you are rewriting it in the script it belongs in.

Rules:
1. Every Hindi word in Latin script becomes correct, correctly-spelled Devanagari. The romanization is informal and lossy, so you must restore what it dropped: dental vs retroflex consonants, aspiration, vowel length, nasalisation (anusvara/chandrabindu), and nukta (jad -> जड़, badh -> बढ़, zaroori -> ज़रूरी).
2. Naturalize the register while you convert. Where the romanized text uses a colloquial or Urdu-leaning word because it was written to be spoken, prefer the word a Devanagari-reading Hindi speaker expects: "Sabak" -> पाठ, "tareeqa" -> तरीका, "intezar" -> प्रतीक्षा where the surrounding prose is formal. Do not change the MEANING of any sentence, do not add or remove information, and do not re-translate from scratch — the sentence that comes back must say exactly what the sentence going in said.
3. Any English prose or English UI label left standing in the body is a defect of the source. Render it in natural Hindi too. Two exceptions: keep an English word that is deliberately glossed in parentheses — e.g. "tauba (repent)" becomes "तौबा (repent)" — and keep proper nouns that are conventionally written in Latin script in this document.
4. Scripture references keep their numerals and book names in the form the source used.
5. THE HTML IS SACRED. Return the same document with only the human-readable text changed. Do not add, remove, reorder, merge or split a single element. Every tag, attribute, attribute VALUE (id, class, data-correct, data-answer, data-k, href, aria-*), comment and whitespace-significant structure must come back byte-identical. Placeholder comments of the form <!--⟦N⟧--> are opaque markers: reproduce each exactly once, in place.
6. Return the document and nothing else. No markdown fence, no preamble, no commentary.
```

Two amendments the Claude Code run established, which the spec should fold into the text
above rather than leave as footnotes:

- **Scripture is snapped to the published Hindi Bible, deliberately.** Rule 2 forbids meaning
  changes, but [convex/translate.ts:773](../../../../convex/translate.ts#L773) — the prompt
  that produced every shipped Edition — already instructs the run to "substitute the exact
  wording of a widely-used published Hindi Bible (Bible Society of India / HHBD Devanagari
  text) VERBATIM". Conversion inherits that intent: where the romanized verse drifted from
  the published wording, the converted verse is snapped back to it. This is why `wahi karega`
  became वही कहेगा and not वही करेगा. Say so in rule 4 rather than letting rule 2 forbid it.
- **`data-answer` / `data-alt` stay in Latin.** Quiz 4 is a fill-in whose answer the learner
  types; [lessons/_partials/foot.html:36](../../../../lessons/_partials/foot.html#L36) compares
  the typed string to those two attributes, and translate.ts:773 deliberately keeps such
  answers in the source language. The prose around it converts; `peace`/`Peace` and the
  `p‑e‑a‑c‑e` hint do not. Whether that is right *for a Devanagari reader* is a live question —
  it belongs to ticket 06, not to the conversion.

## Rule 3 works here — and did not on Gemini

Rule 3 (repair the English the source Edition never translated) is the one rule that separates
the two runs. The Claude Code conversion repaired all of it — `Check` → जाँचें, `Sources —
Scripture:` → स्रोत — पवित्रशास्त्र:, `Glossary` → शब्दावली, `Lesson 2` → पाठ 2, `Source:` →
स्रोत:, `chapter` → अध्याय, `p.` → पृ. — while correctly leaving author names and cited work
titles (`Wikus Vorster`, *Holy Spirit Course*, "Ways God can speak") in Latin, as
translate.ts:773 requires. `gemini-3.1-flash-lite` obeyed rule 3 exactly once, on the
`<title>`, in four runs out of four.
