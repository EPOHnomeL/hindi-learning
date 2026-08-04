---
type: task
blocked_by: []
---

# A cloned Edition is live data that no learner can reach

> `/wayfinder .plan/maps/course-translation/tickets/08-a-cloned-edition-is-not-reachable.md`

## Question

`st-ZA` was published on prod on 2026-08-02 ([ticket 06](06-sesotho-za-from-lesotho-clone.md))
— 59 correct rows, job `ready`. **And no learner can find it.**

`cloneEdition` ([convex/translate.ts:410](../../../convex/translate.ts#L410)) copies
`translations`, `shares` and `pendingShares`, and deliberately skips `publicLinks`,
`enrollments`, `entitlements` and `listings` — reasonable, those are per-Edition
capabilities. But it also never creates a **`publishedEditions`** row, and that is the one
the catalogue gates on: `catalogue.list` → `livePublishedLangs` → `publishedLangs` filters to
rows with `published: true` ([convex/lib.ts:250](../../../convex/lib.ts#L250)). Job status
`ready` is necessary but **not** sufficient.

So a cloned Edition is invisible in the catalogue, has no public bearer link, and has no
price. Today `st-ZA` is reachable only by the owner and the single share the clone copied.

**This is not fixable from a script.** `catalogue.setEditionPublished` and
`market.setEditionPrice` are **owner-auth** mutations (`getAuthUserId` + `getOwnedTopic`),
not `PUBLISH_SECRET`-guarded like the rest of the run's seams — so they need a signed-in
owner in the Editions panel, and an agent cannot do this step.

## The immediate need, and the general one

They are different and both worth deciding:

1. **Immediate — make `st-ZA` reachable.** Owner opens the Editions panel and flips Publish
   for `st-ZA`; and sets a price if `st` is priced (check what `st` carries first and match
   it deliberately — a free clone of a paid Edition gives the course away).
2. **General — should `cloneEdition` carry any of this?** It is documented as leaving those
   tables alone on purpose, and blindly duplicating a *price* or a *bearer token* is clearly
   wrong. But `publishedEditions` is arguably different from a capability: it is closer to
   "this Edition exists for the public" than to "someone paid for it". Decide whether clone
   should copy it, or at minimum whether the clone path should **tell** its caller that the
   new Edition is unreachable until published — the current silence is what let `st-ZA` sit
   finished-but-invisible without anyone noticing.

## Done when

- `st-ZA` is reachable by a learner on prod, by whatever route the owner intends
  (catalogue-listed, priced to match `st`, and/or a public link) — and that route was
  **walked in a browser**, not inferred.
- A decision recorded on whether `cloneEdition` should copy `publishedEditions`, warn, or
  keep its current silence — with the reasoning.

## Answer

**Resolved 2026-08-04 — `st-ZA` is reachable, and the owner has seen it render.**

The owner flipped Publish for `st-ZA` in the Editions panel and opened the rendered Edition
in a browser. That is **walked, not inferred** — the standard this ticket's Done-when asked
for, and it also discharges ticket 06's one outstanding condition ("the rendered `st-ZA`
Edition was opened in a browser and spot-checked"), which nothing until now had done.

Reported by the user, not verified by an agent: `catalogue.list` is auth-gated
(`getAuthUserId` → returns `[]` when signed out, [convex/catalogue.ts:96](../../../convex/catalogue.ts#L96)),
and `setEditionPublished` / `setEditionPrice` are owner-auth, so there is no agent-reachable
seam to confirm it from. That was the whole point of the ticket.

**The general question is now decided too (2026-08-04): warn, don't copy — and it is built.**

`cloneEdition` still creates no `publishedEditions` row, and deliberately so. Copying one
would be actively worse than the silence: `listings` is not copied either, and **the presence
of a listing row is what makes an Edition paid** ([convex/schema.ts:551](../../../convex/schema.ts#L551)),
with `freePublishedLangs` defined as `livePublishedLangs` minus the priced ones. A clone that
inherited `published: true` without a price would be a **free copy of a paid course**. So
publishing stays an owner-auth act, on purpose.

What changed is the silence. `cloneEdition` now returns `reachable: false` alongside
`sourcePublished` and `sourcePrice` — the state the owner has to reproduce by hand — and both
callers print it as an explicit next step:
[scripts/clone-edition.ts](../../../scripts/clone-edition.ts) and
[scripts/st-za-rewrite.ts](../../../scripts/st-za-rewrite.ts). Covered by two tests in
`convex/translate.test.ts`: one asserting the caller is told, one asserting the clone is
neither published nor priced.

Worth recording: **`cloneEdition` had no tests at all** before this. The `st-ZA` clone ran on
an untested mutation.

## Notes

- Check `st`'s own price and published state before matching it; don't assume it is free.
- Ticket 06's remaining unmet condition — *"the rendered `st-ZA` Edition was opened in a
  browser and spot-checked"* — is naturally done as part of this, since publishing it is
  what makes it openable. Nobody has yet seen a single `st-ZA` page rendered.
