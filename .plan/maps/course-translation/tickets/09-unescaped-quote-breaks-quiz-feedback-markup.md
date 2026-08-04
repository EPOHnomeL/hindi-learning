---
type: task
blocked_by: []
---

# An unescaped `"` in quiz feedback breaks the markup — in the English source

> `/wayfinder .plan/maps/course-translation/tickets/09-unescaped-quote-breaks-quiz-feedback-markup.md`

## Question

Found on 2026-08-02 while verifying the `st-ZA` rewrite ([06](06-sesotho-za-from-lesotho-clone.md)):
a `data-no` quiz-feedback attribute contains a **literal unescaped `"`**, which terminates
the attribute early. Everything after it is then parsed as garbage attribute *names*:

```html
data-no="… 'Lentswe "matla," ka Segerike, ke lentsoe dunamis, …"
                    ↑ attribute ends here
→  matla,="" ka="" segerike,="" ke="" lentsoe="" dunamis,="" moo="" re="" fumanang=""
```

**This is in the source, not a translation artefact** — the same malformation is present in
`st` and in the English original, so the orthography transform merely surfaced it. It found
it because those words are unreachable to any text transform: they sit in attribute-name
position, which is exactly where a rewrite must not touch anything. Three Lesotho words
remain unconverted in `st-ZA` for this reason, and that count is the *symptom*, not the
problem.

The real question is what the **learner** sees. The reader takes `data-no` as the feedback
string for a wrong answer, so on this question the feedback is almost certainly truncated at
the stray quote — in every Edition including English. Nobody has looked.

## Done when

- The rendered behaviour is established: open the affected question in the reader and see
  what the wrong-answer feedback actually shows. If it is truncated, that is a live content
  bug on a sold course, not a tidiness issue.
- Every occurrence is found, not just this one — grep the authored source for a `"` inside a
  `data-no` / `data-ok` / `data-answer` / `data-alt` value across all lessons and all
  Editions, since a hand-authored quote can appear anywhere.
- The source is fixed (`&quot;` or typographic `"…"`), and the fix flows to the Editions
  that inherited it.
- Consider whether authoring should reject or escape this at write time so it cannot recur —
  it survived authoring, translation into several languages, and a full orthography pass
  without anything complaining.

## Notes

- Reproduce with: `pnpm tsx scripts/st-za-rewrite.ts --topic prophetic-school` then
  `grep -oh 'lentsoe=""[^>]*' st-za-review/prophetic-school/after/*.html`.
- Low urgency by word count (3), potentially not low urgency by learner impact — settle the
  rendered behaviour first, and let that decide the priority.

## Ruled out

**Ruled out of scope 2026-08-04 — this is an authoring/content defect in the English source,
not a translation defect, and it outlived the effort that happened to find it.**

Found while verifying the `st-ZA` rewrite, which is the only reason it sits on this map. But
the stray `"` is in the **authored English**, so every Edition inherits it and translation is
neither cause nor cure. Fixing it here would mean this map owning a content-authoring bug on a
sold course.

Closed with its central question still unanswered: **nobody has opened the affected question
in the reader**, so whether the wrong-answer feedback is visibly truncated for a learner is
still unestablished — the ticket's own first Done-when condition. It was never a tidiness
issue *or* a confirmed live bug; it was never looked at. Three words by word count, unknown by
impact.

Anyone picking this up should treat the whole Done-when list as still standing — establish the
rendered behaviour first, then grep the authored source for `"` inside `data-no` / `data-ok` /
`data-answer` / `data-alt` values across **all** lessons, since a hand-authored quote can
appear anywhere. Reproduce with the two commands under Notes above.

Worth knowing for that session: `publishTranslation`'s quiz-structure guard is currently **off**
for blob-backed sources (see [ticket 05](05-drop-inline-html-contract.md)), which is plausibly
how this survived authoring, translation into several languages, and a full orthography pass
without anything complaining.
