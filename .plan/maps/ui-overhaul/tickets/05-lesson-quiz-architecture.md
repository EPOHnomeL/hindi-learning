---
type: grilling
blocked_by: [04]
---
# Does the lesson body, and the quiz, come out of the iframe

> `/wayfinder .plan/maps/ui-overhaul/tickets/05-lesson-quiz-architecture.md`

## Question

Ticket 04 found the highest-traffic surface in the product is not React. Lesson HTML
is LLM-authored into a sandboxed iframe `srcDoc` behind four hand-written script
bridges, and the quiz has no React surface at all: it is `.quiz[data-correct]` markup
wired up by `querySelectorAll`, with correctness normalisation duplicated in two
places a comment admits must stay in sync.

No design system reaches inside that iframe, so this bounds how far the overhaul can
go on the surface that matters most. Three questions, in order:

1. **Does the quiz become React**, fed by structured data the authoring step emits?
   If yes, what happens to the ~1400 existing authored lessons: bridge kept as a
   compatibility path, or a migration?
2. **Does the prose stay in an iframe at all**, or get sanitised and rendered inline?
3. **One breakpoint number**, wherever the boundary lands. The iframe CSS says 641px
   and Tailwind `md` says 768px, so today they disagree between the two.

Deliberately not blocked on ticket 03: this is architecture, and its answer
constrains what the foundation must cover.

## Done when

The Answer settles all three, precisely enough that ticket 03 knows whether the
component set must include quiz primitives.
