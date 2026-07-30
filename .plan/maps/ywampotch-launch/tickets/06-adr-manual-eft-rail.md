---
type: task
blocked_by: [04]
---

# ADR for the manual EFT rail (+ glossary term)

## Question

A second payment rail, where the operator collects out-of-band and access is
granted by human confirmation, is an architectural decision — not an
implementation detail. Without a record, the next person to read
`market.fulfillPurchase` will find a parallel grant path with no explanation of
why it exists or why it must stay separate, and will be tempted to unify them.

Scope: an ADR at the next free number (0025 is taken by per-tenant session
isolation), stating at minimum:

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

Also: `CONTEXT.md` has no term for a purchase that arrives without a gateway. The
monetisation section names **Entitlement**, **Seller**, **Ledger** and
**Preview**; add whatever this rail needs, with the usual `_Avoid_` line, and make
sure it doesn't collide with **Publish**/**Publishing**.

Out of scope: editing any existing ADR — an ADR that no longer matches the code
gets a new superseding ADR (see ADR 0025 superseding 0022 §4a), never a rewrite.
Write it **after** the implementation lands, since some of the "why" is only known
once the confirm queue is real.

## Done when

The ADR exists, is numbered without collision, and is linked from the glossary
term; and `CONTEXT.md` gains the term with a definition matching the code as
built, not as planned.

## Answer

Built 2026-07-29. Recorded as
[ADR 0026 — manual EFT payment rail](../../../docs/adr/0026-manual-eft-payment-rail.md)
(next free number; 0025 was per-tenant session isolation), capturing that the
operator stays sole merchant-of-record, that a manual sale mints a `fee: 0` Ledger
row so Sales and Payouts stay whole, that provenance is carried by `eftRef` vs
`pfPaymentId` (exactly one per row), that the PayFast path is deliberately
untouched via the separate `eftIntents` table, and the accepted consequence of
manual per-sale reconciliation. `CONTEXT.md` gained the corresponding glossary
term, linked to the ADR and defined to match the code as built.
