---
type: grilling
blocked_by: []
---
# Does the lesson body, and the quiz, come out of the iframe

> `/wayfinder .plan/maps/ui-overhaul/tickets/05-lesson-quiz-architecture.md`

## Question

The `ui-overhaul` map’s [ticket 04](../../ui-overhaul/tickets/04-surface-inventory.md) found the highest-traffic surface in the product is not React. Lesson HTML
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

Deliberately not blocked on the design foundation ([ui-overhaul/03](../../ui-overhaul/tickets/03-design-foundation.md)): this is architecture, and its answer
constrains what the foundation must cover.

## Done when

The Answer settles all three, precisely enough that both foundation tickets, this map’s [03](03-shadcn-foundation.md) and [ui-overhaul/03](../../ui-overhaul/tickets/03-design-foundation.md), know whether the
component set must include quiz primitives.

<!-- Moved 2026-09-01 from `ui-overhaul/05` into the technical-foundation map, which groups this repo’s scalability, refactoring and code-architecture work. Renumbered to 02 because `blocked_by` is map-local and the old numbers collided. Inbound links across `.plan/` were repointed in the same commit. -->
