---
type: task
blocked_by: [03]
---
# One answer to "does this account hold this Edition?"

## Question

The code review found the same seven lines written out in five places: read `entitlements` by
`by_topic_user`, then `.some(e => e.lang === lang)`. Two of them sit in `market.ts`'s PayFast
fulfilment and Admin comp, one in the same file's checkout-state read, one in `eft.ts`'s confirm,
and one in `vouchers.redeem`. Five copies of one question means five chances for the sixth to be
written slightly differently.

It was not hoisted on the day for a good reason: doing so edits a live, money-adjacent confirm path
for no behaviour change at all. So the question is not whether the duplication is real, it is
whether the helper can be extracted with the behaviour provably identical, and how wide it is
allowed to be.

The map's own note proposed `hasGrant(ctx, topicId, userId, lang)`, which is a wider question than
any of the five callers actually asks. That needs resolving before anything is written, because a
helper that answers a wider question than its callers wanted is worse than the duplication.

## Done when

- One exported helper answers the question, and the five call sites use it.
- No behaviour changes anywhere: the full suite is green with no test edited to accommodate it.
- The helper's comment says what it deliberately does not read, so nobody widens it later.

## Answer

**Done 2026-08-18. Verified by a green suite (855 tests, 73 files, none edited to accommodate
this), a green `pnpm typecheck` and a green `pnpm build`.**

`hasEntitlement(ctx, topicId, userId, lang)` now lives in `convex/lib.ts` beside `grantsFor`, and
the five call sites are `market.grantEntitlement`, `market.fulfillPurchase`, `market`'s checkout
state read, `eft.confirmEftPayment` and `vouchers.redeem`. Pure extraction: the body is the same
index read and the same `.some`, so the money paths behave identically and no test moved.

**It is narrower than the `hasGrant` the map proposed, deliberately.** It reads `entitlements` and
nothing else. Every one of the five callers is about to WRITE an Entitlement, or (in `redeem`) to
refuse to spend a seat that would write one, so widening it to "has any access" would have
suppressed grants the buyer had actually paid for: an EFT payer who happened to hold a Share would
have been confirmed without ever getting the Entitlement they paid for. `grantsFor` remains the
wide walk and answers a different question (which badge each lang gets), and `vouchers.redeem` asks
its own wider question by checking enrollments and ownership beside this call, where the wider
question stays visible in the handler rather than hiding inside a helper. See ticket 09 for why
those three and not more.
