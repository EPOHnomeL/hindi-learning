---
type: grilling
blocked_by: [04]
---
# Does the lesson body — and the quiz — come out of the iframe?

> `/wayfinder .plan/maps/ui-overhaul/tickets/05-lesson-quiz-architecture.md`

## Question

The inventory (ticket 04) found that the highest-traffic surface in the product is
not React: lesson HTML is LLM-authored and injected into a sandboxed iframe `srcDoc`,
with four hand-written `<script>` string bridges over `postMessage`, and **the quiz
has no React surface at all** — it is `.quiz[data-correct]` markup styled by CSS
strings in `lessonSrcDoc.ts`, wired up by `querySelectorAll`.

No design system reaches inside that iframe, so this decides how far the overhaul can
actually go on the surface that matters most. Decide:

- Does the **quiz** become a React component fed by structured data the authoring
  step emits, leaving only prose in the iframe? Or does it stay as authored markup?
- If quizzes come out, what happens to the ~1400 existing authored lessons — does the
  bridge stay as a compatibility path, or is there a migration?
- Does the **prose** stay in an iframe at all, or get sanitised and rendered inline?
- The breakpoint conflict (iframe `641px` vs Tailwind `md` 768px) — one number, wherever
  the boundary lands.

This is deliberately **not** blocked on the design foundation (ticket 03): it is an
architecture question, and its answer constrains what the foundation must cover.

## Done when

The answer states whether quiz and prose leave the iframe, what happens to existing
authored content either way, and what the lesson surface's component boundary is —
precisely enough that ticket 03 knows whether the component set must include quiz
primitives.
