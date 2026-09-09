---
type: task
blocked_by: []
---
# The dashboard arrives as one shape, not four

## Question

`Dashboard.tsx` holds six top-level `useQuery` subscriptions (`dashboard`,
`myAdminScope`, `amIAllowlisted`, `listSharedTopics`, `myPurchases`,
`myPendingIntents`) and gates on exactly one of them (`courses === undefined`,
`Dashboard.tsx:195`). The shared-courses, purchased and pending-EFT sections each mount
when their own query lands, so home arrives in three or four steps and everything below
each section jumps down as it appears.

**The repo already knows this hurts.** The root layout carries an inline pre-paint script
forcing `history.scrollRestoration` to `manual`, and its comment says why in as many
words: the content arrives after first paint, the browser restores scroll onto a short
skeleton, "then the grid grows underneath it and the learner is left staring at the
footer". That comment is the bug report for this ticket. The script treats the symptom
and should stay; this ticket removes the cause.

The fix is to reserve the space: render each section's own skeleton while its query is
`undefined`, rather than rendering nothing. `DashboardSkeleton` shows the shape to copy
and the placeholder-fill convention to match (`bg-soft/20`, which the comments in
`ui.tsx` note is deliberate because `bg-card` vanishes against paper).

Two things that need judgement rather than a mechanical pass:

- **A section that will be empty must not reserve space for itself.** Most learners hold
  no shared courses, no purchases and no pending EFT intents. Painting three skeletons
  that then resolve to nothing is a worse layout shift than the one being fixed, not a
  better one. The honest shape is probably to reserve only where the query is likely to
  return something, and the resolving session has to work out how that is known before
  the query lands. If it cannot be known, say so and solve it a different way.
- **Whether the sections should gate together instead.** Holding the whole page until all
  six resolve is the other extreme and is probably wrong on a slow connection, but it is
  the alternative and it should be dismissed on purpose rather than by default.

Do not remove the `scrollRestoration` script. It covers the cold-load case and is cheap.

## Done when

- Home arrives without content below a section jumping down as that section resolves, at
  both breakpoints.
- A learner with no shared courses, no purchases and no pending intents does not see
  skeletons for sections that will be empty.
- Walked in a browser on a throttled connection, since at full speed this is invisible,
  and the Answer says which throttle was used.
