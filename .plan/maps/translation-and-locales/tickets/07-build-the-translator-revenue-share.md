---
type: task
blocked_by: [05]
---
# Build the translator revenue share

## Question

Build what 09 decided. Nothing here is a fresh decision; if this ticket finds itself
deciding something, that is a signal 09 was resolved too loosely and the question
belongs back there.

The known surface, from the charting grill and 09's premise:

- The tenant's rate field, and the surface that sets it.
- `splitNet` becomes three-way, and every caller follows. Today those are
  [`convex/payfast.ts`](../../../convex/payfast.ts) (the verified ITN) and
  [`convex/eft.ts:403`](../../../convex/eft.ts) (the manual bank-transfer rail). **Both
  rails must agree**, or which rail sold a seat silently changes who gets paid.
- `ledger` gains whatever 09 chose for the third share and its payee, with the rate and
  payee **frozen at sale time**.
- `ledger.owedPayouts` and `markPaid` handle a second kind of payee, and the Payouts tab
  in [`AdminPanel.tsx`](../../../src/app/_components/AdminPanel.tsx) shows what is owed
  to translators as well as sellers.
- 04's **projected** translator share becomes a real, frozen figure for sales made after
  this ships, while remaining projected-only for everything before it. The report has to
  show both truthfully, in the same table, without implying the older ones are owed.

Money code, so the bar is higher than elsewhere on this map: build it test-first with
`/tdd`, and cover the rounding so the three shares always sum exactly to `net`.

## Done when

- A sale on **each** rail (PayFast ITN and manual EFT) writes a correct three-way split
  with the rate and payee frozen on the row.
- Rounding is tested such that the three shares sum to `net` exactly, including at the
  awkward values.
- A tenant with no rate set behaves exactly as today, with no migration and no backfill
  required for existing rows.
- Existing `ledger` rows are untouched and still read correctly, and the report
  distinguishes frozen from projected.
- Payouts surfaces translator amounts, and `markPaid` can settle one.
- `pnpm typecheck` and `pnpm test` green.

<!-- Moved 2026-09-01 from translator-status-report/11 during the .plan consolidation (33 map dirs to 7 active maps).
     Renumbered because blocked_by is map-local; the old number stays that ticket's identity in the donor
     map's history. Its blocker followed it: translator-status-report/09 is now 05 here. -->
