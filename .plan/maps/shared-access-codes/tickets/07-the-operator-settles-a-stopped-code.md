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
