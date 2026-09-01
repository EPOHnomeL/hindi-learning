---
type: task
blocked_by: [23]
---
# The payout panel on the course Dashboard

> `/wayfinder .plan/maps/ui-overhaul/tickets/25-dashboard-payout-panel.md`

## Question

The operator decided on 2026-09-01 that a course owner sees, on the Dashboard tab,
**what this course has paid out to them**. Today no owner-facing money figure exists
anywhere in the app: every rollup is admin-only.

What exists, and what it refuses to do:

- **`convex/ledger.ts`** is the payout seam. Every sale writes a `ledger` row through
  `splitNet` (card in `accessCodes.ts:474`, EFT in `eft.ts:399`, donations in
  `donations.ts:189`), carrying `sellerShare` and a
  `status: "unpaid" | "owed" | "paid"` (`schema.ts:699`). That tri-state **is** the
  owed/paid stack this panel needs, already written and already indexed `by_status`.
- **`ledger.owedPayouts`** rolls it up per payee, with bank details, and is
  `isCallerAdmin` gated. It groups by `sellerId` and, in its own words, "never looks
  at a course". This panel is the opposite cut: one course, its owner, both states.
- **`convex/sales.ts`** `report` and `byDay` are gross only, admin-gated, not
  tenant-scoped, and structurally exclude donations via `salesOnly`, whose comment
  warns that "a third money kind must flip this to an allow-list". Gross is the wrong
  number for an owner and donations belong in, so this panel does not use them.

The decisions this ticket has to make:

1. **Which number is "the payout".** Paid to date, owed right now, or both stacked.
   The `translator-status-report` charting grill settled the vocabulary on 2026-08-11
   for its own report: `sellerShare`, stacked owed and paid, gross in a totals row,
   the platform's 50% implied rather than called out, donations included. Reuse that
   unless there is a reason not to, and say so either way.
2. **The auth path.** Owner-of-this-course, checked server side, not
   `isCallerAdmin` and not a client filter. This is the only genuinely new backend
   security surface on the Dashboard.
3. **Donations.** ADR 0027 routes a donation to the tenant's `donationPayee`, not the
   course owner, and a donation "bought no Edition" so its ledger row has no Edition.
   Whether a donation can be attributed to a course at all decides whether it can
   appear here. If it cannot, the panel must not silently under-report; say what is
   excluded on the panel itself.
4. **Whether the figure is per Edition.** Sales carry an Edition language, so a payout
   split per language is available and would sit naturally beside 23's users-per-
   language counts. Decide, do not assume.

Read the ADRs on the money rails before deciding anything above. Use `/tdd` and
`/ponytail`; read `dataviz` before drawing any figure.

## Todo

- [ ] Settle the four decisions above and record each in the Answer.
- [ ] One owner-gated query, tested with `vitest` like the rest of the money code,
      including a test that a non-owner gets nothing.
- [ ] Render into 23's Dashboard body, read-only, currency formatted through the
      existing i18n path and not hand-formatted.
- [ ] Copy through the message namespaces, no hardcoded English.
- [ ] Never render a partial figure without saying what it excludes.
- [ ] `pnpm typecheck` green.
- [ ] Walk it in a browser at phone width against a course with real sales.

## Done when

The Answer names the number chosen, the auth check that guards it, the donation
decision and its consequence for accuracy, and states that the panel was walked in a
browser rather than only read.
