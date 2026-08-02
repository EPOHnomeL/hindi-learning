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
