---
status: accepted
---

# The lesson iframe is a permanent boundary; the quiz stays authored HTML

Decided 2026-09-07 resolving `.plan/maps/technical-foundation/tickets/02-lesson-quiz-architecture.md`.
Three questions had been open since the `ui-overhaul` surface inventory found that the
product's highest-traffic surface is not React at all: LLM-authored HTML in a sandboxed
iframe, with a quiz that is `.quiz[data-correct]` markup wired up by `querySelectorAll`.
This ADR records that the arrangement is **decided**, not tolerated.

## The decision, in three parts

**1. The lesson body stays in the iframe, and `sandbox="allow-scripts"` is permanent.**
The prose is not sanitised and rendered inline. The lesson is a whole HTML document
authored by a model — it brings its own `<style>`, its own class vocabulary and its own
scripts — and the sandbox is what makes running that safe. Dropping `allow-same-origin`
is the property the whole reader rests on: the parent cannot touch the frame's DOM, and
the frame cannot touch the parent's cookies or Convex session. Every bridge in
`src/app/_components/lessonSrcDoc.ts` (height, nav, quiz, theme, reference) exists
*because* of that boundary, not as a workaround for it.

**2. The quiz does not become React, and no structured quiz data is introduced.**
The answer key stays in the authored HTML as `data-correct` / `data-k` /
`data-answer`, and the server does not score. Quiz correctness in this product is
**deliberately self-reported formative data**: it feeds the teaching loop so the next
lesson can respond to what the learner got wrong, and it gates nothing — no
certificate, no money, no access. A learner who edits the DOM inside the frame to
report a correct answer has cheated only their own next lesson. That is the whole
threat model, and it is accepted.

Because scoring is self-reported, the ~441 lessons already published (measured on prod
2026-09-07) need **no migration** and **no compatibility path**: nothing about their
stored HTML has to change. Lessons are immutable anyway (ADR 0003), so a migration
would have meant republishing every one of them to buy a property nobody needs.

**3. The design system reaches the lesson only as CSS custom properties.**
The bridge already exists: `injectTenantPaletteCss` writes the tenant's palette into
the lesson's own bare-name token namespace (`--paper`, `--ink`, `--card`, `--line`,
`--gold`, `--accent`…) before `</head>`. That is the *only* sanctioned channel. No
component, no React tree and no class-name contract crosses into the frame. A design
system that wants to change how a lesson looks changes a token value; if it cannot be
expressed as a token, it does not reach the lesson.

## Considered options

- **Emit structured quiz JSON at authoring time and render the quiz in React** —
  rejected. It buys server-side scoring, which this product has decided it does not
  want, at the cost of a second authoring contract, a migration over every published
  lesson, and a quiz that no longer lives beside the prose it is testing.
- **Keep the HTML quiz but add `allow-same-origin`** so the parent can read the frame
  directly — rejected. It hands model-authored HTML the app's origin, which is the one
  thing the sandbox exists to prevent.
- **Sanitise the lesson HTML and render it inline** — rejected. The lesson's CSS is
  part of the authored artifact; inlining it means either leaking ~200 lines of lesson
  design-system CSS into the app's cascade or rewriting every lesson.

## Consequences

- **The component set needs no quiz primitives**, and the lesson interior is out of
  scope for the design system entirely. This narrows the shadcn foundation ticket
  (`technical-foundation/03`) to the app chrome.
- **One breakpoint number: 768px**, matching Tailwind's `md`, wherever a rule inside
  a lesson has to agree with a rule in the chrome. The lesson design system currently
  says 640/641px in three places, and the render-time justification rule in
  `lessonSrcDoc.ts` says 641px in a fourth.
- **The authored answer key is now a publish-time correctness concern.** With no
  server-side scoring there is nothing downstream to catch a `data-correct` that names
  an option that does not exist; the existing `quizStructureMatches` guard compares
  *counts* between a source and its translation and cannot see it.
- **Self-reported correctness must not be reused as if it were graded.** Reopening
  server-side scoring is a new decision and needs a superseding ADR, not an
  implementation.

## What was not measured

Row counts for `lessons` (441 with a body) and `references` (84) and `translations`
(1476 with a body) were read from prod on 2026-09-07. No measurement was taken of how
many learners answer a quiz at all, or of the read cost of the quiz-response writes —
neither bears on the decision, because the decision removes work rather than adding it.
