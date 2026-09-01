---
type: task
blocked_by: []
---

> `/wayfinder .plan/maps/learning-experience/tickets/06-dashboard-empty-state-ignores-catalogue.md`

# Dashboard empty state contradicts the catalogue below it

## Question

**This is a fix, not a decision.** Found 2026-08-06 while building the demo prototype for
[Scope the product onboarding + marketing video](../../media-generation/tickets/03-scope-onboarding-and-marketing-video.md),
and re-verified live 2026-08-07.

`emptyLibrary` at `src/app/_components/Dashboard.tsx:106-115` is computed from four lists of
what the member **owns** — `courses`, `shared`, `purchased`, `pending` — plus
`amAllowlisted === false`. It does not consider the site catalogue. But `<AvailableSection />`
(`src/app/_components/Dashboard.tsx:193`) renders unconditionally, from
`api.catalogue.list` scoped to the browsed tenant.

So a **new tenant learner** — the exact audience this map exists for — lands on a dashboard
showing `<EmptyLibrary />` ("No courses yet, a marketplace is coming soon") rendered directly
above a live "Available courses" section containing a buyable R100 course with a price badge.
The screen tells them there is nothing to buy and then offers them something to buy.

This is the same class of bug the authors already fixed once: `pending` was added to
`emptyLibrary` precisely because a buyer who had just EFT'd was told "No courses yet" above
the course they had paid for, "which reads as the payment having been lost"
(`src/app/_components/Dashboard.tsx:90-94`). The catalogue case is the same mistake with the
one input nobody added.

Worth deciding as part of the fix: whether the catalogue should suppress `<EmptyLibrary />`
outright, or whether the empty state should change its *copy* when a catalogue exists. A
tenant learner with an empty library but a stocked shop is not in the same situation as one
on a site with genuinely nothing published, and "a marketplace is coming soon" is false for
the first and true for the second.

## Done when

A learner on a tenant with a non-empty catalogue no longer sees "a marketplace is coming
soon" above purchasable courses, with a regression test covering the catalogue input to
`emptyLibrary` the way `pending` is covered.

<!-- Moved 2026-09-01 from `onboarding/03` during the .plan consolidation (33 map dirs to 7 active maps).
     Renumbered because `blocked_by` is map-local; the old number stays that ticket's identity in the donor map's history. -->
