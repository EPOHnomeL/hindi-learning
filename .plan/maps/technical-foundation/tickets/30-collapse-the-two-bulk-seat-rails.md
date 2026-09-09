---
type: task
blocked_by: [29]
---
# Collapse the two bulk-seat rails onto one deal core

## Question

Filed 2026-09-07 from the 2026-09-04 architecture review (candidate 6), re-verified in
the tree on 2026-09-07.

`convex/accessCodes.ts:17-24` states in its own header that it is a deliberate mirror of
`convex/vouchers.ts`. It has since become one line for line across seven mechanisms:

| mechanism | vouchers.ts | accessCodes.ts |
|---|---|---|
| fresh code generation | `:158-168` | `:171-181` |
| ownership check | `:491-497` | `:273-279` |
| org/contact trim-and-refuse | `:117-133` | `:473-487` |
| settlement queue | `:360-380` | `:599-623` |
| payment logging | `:315-318` | `:550-553` |
| the seller's own list | `:110-115` | `:141-148` |
| `sellableTopic` | shared already | shared already |

So every bulk-sales change is two edits and every bulk-sales audit is two files.

**Only three things genuinely differ, and ADR 0031 names all three:** when the Ledger row
is written (at mint for a batch, at stop for an Access Code), per-seat against per-deal
price, and whether a Seat row exists.

## Done when

The mirrored mechanisms live in one deal module (fresh code, ownership, org assertion,
payment logging, the pending queue), and each rail keeps only what ADR 0031 says actually
differs: `vouchers.ts` keeps `mintBatch` writing the Ledger at mint plus N code rows,
`redeem` and `voidBatch`; `accessCodes.ts` keeps `mintAccessCode` writing no Ledger,
`stopCode` writing it at stop, plus `claimSeat`, `raiseCapacity`, `mySeat` and
`deleteMySeat`. Both keep `sellableTopic`.

No behaviour change. `pnpm typecheck` and `pnpm test` green.

**Blocked by [29](29-one-ledger-writer-for-the-money-event.md)**, and the edge is real
rather than tidy: both rails reach the split through the shared ledger writer 29 builds.
Collapsing the mirror first means writing the shared module against five hand-assembled
ledger rows and then rewriting it, so the ordering matters.

**ADR 0031 named this cost rather than deciding it**, in its own words: "There are now two
bulk-access rails, and an agent auditing bulk sales must look at both." A shared
implementation leaves every substantive constraint of that ADR standing (no provenance on
the Entitlement, derived seat count, no restart after stop), so this needs no superseding
ADR. Say so explicitly in the Answer.

**Sequencing note against [28](28-one-predicate-for-holding-an-edition.md).** 28 fixes
`claimSeat`'s missing hold check, which lives in the half of `accessCodes.ts` this ticket
leaves per-rail. They do not collide, but if 28 has not run, do not silently "fix" the
hold check here; that is 28's Answer to write.

## Answer

2026-09-08, built on top of 29. `convex/bulkDeal.ts` takes the five mechanisms that are
genuinely the same thing: `assertOrganisation`, `freshDealCode`, `ownDeal`,
`logDealPayment` and `unsettledDeals`.

Each rail keeps exactly what ADR 0031 says differs, and each difference is named at the
seam rather than implied: when the Ledger row is written (which is why `logDealPayment`
takes `ledgerId` as optional, since a zero-seat code settles to nothing), per-seat against
per-deal price and the not-yet-stopped refusal that falls out of it, and whether a Seat row
exists. The two code SHAPES are also deliberately not shared, because both rails can be
live on one Edition at once and a `GRP` code must not be mistakable for a `MYC` one.

**No superseding ADR, and this says why**, as the ticket asked. ADR 0031 *named* this cost
rather than deciding it. A shared implementation leaves every substantive constraint of that
ADR standing: no provenance on the Entitlement, a derived seat count, no restart after a
stop.

No behaviour change: the 43 existing tests across both rails pass unmodified, which is the
evidence that this was a move. `claimSeat`'s hold check was 28's and is untouched here, per
this ticket's own sequencing note.

Verified by test. `pnpm typecheck` and the full suite green.
