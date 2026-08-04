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

**The general question is closed unanswered.** Whether `cloneEdition` should copy
`publishedEditions`, warn its caller, or keep its current silence was *not* decided — the
effort ended first. The silence remains: the next cloned Edition will also land
finished-but-invisible, exactly as `st-ZA` did. That is a known, accepted gap, not a fixed
one, and it is the single most likely way this bites again. If a second clone is ever made,
decide it then — the argument is already written up under "The immediate need, and the
general one" above.

## Notes

- Check `st`'s own price and published state before matching it; don't assume it is free.
- Ticket 06's remaining unmet condition — *"the rendered `st-ZA` Edition was opened in a
  browser and spot-checked"* — is naturally done as part of this, since publishing it is
  what makes it openable. Nobody has yet seen a single `st-ZA` page rendered.
