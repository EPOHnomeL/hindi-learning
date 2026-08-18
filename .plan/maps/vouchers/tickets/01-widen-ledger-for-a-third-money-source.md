---
type: task
blocked_by: []
---
# Widen the Ledger for a third money source

## Question

Can the Ledger record a money event that has been **agreed but not yet received**, without any
risk of paying a Seller for it?

A Voucher Batch is sold before the cash arrives, and its codes work immediately
([ADR 0029](../../../../docs/adr/0029-seller-minted-voucher-rail.md)). So a batch's Ledger row has
to exist from creation while being invisible to payouts until the sysadmin logs the transfer. This
ticket lands that capability **before** anything can write such a row, so the guard is proven green
on an empty road rather than discovered under a feature.

Two widenings, both of them anticipated by the schema's own comments:

- `ledger.kind` gains `"batch"`. The field was made an explicit union rather than inferred from an
  absent `topicId` precisely so a third money source would not be foreclosed — this is that third
  source arriving.
- `ledger.status` gains `"unpaid"`, giving `unpaid → owed → paid`. This is the whole guard:
  `owedPayouts` reads the `by_status` index for `"owed"`, so an unpaid row is excluded **with no
  change to that query's logic**. Prefer this over a boolean-and-filter, which is a guard a future
  edit can forget to apply.

Nothing writes an `unpaid` row yet and nothing writes `kind: "batch"` yet. That is the point: this
is a prefactor, and its value is that ticket 02 becomes a small change.

## Done when

- `ledger.kind` accepts `"batch"` and `ledger.status` accepts `"unpaid"` in `convex/schema.ts`,
  each with a comment saying what writes it and why the status exists.
- `ledger.owedPayouts`'s returns validator accepts a `"batch"` row alongside `sale` and `donation`.
  Its **handler is unchanged** — if this ticket edits the handler, the design has drifted.
- `convex/ledger.test.ts` proves, with a hand-seeded `unpaid` row, that it does **not** appear in
  `owedPayouts`, and that the same row flipped to `owed` does appear with the right share. (This is
  the one place hand-seeding a ledger row is right, because no mutation writes one yet.)
- `pnpm typecheck` and the full test suite pass; no existing sale or donation behaviour changes.
- No new table, no new field, no migration. Both changes are widenings of existing unions, so
  every existing row stays valid.

## Answer
