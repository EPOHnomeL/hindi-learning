# 06 — Ledger admin view + mark-paid

Status: done

## Parent

[PRD: PayFast Payments](../PRD.md)

## What to build

Let the operator see what they owe each author and record manual EFT payouts against the
**Ledger** that ticket 4 writes.

- An Admin-only query summarising **amounts owed per author** (sum of `owed` Ledger rows
  per Seller), with enough detail to pay out (author, bank details, total owed, the
  contributing sales).
- An Admin-only **mark-paid** mutation that flips the selected `owed` rows to `paid` and
  records a payout reference (e.g. the EFT reference), so a row is never double-counted.
- A simple admin **payouts** panel presenting the owed totals and a mark-paid action.

## Acceptance criteria

- [ ] The owed-per-author query sums only `owed` rows and is Admin-only.
- [ ] mark-paid flips the chosen rows to `paid`, records the reference, and is Admin-only.
- [ ] A paid row no longer appears in the owed total (no double payout).
- [ ] The admin panel shows each author's total owed and their payout bank details.
- [ ] Tests cover the owed sum, the mark-paid transition, and the admin-only guards; green.

## Blocked by

- [04 — ITN → grant access + write the Ledger](04-itn-grant-access-and-ledger.md)

## Comments

**2026-07-10 (agent)** — Done in `44d3f0d` (+ `49eb5c3` renamed authorShare → sellerShare
per CONTEXT.md's Avoid: Author). `ledger.owedPayouts` + `ledger.markPaid` (original
reference always wins), Payouts panel in the admin portal.
