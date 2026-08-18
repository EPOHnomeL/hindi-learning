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
  plan-don't-do; the override applies here because the planning is already finished elsewhere —
  every decision lives in [ADR 0029](../../../docs/adr/0029-seller-minted-voucher-rail.md) and
  [spec.md](spec.md). There are no decision tickets to split builds from.
- **Read the ADR before touching any ticket.** Three of its choices look like bugs to a reader
  who has not seen it: codes are live before the money is logged, a redemption records nothing
  about who redeemed, and a voucher-granted Entitlement is byte-identical to an Admin comp. The
  last one especially — an agent "tidying up" by adding a `batchId` to the Entitlement would
  silently destroy the feature's whole reason for existing.
- **The unpaid-payouts guard is a schema widening, not a filter.** `ledger.owedPayouts` reads the
  `by_status` index for `"owed"`, so a batch row created at `"unpaid"` is invisible to payouts
  with no logic change at all. Ticket 01 exists to land that widening and prove it green *before*
  anything can write such a row.
- **`convex/eft.test.ts` is the prior art for every test on this map** — `convexTest` at the
  public function boundary, authorisation negatives asserted server-side, and fixtures seeded only
  as production writes them. Never hand-insert a `vouchers` row in a test; mint a batch and read
  the codes back.
- **The grant walk in `convex/lib.ts` should need no change.** A voucher mints an ordinary
  Entitlement, and the walk already treats its presence as access. If a ticket finds itself
  editing the walk, something has drifted from the design — stop and re-read the ADR.
- **Nothing here re-opens the paygate spine**: Edition-grain sale, free first-Lesson Preview,
  lifetime Entitlement, no refunds. Vouchers are a fourth way to mint an Entitlement, not a new
  kind of access.
- Skills: `/tdd` (every ticket has its assertions written out), `/ponytail` (05 and 06 are both
  smaller than they sound — a CSV is a string, and `/redeem` is a form).

## Not yet specified

- **Nobody has watched a real batch complete.** The same gap the donation rail has: the code can
  be green end to end and the first live batch will still be the first time money, a CSV and a
  stranger's sign-up meet. Worth an operator walkthrough ticket once 06 lands.
- **What the organisation is told, and by whom.** The Seller reports take-up by hand today. If
  that becomes tedious it wants a shareable read-only count — but that is the first step towards
  the organisation entity this design deliberately refused, so it needs its own decision.

## Out of scope

Everything in spec.md's Out of Scope, and in particular: any organisation entity or login, card
checkout for batches, multi-use or expiring codes, discounts on the normal paygate, emailing codes,
and storing who redeemed. The last one is not a deferral — reversing it needs a superseding ADR.
