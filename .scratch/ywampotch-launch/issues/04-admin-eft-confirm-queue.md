# ywampotch-launch/04: Admin confirm queue — grant + Ledger row

**Status:** open
**Depends on:** [03](03-buyer-pay-by-eft-intent-and-reference.md)

## Why

This is where an EFT becomes access. It also has to make a manual sale **visible
to the money surfaces** — the Sales tab and Payouts — which the existing
`market.grantEntitlement` does not, because it writes no Ledger row. A sale the
operator can't see is a sale the seller doesn't get paid for.

## Scope

- A **pending-EFT list** in `src/app/_components/AdminPanel.tsx`. Reuse the
  Payouts or Sales area; add a sixth tab only if it genuinely reads badly.
  Each row: reference, buyer email, course, Edition, amount.
- **Confirm** — one mutation, atomically minting the Entitlement **and** writing
  the Ledger row, mirroring `market.fulfillPurchase`'s ordering and idempotency
  guarantees. `fee: 0`, `net == gross` (no gateway took a cut), split 50/50 via
  the existing `splitNet`. Idempotent per reference **and** per
  `(buyer, Topic, language)`.
- **Dismiss** — marks an intent that never got paid. Stale intents are litter,
  not errors; without a dismiss the queue silts up and stops being read, which is
  how a real payment eventually gets missed.
- Sys-admin only, same gate as [02](02-operator-bank-details-settings-record.md).

### Schema change

`ledger.pfPaymentId` is currently **required** (`convex/schema.ts`), and an EFT
sale has no PayFast id.

- Widen `ledger.pfPaymentId` to optional; add optional `ledger.eftRef`.
- Add optional `entitlements.eftRef` (its `pfPaymentId` is already optional).
- **Exactly one** of the two is present on any row — that is what gives every
  Entitlement and Ledger row unambiguous provenance back to the rail that sold it.

## Out of scope

- Automatic bank-statement matching or a bank feed. The operator reads their
  statement and clicks.
- Changing how payouts work. A confirmed EFT sale becomes an ordinary `owed`
  Ledger row and flows through the existing Payouts tab untouched.

## Acceptance criteria

- Confirming mints exactly one Entitlement and exactly one Ledger row, and the
  intent moves to `confirmed`.
- Confirming the **same** reference twice is a no-op — no duplicate grant, no
  duplicate Ledger row, no double-counted money.
- Confirming for a buyer who **already holds** that Edition (bought it by card
  meanwhile) does not create a second Entitlement — that falls out of the
  `(buyer, Topic, language)` idempotency and needs **no special handling**.
  **Decided by the operator, 2026-07-29:** this collision is rare enough to sort
  out by hand; do not write code, a branch or a warning for it. Whatever the
  idempotency guard naturally does is correct. Don't reopen this.
- The Ledger row's `sellerShare` + `platformShare` equal `net`, and `net == gross`.
- The sale appears in the Sales tab and as `owed` to the seller in Payouts.
- Dismissing removes the intent from the queue and grants nothing.
- A tenant admin can do neither. Assert server-side.

## Tests

- Idempotency on both keys — this is the money-losing failure, write it first.
- The split arithmetic at `fee: 0`.
- The already-entitled collision case.
- Build every fixture through the real mutations. A hand-inserted Ledger row is
  fiction, and here fiction means a money bug the tests approve of.

## Notes

**Prod sequencing.** Widening a field is safe to deploy on push. *Narrowing* one
later is not — it needs the data stripped of the field in an earlier merge
(`docs/agents/project-context.md`). Confirmed with the operator: there is no plan
to narrow these back. Widen and move on.
