---
type: research
blocked_by: []
---
# Is this one defect or three, and how big is it outside prophetic-school?

> `/wayfinder .plan/maps/translation-and-locales/tickets/09-count-across-editions.md`

## Question

[hindi-devanagari-edition/06](../../hindi-devanagari-edition/tickets/06-inherited-english-repair-flag-or-ship.md)
counted the untranslated English in **one** Edition of **one** topic (prophetic-school `hi-Latn`,
57 items, 13,531 Latin word-instances) and only because Devanagari conversion made it visible.
Before anything can be decided about the English→X path, establish the shape of the defect:

- **Which topics and Editions are affected?** The strings come from authored English lessons, so
  any topic whose lessons carry the same chrome partials inherits it. Enumerate the topics and
  their Editions.
- **Is the measurement even possible for the Latin-script Editions?** For a romanized Edition
  (`hi-Latn`, and any other `-Latn`) untranslated English is script-indistinguishable from
  translated content — that is exactly why 06 had to measure on converted output. Say which
  Editions can be counted directly (non-Latin scripts) and what stands in for a count on the
  rest. A diff of the Edition against the authored English source is the obvious candidate:
  a text node byte-identical to its English original is untranslated.
- **Do the three classes want the same verdict?** Chrome labels (~25 recurring strings), footer
  citation quotes (half the volume, verbatim quotations from published English works), and
  fill-in answer keys (deliberate upstream design) differ in kind, not just size. Report whether
  the counts support treating them separately.
- **Where does each class's fix actually go?** Authored English lesson HTML, the shared partials
  in `lessons/_partials/`, or the translate prompt in `convex/translate.ts`. A string that is
  chrome in a partial is fixed once for every topic; a citation inside a lesson body is not.

## Done when

A per-topic, per-Edition table of how much untranslated English each carries, with the method
stated for the Latin-script Editions where a script test cannot work. Says whether the three
classes are one defect or three, and names the fix site for each. Does **not** decide whether to
fix it — that is the next ticket, and it needs these numbers first.

<!-- Moved 2026-09-01 from english-source-untranslated-chrome/01 during the .plan consolidation (33 map dirs to 7 active maps).
     Renumbered because blocked_by is map-local; the old number stays that ticket's identity in the donor
     map's history. That map held only this ticket, so the directory is gone. -->
