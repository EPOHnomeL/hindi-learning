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

**Part 2 landed on 2026-09-08 and part 1 did not, so the ticket stays open.** No
`## Answer`, because the `## Done when` above wants both.

**Part 2, the one breakpoint, is built** (commit `feat(lesson): one breakpoint at the
lesson boundary, 768px`). `lessonSrcDoc.ts` injects two rules, not one, which is the trap
this ticket exists to document: it sets justification above 768px AND explicitly unsets it
across the 641 to 767px band, because the injected block lands after the 641px copy baked
into all 441 stored lessons and nothing else would override it there. The unset is
`text-align:start`, not `left`, so an RTL Edition is not pinned to the wrong edge. A test
asserts both rules are present and that the pair lands after the baked one, so deleting
the second fails rather than looking correct. The three partial rules moved to 768px too,
reaching lessons published from now on, and `pnpm bundle:authoring` regenerated the bundle
(which is what 36 unblocked).

**Not verified in a browser.** This ticket asks for a check at 700px on a lesson published
before the change, which is the only width where the trap shows. The CSS is pinned by test;
the 700px walk has not been done.

**Part 1, widening the token bridge, is NOT done, and one claim in the Question is now
corrected.** `injectTenantPaletteCss`'s own comment said it moves "only the 14 contract
vars". That stopped being true when `TENANT_LESSON_DARK_CSS` was added: head.html's
hardcoded DARK surfaces (cards, borders, quiz options, paradigm headers, the parked card,
the singular/plural cells) are already re-pointed at the live tokens, so a navy tenant's
lesson no longer comes out navy-paper with brown cards. The stale comment was fixed at the
seam on 2026-09-08.

What is genuinely left is the LIGHT-mode literals, dozens of warm-paper hexes outside the
dark block. It was declined for this session on purpose: it repaints reading material on
every lesson of every tenant host, the surface-versus-semantic split has to be made per
selector, and it wants a human looking at a real lesson rather than a green test. The two
families that must stay fixed are named at the seam so the next session does not have to
rediscover them: the grammar mark colours and `.note.devo` purple are semantic
colour-coding a reader learns, not surfaces.
