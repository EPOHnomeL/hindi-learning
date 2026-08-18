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

**Done 2026-08-18. Verified by reading the code and by a green suite**, including the end-to-end
assertion in `convex/ledger.test.ts` that a batch minted by `mintBatch` is invisible to
`owedPayouts` until `logBatchPayment` runs and then appears under the minting Seller at the right
50% share. The admin surface was **not** walked in a browser - it renders beside a queue that is,
and nothing on it is new machinery.

`vouchers.pendingBatches` returns the Edition, the Seller, the seat count, the total and the
organisation's details, and **no codes** - guaranteed by the returns validator, which is the point:
the boundary between the money role and the selling role cannot be undone by a UI change. There is
a test that asserts the queue's serialised output does not contain any of the batch's codes, and
that a Seller, a Guest and the sysadmin all get what they should (the first two refused, the last
served).

`vouchers.logBatchPayment` records the reference and flips the Ledger row `unpaid` -> `owed`. It is
idempotent on the reference already being present, so a second click keeps the ORIGINAL reference -
the one that reconciles the statement line - and moves nothing twice. A Seller trying to log their
own batch's payment is refused, which is the interesting negative. Nothing in the mutation reads,
writes, generates or invalidates a code, and the test proves a code still redeems afterwards.

The queue lands in the Payouts tab under "Voucher batches awaiting payment", directly beside the
pending EFT intents, with the total and seat count shown so the figure can be checked against what
landed before committing. Shaped after that queue deliberately: to the operator this is the same
job, and a queue that looks like a stranger is a queue that gets missed.
