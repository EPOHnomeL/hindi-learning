---
type: task
blocked_by: [01, 02]
---
# Log a batch's cash

## Question

How does the sysadmin turn "the organisation's transfer landed" into "the Seller is owed their
share" - and nothing more than that?

The organisation transfers the agreed total into the **operator's** account; the operator is sole
merchant of record and that does not change here
([ADR 0026](../../../../docs/adr/0026-manual-eft-payment-rail.md)). The sysadmin reconciles the bank
statement, finds the transfer, and logs its reference or transaction ID against the batch. That flips
the batch's Ledger row from `unpaid` to `owed`, at which point it appears in `owedPayouts` and the
Seller can be paid in the ordinary payout run.

Two boundaries make this ticket what it is:

- **Logging is bookkeeping, not a gate.** The codes have been working since the batch was minted.
  Nothing here activates, deactivates, or touches a voucher.
- **The sysadmin never sees a code.** The money role and the selling role are separated by what the
  query returns, not by what a page chooses to render - so `pendingBatches` must return totals,
  seat counts and the organisation's details, and no codes at all. Enforce it in the returns
  validator, where it cannot be undone by a UI change.

Shape it after the pending-EFT-intents view that already exists: the sysadmin's habit for
"unmatched money waiting on me" is already formed, and a batch queue that looks like a stranger is
a queue that gets missed.

## Done when

- `vouchers.pendingBatches` returns the batches with no cash logged - the Edition, the Seller, the
  seat count, the total, the organisation's name and billing contact - and **no codes**, guaranteed
  by the returns validator.
- `vouchers.logBatchPayment` records the reference or transaction ID on the batch and flips its
  Ledger row to `owed`. Idempotent: logging twice does not double anything.
- Both refuse a non-sysadmin caller, asserted as server-side throws - including a Seller trying to
  log their own batch's payment, which is the interesting negative.
- After logging, the row appears in `owedPayouts` grouped under the minting Seller with the correct
  50% share; before logging it does not. Asserted in `convex/ledger.test.ts`.
- An admin surface beside the pending EFT intents view: the queue, and a field to record the
  reference. It shows the total and seat count so the sysadmin can check the figure against what
  landed before committing.
- Nothing in this ticket reads, writes, generates or invalidates a voucher code.

## Answer
