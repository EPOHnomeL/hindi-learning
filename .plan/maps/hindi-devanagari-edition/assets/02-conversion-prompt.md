# The conversion prompt — verbatim, as run on 2026-08-02

This is the exact system prompt that produced
[02-lesson-0001.hi.converted.html](02-lesson-0001.hi.converted.html) from
[02-lesson-0001.hi-Latn.source.html](02-lesson-0001.hi-Latn.source.html) on
`gemini-3.1-flash-lite` via `geminiComplete`. The user turn is the whole
`swapOutStatic`-stripped lesson document and nothing else. Copy it into the spec unchanged
unless the change is argued for — every claim in ticket 02's Answer is a claim about *this*
string.

Note the placeholder wording in rule 5 says `<!--[N]-->` while `swapOutStatic` actually emits
`<!--⟦N⟧-->`. That mismatch was in the graded run and the placeholders still round-tripped
4/4, so it is evidently harmless — but the build should quietly correct it rather than
inherit a prompt that describes markup it isn't sending.

```text
You convert a Hindi lesson document from informal romanized Hindi (Hinglish, Latin script) into Devanagari.

This is a SCRIPT CONVERSION, not a translation. The Hindi is already written — you are rewriting it in the script it belongs in.

Rules:
1. Every Hindi word in Latin script becomes correct, correctly-spelled Devanagari. The romanization is informal and lossy, so you must restore what it dropped: dental vs retroflex consonants, aspiration, vowel length, nasalisation (anusvara/chandrabindu), and nukta (jad -> जड़, badh -> बढ़, zaroori -> ज़रूरी).
2. Naturalize the register while you convert. Where the romanized text uses a colloquial or Urdu-leaning word because it was written to be spoken, prefer the word a Devanagari-reading Hindi speaker expects: "Sabak" -> पाठ, "tareeqa" -> तरीका, "intezar" -> प्रतीक्षा where the surrounding prose is formal. Do not change the MEANING of any sentence, do not add or remove information, and do not re-translate from scratch — the sentence that comes back must say exactly what the sentence going in said.
3. Any English prose or English UI label left standing in the body is a defect of the source. Render it in natural Hindi too. Two exceptions: keep an English word that is deliberately glossed in parentheses — e.g. "tauba (repent)" becomes "तौबा (repent)" — and keep proper nouns that are conventionally written in Latin script in this document.
4. Scripture references keep their numerals and book names in the form the source used.
5. THE HTML IS SACRED. Return the same document with only the human-readable text changed. Do not add, remove, reorder, merge or split a single element. Every tag, attribute, attribute VALUE (id, class, data-correct, data-answer, data-k, href, aria-*), comment and whitespace-significant structure must come back byte-identical. Placeholder comments of the form <!--[N]--> are opaque markers: reproduce each exactly once, in place.
6. Return the document and nothing else. No markdown fence, no preamble, no commentary.
```

## Call shape

```ts
geminiComplete({
  model: "gemini-3.1-flash-lite",
  messages: [
    { role: "system", content: SYSTEM },
    { role: "user", content: swapOutStatic(storedHtml).stripped },
  ],
});
```

`geminiComplete` pins `thinkingConfig.thinkingLevel: "minimal"`, and the measured
`usageMetadata` came back `thoughts=0` — on this model, minimal really is zero, so no
thinking tokens are billed.

## Rule 3 does not hold — read ticket 02's Answer before shipping it

Rule 3 (repair the source's leftover English) fired on the `<title>` and nowhere else: the
`<button>Check</button>`, the `Sources — Scripture: …` footer, the `Glossary` link text and
the `Lesson 2 ke liye tayyar` heading all came back English in every run. Either drop the
rule and accept the leak, or make the repair a separate targeted pass — do not ship rule 3
believing it works.
