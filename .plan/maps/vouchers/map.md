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
     Open build tickets are never listed here; the frontier is derived, not written. -->

- [Widen the Ledger for a third money source](tickets/01-widen-ledger-for-a-third-money-source.md)
  - `ledger.status` is now `unpaid | owed | paid` and `ledger.kind` accepts `"batch"`, so a batch's
  money event can exist from the moment the codes do. The payout guard came for free:
  `ledger.owedPayouts` reads the `by_status` index for `"owed"` and its handler is untouched, and
  `markPaid` already refused anything but an `owed` row. No table, no field, no migration. It also
  flipped `sales.ts`'s `salesOnly` from "not a donation" to an allow-list, which that predicate's own
  comment had asked for: unlike a donation, a batch row has a `topicId` and a `lang`, so an unpaid
  batch would have been counted as ordinary revenue the moment ticket 02 wrote its first row.
- [Mint a Voucher Batch](tickets/02-mint-a-voucher-batch.md)
  - `voucherBatches` + `vouchers` and `convex/vouchers.ts`'s `mintBatch`, which writes the batch,
  its N codes and ONE `unpaid` Ledger row in a single mutation. The unpaid queue is an ABSENT
  `paymentRef` on the batch (`by_payment_ref`, `eq(undefined)`), not a second status beside the
  Ledger's - one copy of the payment state, so there is nothing to disagree with. Codes are
  `MYC-XXXX-XXXX`: the prefix is literal, the 8 random characters carry the ~1.1e12 of entropy.
- [Redeem a Voucher](tickets/03-redeem-a-voucher.md)
  - `redeem` takes a code and nothing else, mints an ordinary Entitlement onto the signed-in
  caller, and refuses without consuming whenever it would grant nothing. The privacy is pinned by
  asserting the Entitlement's and the voucher's exact key sets, so adding provenance back fails a
  test. Its refusals had to become **tagged `ConvexError`s**: a production deployment redacts a
  plain `Error` to "Server Error", so the carefully distinguished messages would have reached the
  member as one blank.
- [Log a batch's cash](tickets/04-log-a-batchs-cash.md)
  - `pendingBatches` (no codes, enforced in the returns validator) and `logBatchPayment`, which
  records the reference and flips the Ledger row to `owed`. Idempotent, and it touches no code at
  all. The queue sits beside the pending EFT intents in the Payouts tab, because to the operator it
  is the same job.
- [The Seller's batch view and CSV](tickets/05-the-sellers-batch-view-and-csv.md)
  - `myBatches` with a derived take-up count and the payment state in a full sentence, and
  `batchCodes` refusing anybody but the minting Seller. The batch section lives under the price
  control in the Editions dialog; the CSV is a client-side blob with no library and no route, and
  the codes are fetched on the click rather than subscribed to, so a page never holds every code of
  every batch open.
- [The /redeem page](tickets/06-the-redeem-page.md)
  - One route on every host, outside the (app) group so a stranger meets the code box rather than a
  sign-in wall. The code is carried in the URL **and** localStorage because those fail in different
  places, and redemption fires once on the authenticated side. **Walked signed out in a browser**,
  including the sign-up round trip and all three refusals.
- [Void a batch](tickets/07-void-a-batch.md)
  - `voidBatch` stops unredeemed codes and nothing else. Granted seats keep working and cannot be
  found, the Ledger row is untouched in both directions, and the UI says so in plain words at the
  batch and again at the confirm. Void is never presented as a refund.

## Not yet specified

- **Nobody has watched a real batch complete, end to end, with real money.** Ticket 06 closed half
  of this on 2026-08-18: the redemption journey WAS walked in a browser, signed out, through
  sign-up and into the reader. What has still never been walked by a person is the other half - a
  Seller minting a batch through the form, handing over the CSV, and the sysadmin matching a real
  bank line and logging it. Those two surfaces are test-covered and read correct, and neither has
  been clicked. Worth an operator walkthrough before the first live batch.
- **Nothing tells a Seller that `/redeem` exists.** They mint a batch, download a CSV of codes, and
  the platform never says where those codes are typed - so the URL reaches the organisation only if
  the Seller thinks to include it. Probably a line on the CSV or beside the download; it needs
  five minutes of thought about what a printed card should say, which is why it is here and not a
  ticket.
- **Does a confirmed batch count as revenue in the sales report?** Ticket 01 excluded batch rows
  from it outright, which is the fail-closed answer and the one `salesOnly`'s own comment asked
  for: an `unpaid` batch is money that has not arrived, and counting it would overstate revenue.
  But a batch whose cash *has* been logged is real revenue for a real Edition, and it is currently
  invisible to the per-course report while sitting in payouts. Including it needs an answer to a
  second question first - a bulk total for N seats is not the same price as a single sale, so a
  report that sums both reads as one number covering two different things.
- **A Share holder redeeming a code still burns it.** `redeem` refuses without consuming for the
  three cases the spec enumerates - Entitlement, Enrollment, ownership - and a **[[Share]]** is
  deliberately not among them. That is arguably right (a Share can be revoked by its owner, so the
  Entitlement a code mints is genuinely more than the reader already had) and arguably a wasted
  seat. It was built as specified rather than widened on the day; if it is wrong it is a one-line
  change plus a fourth assertion, but it is a decision about what "already has access" means and it
  wants deciding rather than drifting.
- **Three modules now answer "does this account already hold this Edition?" separately.** The walk
  in `lib.ts`, the entitlements check in `eft.ts`'s confirm, and the three-way check in
  `vouchers.redeem`. One `hasGrant(ctx, topicId, userId, lang)` would serve all three, and the
  reason it was not written today is that hoisting it edits a live, money-adjacent confirm path for
  no behaviour change. Worth doing on the next change that touches that path for its own reasons.
- **What the organisation is told, and by whom.** The Seller reports take-up by hand today. If
  that becomes tedious it wants a shareable read-only count - but that is the first step towards
  the organisation entity this design deliberately refused, so it needs its own decision.

## Out of scope

Everything in spec.md's Out of Scope, and in particular: any organisation entity or login, card
checkout for batches, multi-use or expiring codes, discounts on the normal paygate, emailing codes,
and storing who redeemed. The last one is not a deferral - reversing it needs a superseding ADR.
