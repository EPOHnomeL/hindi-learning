# Vouchers

<!-- Charted 2026-08-18. The design was settled by a /grilling session the same day and
     recorded in ADR 0029 + the Voucher / Voucher Batch glossary terms; the build
     contract is spec.md beside this file. This map is an INDEX over build tickets. -->

## Destination

An organisation can buy course access in bulk **without disclosing its members' email
addresses**: a Seller mints single-use codes for one Edition of their own course, the
organisation distributes them, and each member redeems one onto an account of their own making.
Built and reachable, with the money recorded and the Seller payable only once the cash is logged.

## Notes

- **This map carries only implementation tickets, deliberately.** wayfinder's default is
  plan-don't-do; the override applies here because the planning is already finished elsewhere -
  every decision lives in [ADR 0029](../../../docs/adr/0029-seller-minted-voucher-rail.md) and
  [spec.md](spec.md). There are no decision tickets to split builds from.
- **Read the ADR before touching any ticket.** Three of its choices look like bugs to a reader
  who has not seen it: codes are live before the money is logged, a redemption records nothing
  about who redeemed, and a voucher-granted Entitlement is byte-identical to an Admin comp. The
  last one especially - an agent "tidying up" by adding a `batchId` to the Entitlement would
  silently destroy the feature's whole reason for existing.
- **The unpaid-payouts guard is a schema widening, not a filter.** `ledger.owedPayouts` reads the
  `by_status` index for `"owed"`, so a batch row created at `"unpaid"` is invisible to payouts
  with no logic change at all. Ticket 01 exists to land that widening and prove it green *before*
  anything can write such a row.
- **`convex/eft.test.ts` is the prior art for every test on this map** - `convexTest` at the
  public function boundary, authorisation negatives asserted server-side, and fixtures seeded only
  as production writes them. Never hand-insert a `vouchers` row in a test; mint a batch and read
  the codes back.
- **The grant walk in `convex/lib.ts` should need no change.** A voucher mints an ordinary
  Entitlement, and the walk already treats its presence as access. If a ticket finds itself
  editing the walk, something has drifted from the design - stop and re-read the ADR.
- **Nothing here re-opens the paygate spine**: Edition-grain sale, free first-Lesson Preview,
  lifetime Entitlement, no refunds. Vouchers are a fourth way to mint an Entitlement, not a new
  kind of access.
- Skills: `/tdd` (every ticket has its assertions written out), `/ponytail` (05 and 06 are both
  smaller than they sound - a CSV is a string, and `/redeem` is a form).

## Decisions so far

<!-- the index over resolved tickets: one line each, zoom the link for the detail.
     Six build tickets (02 to 07) are still open and are found by query, not listed here. -->

- [Widen the Ledger for a third money source](tickets/01-widen-ledger-for-a-third-money-source.md)
  - `ledger.status` is now `unpaid | owed | paid` and `ledger.kind` accepts `"batch"`, so a batch's
  money event can exist from the moment the codes do. The payout guard came for free:
  `ledger.owedPayouts` reads the `by_status` index for `"owed"` and its handler is untouched, and
  `markPaid` already refused anything but an `owed` row. No table, no field, no migration. It also
  flipped `sales.ts`'s `salesOnly` from "not a donation" to an allow-list, which that predicate's own
  comment had asked for: unlike a donation, a batch row has a `topicId` and a `lang`, so an unpaid
  batch would have been counted as ordinary revenue the moment ticket 02 wrote its first row.

## Not yet specified

- **Nobody has watched a real batch complete.** The same gap the donation rail has: the code can
  be green end to end and the first live batch will still be the first time money, a CSV and a
  stranger's sign-up meet. Worth an operator walkthrough ticket once 06 lands.
  clears-with: 06
- **Does a confirmed batch count as revenue in the sales report?** Ticket 01 excluded batch rows
  from it outright, which is the fail-closed answer and the one `salesOnly`'s own comment asked
  for: an `unpaid` batch is money that has not arrived, and counting it would overstate revenue.
  But a batch whose cash *has* been logged is real revenue for a real Edition, and it is currently
  invisible to the per-course report while sitting in payouts. Including it needs an answer to a
  second question first - a bulk total for N seats is not the same price as a single sale, so a
  report that sums both reads as one number covering two different things.
- **What the organisation is told, and by whom.** The Seller reports take-up by hand today. If
  that becomes tedious it wants a shareable read-only count - but that is the first step towards
  the organisation entity this design deliberately refused, so it needs its own decision.

## Out of scope

Everything in spec.md's Out of Scope, and in particular: any organisation entity or login, card
checkout for batches, multi-use or expiring codes, discounts on the normal paygate, emailing codes,
and storing who redeemed. The last one is not a deferral - reversing it needs a superseding ADR.
