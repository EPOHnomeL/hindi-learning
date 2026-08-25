---
type: task
blocked_by: [06]
---
# The operator settles a stopped code

> `/wayfinder .plan/maps/shared-access-codes/tickets/07-the-operator-settles-a-stopped-code.md`

## Question

To the operator this is the job they already do: a line arrives, they raise an invoice, money lands
in the bank, they match the reference. So it belongs beside the pending EFT intents in the Payouts
tab rather than in a new place, exactly as vouchers ticket 04 put the pending batches there.

**The platform does not generate the invoice document.** SARS wants seven fields plus a serial and a
date within 21 days of supply, and a serial series is a thing to own forever and never duplicate.
The queue line carries everything needed to raise the invoice elsewhere, and that is the whole
feature.

The queue is read as an **absent `paymentRef`** on a stopped code, the way `pendingBatches` reads
`by_payment_ref` at `eq(undefined)`. One copy of the payment state, so there is nothing to disagree
with.

## Done when

- `pendingAccessCodes` returns stopped, unsettled codes with organisation, contact, seat count,
  per-seat price and total.
- It returns **no code string, no nickname and no userId**, enforced in the returns validator the way
  `pendingBatches` enforces "no codes", and asserted.
- `logAccessCodePayment` records the reference and flips the Ledger row to `owed`, making the Seller
  payable through the existing payouts path with no change to it.
- Logging the same reference twice is harmless, asserted.
- The line renders in the Payouts tab beside pending EFT intents, and reads as the same kind of job.


## Answer

Built, backend and surface.

`pendingAccessCodes` returns stopped, unsettled codes with the organisation, the billing contact, the
seat count, the per-seat price and the total. The queue is read as an **absent `paymentRef`** on the
`by_payment_ref` index at `eq(undefined)`, exactly as `pendingBatches` reads its own, then narrowed
in memory to stopped codes: a live code has no bill yet, so it is not work waiting on the operator.
One copy of the payment state, so there is nothing to disagree with.

**It returns no code string, no nickname and no userId, enforced in the returns validator**, and the
test asserts it by serialising the whole result and looking for the code, both nicknames, and the
words `nickname` and `userid`. The money role and the selling role are separated by what the query
*can* say, so a later UI change cannot undo it.

`logAccessCodePayment` records the reference and flips the Ledger row `unpaid` to `owed`, which makes
the Seller payable through the existing payouts path with no change to it (asserted: `owedPayouts`
returns the Seller owed 7500 of a 15000 stop). Logging twice is harmless: the second call keeps the
first reference, writes no second row, and the settled code leaves the queue. It also refuses a code
that has not been stopped, because nothing is due yet.

**A zero-seat code never reaches the queue.** It has no Ledger row, so there is nothing to clear, and
showing it as R0.00 would be paperwork invented for a deal that went nowhere. Asserted.

The `AccessCodeQueue` section sits in the Payouts tab **beside** `EftQueue` and `BatchQueue`, and
reads as the same job on purpose. Two details worth keeping: the line spells out the arithmetic
(`42 seats x R150.00`) rather than only the answer, because the operator is about to put those
numbers on an invoice and has to be able to justify them to the organisation; and the section hides
itself when empty, like the other two, so the tab does not accumulate dead headings.

**The platform generates no invoice document** and this ticket did not build one. SARS wants seven
fields plus a serial and a date within 21 days of supply, and a serial series is a thing to own
forever and never duplicate.
