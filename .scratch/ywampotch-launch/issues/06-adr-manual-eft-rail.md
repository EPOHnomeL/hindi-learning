# ywampotch-launch/06: ADR for the manual EFT rail (+ glossary term)

**Status:** built (2026-07-29)
**Depends on:** [04](04-admin-eft-confirm-queue.md) — write it once the shape is real, not before

## Why

A second payment rail, where the operator collects out-of-band and access is
granted by human confirmation, is an architectural decision — not an
implementation detail. Without a record, the next person to read
`market.fulfillPurchase` will find a parallel grant path with no explanation of
why it exists or why it must stay separate, and will be tempted to unify them.

## Scope

An ADR at the next free number (0025 is taken by per-tenant session isolation),
stating at minimum:

- The operator remains **sole merchant-of-record**; the manual rail does not
  change who holds the money.
- A manual sale **mints a Ledger row at `fee: 0`** so Sales and Payouts stay
  whole — the reason not to reuse the bare `grantEntitlement` comp path.
- **Provenance** is carried by `eftRef` vs `pfPaymentId`, exactly one per row.
- The PayFast path is **deliberately untouched**, and `eftIntents` is a separate
  table for that reason — including the reasoning, so a future simplification
  pass understands what it would be risking.
- The consequence the operator accepts: reconciliation is manual, per sale, and
  access is only as fast as the operator's attention.

Also: `CONTEXT.md` currently has no term for a purchase that arrives without a
gateway. The monetisation section names **Entitlement**, **Seller**, **Ledger**
and **Preview**; add whatever this rail needs, with the usual `_Avoid_` line, and
make sure it doesn't collide with **Publish**/**Publishing**, which already share
a word and nothing else.

## Out of scope

- Editing any existing ADR. An ADR that no longer matches the code is a reason to
  write a **new** one superseding it (see ADR 0025 superseding 0022 §4a), never to
  rewrite decision history.

## Acceptance criteria

- The ADR exists, is numbered without collision, and is linked from the glossary
  term.
- `CONTEXT.md` gains the term; the definition matches the code as built, not as
  planned here.

## Notes

Write it **after** the implementation lands. The point of an ADR is to record what
was decided and why, and some of the "why" will only be known once the confirm
queue is real.
