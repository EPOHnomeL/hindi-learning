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
  absent `topicId` precisely so a third money source would not be foreclosed - this is that third
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
  Its **handler is unchanged** - if this ticket edits the handler, the design has drifted.
- `convex/ledger.test.ts` proves, with a hand-seeded `unpaid` row, that it does **not** appear in
  `owedPayouts`, and that the same row flipped to `owed` does appear with the right share. (This is
  the one place hand-seeding a ledger row is right, because no mutation writes one yet.)
- `pnpm typecheck` and the full test suite pass; no existing sale or donation behaviour changes.
- No new table, no new field, no migration. Both changes are widenings of existing unions, so
  every existing row stays valid.

## Answer

**Done 2026-08-18. Verified by reading the code and by a green test suite** (838 tests, 72 files,
`pnpm typecheck` clean) - not walked in a browser, which this ticket has no surface for.

Both widenings landed as planned, and the payout guard is exactly as cheap as hoped:
`ledger.status` is now `unpaid | owed | paid`, `ledger.kind` accepts `"batch"`, and
`ledger.owedPayouts`'s **handler is untouched** - it reads the `by_status` index for `"owed"`, so an
unpaid row is invisible to payouts with no filter anyone can later forget. `markPaid` needed no
change either: it already guarded on `row.status === "owed"`, so unpaid money cannot be paid out
even if a caller names the row directly. There is a test asserting that.

**The ticket missed something, and the code had already written the warning.** `convex/sales.ts`
filtered the admin sales report as `r.kind !== "donation"` - a deliberate negative test, so that
rows predating `kind` are not dropped from history - and its comment ended: *"a third money kind
must flip this to an allow-list - that is the one way this predicate goes wrong."* It was right. A
batch row is unlike a donation in the way that matters here: it **has** a `topicId` and a `lang`, so
it would have sailed through the predicate and been counted as an ordinary sale of that Edition. The
moment ticket 02 wrote its first row, an **unpaid** batch - money that has not arrived - would have
appeared in the operator's revenue report.

So `salesOnly` is now an allow-list (`kind === "sale"` or absent), with a test proving a batch row is
excluded while an ordinary sale for the same Edition still counts. This is in scope for a prefactor
whose whole job is to make ticket 02 a small, safe change; leaving it would have shipped a money
report that quietly lied.

That fix takes the fail-closed side of a question it does not answer: **a batch whose cash has been
logged is real revenue for a real Edition, and it is now invisible to the per-course report while
sitting in payouts.** Excluding it understates; including it mixes a negotiated bulk total for N
seats with single-seat prices under one per-Edition number. Recorded in the map's *Not yet
specified* rather than decided here.

One display fix came with it: the payouts view in `AdminPanel` labelled a row as
`kind === "donation" ? "donation" : lang`, so a batch would have rendered as a plain `en` sale at a
bulk price. It now says `en batch`.

**No table, no field, no migration** - both changes widen existing unions, so every existing row
stays valid, and `backfill.backfillLedgerKind` is unaffected.
