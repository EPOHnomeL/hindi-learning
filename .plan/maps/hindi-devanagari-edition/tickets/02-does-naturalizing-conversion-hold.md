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
