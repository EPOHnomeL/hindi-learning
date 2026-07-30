---
type: task
blocked_by: [03]
---

# Admin confirm queue — grant + Ledger row

## Question

This is where an EFT becomes access. It also has to make a manual sale **visible
to the money surfaces** — the Sales tab and Payouts — which the existing
`market.grantEntitlement` does not, because it writes no Ledger row. A sale the
operator can't see is a sale the seller doesn't get paid for.

Scope:

- A **pending-EFT list** in `src/app/_components/AdminPanel.tsx`. Reuse the
  Payouts or Sales area; add a sixth tab only if it genuinely reads badly. Each
  row: reference, buyer email, course, Edition, amount.
- **Confirm** — one mutation, atomically minting the Entitlement **and** writing
  the Ledger row, mirroring `market.fulfillPurchase`'s ordering and idempotency
  guarantees. `fee: 0`, `net == gross` (no gateway took a cut), split 50/50 via
  the existing `splitNet`. Idempotent per reference **and** per
  `(buyer, Topic, language)`.
- **Dismiss** — marks an intent that never got paid. Stale intents are litter,
  not errors; without a dismiss the queue silts up and stops being read.
- Sys-admin only, same gate as [02](02-operator-bank-details-settings-record.md).

Schema change: `ledger.pfPaymentId` is currently **required**
(`convex/schema.ts`), and an EFT sale has no PayFast id. Widen it to optional and
add optional `ledger.eftRef`; add optional `entitlements.eftRef` (its
`pfPaymentId` is already optional). **Exactly one** of the two is present on any
row — that is what gives every Entitlement and Ledger row unambiguous provenance
back to the rail that sold it.

Out of scope: automatic bank-statement matching or a bank feed; changing how
payouts work (a confirmed EFT sale becomes an ordinary `owed` Ledger row and
flows through the existing Payouts tab untouched).

## Done when

Confirming mints exactly one Entitlement and one Ledger row and moves the intent
to `confirmed`; confirming the same reference twice is a no-op; confirming for a
buyer who already holds that Edition creates no second Entitlement (falls out of
the `(buyer, Topic, language)` idempotency — **decided by the operator
2026-07-29**: no code, branch or warning for this rare collision, whatever the
guard naturally does is correct); the Ledger row's `sellerShare + platformShare`
equal `net` and `net == gross`; the sale appears in the Sales tab and as `owed`
in Payouts; dismissing removes the intent and grants nothing; and a tenant admin
can do neither (asserted server-side). Idempotency on both keys is written first;
every fixture is built through the real mutations.

## Answer

Built 2026-07-29 (`eb6a836`) to the scope above: a pending-EFT list in
`AdminPanel.tsx` with per-row reference, buyer email, course, Edition and amount,
plus Confirm and Dismiss actions, sys-admin gated. Confirm mints the Entitlement
and writes the Ledger row atomically in one mutation, mirroring `fulfillPurchase`'s
ordering and idempotency (`fee: 0`, `net == gross`, split 50/50 via `splitNet`),
idempotent per reference and per `(buyer, Topic, language)`. Schema widened:
`ledger.pfPaymentId` is now optional with an added optional `ledger.eftRef`, and
`entitlements.eftRef` added — exactly one of the two present per row for
provenance. Widening only; per the operator there is no plan to narrow these back.
