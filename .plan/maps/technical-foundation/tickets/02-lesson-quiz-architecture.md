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


## Answer

**2026-09-07. All three settle, and the arrangement is decided rather than tolerated.**
Recorded as [ADR 0035](../../../../docs/adr/0035-lesson-iframe-is-a-permanent-boundary.md),
which is the durable form of this answer; what follows is the reasoning and the
consequences for this map.

**1. The quiz does not become React, and no structured quiz data is introduced.** The
answer key stays in the authored HTML (`data-correct` / `data-k` / `data-answer`) and
the server does not score. Quiz correctness here is **deliberately self-reported
formative data**: it feeds the teaching loop and gates nothing — no certificate, no
money, no access. That makes the third sub-question ("compatibility path or
migration?") moot: **neither**. Nothing about a published lesson's stored HTML has to
change, which matters because lessons are immutable (ADR 0003) and a migration would
have meant republishing every one.

**2. The prose stays in the iframe, and `sandbox="allow-scripts"` (no
`allow-same-origin`) is a permanent boundary, not a stopgap.** The five bridges in
`lessonSrcDoc.ts` exist *because* of that boundary. Sanitise-and-inline was rejected:
the lesson's CSS is part of the authored artifact.

**3. One breakpoint: 768px**, matching Tailwind `md`.

**4. Consequence for [03](03-shadcn-foundation.md): the component set needs no quiz
primitives, and the lesson interior is out of scope for the design system.** That is
the narrowing 03 was blocked for, and it is written into 03's own body so whoever picks
it up does not have to read this ticket.

**5. The design system reaches the lesson only as CSS custom properties**, across the
bridge `injectTenantPaletteCss` (`lessonSrcDoc.ts:320`) already provides. No component,
no React tree, no class-name contract crosses the frame.

### The count in the Question above is wrong

This ticket says "~1400 existing authored lessons". Measured on **prod** on 2026-09-07
(`capable-barracuda-769`, via the `backfill:verifyHtmlBlobs` walk — see
`docs/agents/project-context.md` for the recipe): **441** lesson rows with a body, 84
references, and **1476** translation rows with a body. 1400 was the translations
number, not the lessons number. It does not reverse anything above — the answer is "no
migration" either way — but a later session reasoning about the cost of touching every
lesson should reason about 441.

### Three build tickets, not this one

This map's contract is that a resolved decision ticket renders as *shipped*, so the
work this answer implies is filed separately rather than smuggled in here:

- **[35](35-publish-time-quiz-answer-key-validator.md)** — the publish-time validator
  for an answer key that names no existing option.
- **[36](36-repair-bundle-authoring.md)** — `pnpm bundle:authoring` has been broken
  since 2026-08-27; it blocks 37's partial edits.
- **[37](37-what-crosses-the-lesson-boundary.md)** — widen the token bridge and move
  the breakpoint to 768px.

### Two things deliberately not done

- **The `e.source` guard on the quiz bridge stays with
  [27](27-iframe-bridge-as-one-source-checked-module.md)**, untouched here. Part 2
  above is why 27 is a hardening ticket and not an architecture question: the boundary
  it hardens is now decided.
- **No behavioural measurement.** How many learners answer a quiz at all is unmeasured.
  It does not block anything, because this answer removes work rather than adding it —
  but **reopening server-side scoring would need those numbers first**, and would need
  a superseding ADR rather than an implementation.

<!-- Moved 2026-09-01 from `ui-overhaul/05` into the technical-foundation map, which groups this repo’s scalability, refactoring and code-architecture work. Renumbered to 02 because `blocked_by` is map-local and the old numbers collided. Inbound links across `.plan/` were repointed in the same commit. -->
