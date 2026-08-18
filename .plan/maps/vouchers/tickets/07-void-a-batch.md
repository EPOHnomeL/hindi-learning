---
type: task
blocked_by: [03]
---
# Void a batch

## Question

A deal goes wrong — the organisation never pays, or the relationship ends. What can the Seller
actually stop?

**Only what has not been redeemed.** Voiding a batch stops its unredeemed codes and leaves every
redeemed seat exactly where it is. This is not a limitation to be engineered around: because a
redemption records nothing about who redeemed and the Entitlement carries no batch provenance
([ADR 0029](../../../../docs/adr/0029-seller-minted-voucher-rail.md)), the granted seats **cannot
be found**, and that is the accepted cost of the anonymity the feature is built on. An agent who
sets out to make voiding retroactive will end up adding provenance and quietly destroying the
feature. Say what void does and does not do, in the UI, so the Seller is never surprised.

Void is also the reason vouchers need no expiry: the stop is a deliberate human act with a person
behind it rather than a clock that silently voids seats the organisation paid for, on a platform
with no refund rail.

The Ledger row is untouched. If the cash was logged, the Seller is still owed their share; if it was
not, it stays `unpaid`. Voiding a batch is a statement about codes, not about money — collapsing the
two would make void a refund mechanism, which this platform does not have.

## Done when

- `vouchers.voidBatch` marks the caller's own batch voided, and throws for another Seller's batch or
  a non-Seller caller.
- Redeeming an unredeemed code from a voided batch throws (the assertion may already exist from
  ticket 03; make sure it does).
- Already-redeemed seats keep working after a void — asserted, because it is the surprising half.
- The batch's Ledger row and its status are unchanged by voiding.
- The Seller's batch view offers void, shows a batch as voided, and states in plain words that
  voiding stops unused codes only and cannot take back access already granted.
- Voiding is not presented anywhere as a refund, a cancellation, or a way to recover seats.

## Answer
