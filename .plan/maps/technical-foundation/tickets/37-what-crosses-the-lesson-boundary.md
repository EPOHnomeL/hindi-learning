---
type: task
blocked_by: [36]
---
# What crosses the lesson boundary: the token bridge, and one breakpoint

## Question

[02](02-lesson-quiz-architecture.md) decided the boundary
([ADR 0035](../../../../docs/adr/0035-lesson-iframe-is-a-permanent-boundary.md)): the
design system reaches the lesson **only** as CSS custom properties, and the one
breakpoint number is **768px**, matching Tailwind `md`. This is that decision, built.

## What to build

**1. Widen the token bridge.** `injectTenantPaletteCss`
(`src/app/_components/lessonSrcDoc.ts:320`) moves the 14 contract vars, and its own
comment admits `head.html` hardcodes dozens of hexes beyond them, so "legacy content is
re-skinned partially by design". With ADR 0035 making custom properties the *only*
sanctioned channel, partial is now a defect rather than a scoping decision. Widen it to
cover the surfaces a tenant palette should reach.

Two things stay fixed, and are not oversights: the grammar mark colours (`mark.r/v/b`
green, `mark.c/j` blue) and `.note.devo` purple are **semantic colour-coding a reader
learns**, not surfaces. They do not follow a tenant palette.

**2. One breakpoint, 768px.** There are four `640/641` rules, and they are not
equivalent:

| Where | Rule | Reaches |
|---|---|---|
| `lessonSrcDoc.ts:263` | `@media (min-width: 641px)` justify | **every lesson, at render time** |
| `lessons/_partials/head.html:47` | the same justify rule | lessons published from now on |
| `lessons/_partials/head.html:24` | `@media (max-width: 640px)` mobile layout | lessons published from now on |
| `lessons/_partials/reference-head.html:27` | `@media (max-width: 640px)` | references published from now on |

Change `lessonSrcDoc.ts:263` to 768px. **The three partial rules are deliberately not
backfilled** — they are baked into the stored HTML of 441 already-published lessons
(measured on prod 2026-09-07) and lessons are immutable (ADR 0003), so editing the
partial changes future lessons only. Editing the partials at all needs
[36](36-repair-bundle-authoring.md) first, which is why this ticket is blocked by it.

**The trap, and it is the whole reason 263 is not a one-character change.** Both rules
are `@media (min-width: N){.wrap p{text-align:justify}}`, and `injectLessonJustify`
inserts its block immediately before `</head>`, *after* `head.html`'s. Raising the
injected rule to 768px does **not** un-justify the 641–767px band on a stored lesson:
the baked 641px rule still matches there, and there is nothing to override it. To
actually move the breakpoint on existing lessons the injected block must both set
justification above 768px **and** explicitly unset it between 641px and 767px. Write
that as two rules and comment why, or the change looks correct and does nothing on the
441 lessons that matter.

## Done when

The token bridge covers the tenant-skinnable surfaces (the two semantic colour families
excepted and commented), `lessonSrcDoc.ts` uses 768px with the 641–767px band explicitly
unset, and the behaviour is checked on a lesson published **before** this change at
700px wide — the only width where the trap above shows.

<!-- Filed 2026-09-07 out of the answer to 02. -->
