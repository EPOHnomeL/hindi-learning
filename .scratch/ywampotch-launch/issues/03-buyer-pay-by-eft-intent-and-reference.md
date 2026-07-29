# ywampotch-launch/03: Buyer flow — "Pay by EFT" intent + reference

**Status:** open
**Depends on:** [02](02-operator-bank-details-settings-record.md)

## Why

Buyers are abandoning at the gateway. A direct bank transfer removes the gateway
from the objection, but only works if the money that arrives can be matched back
to a person and an Edition. The reference is the whole mechanism: without one, the
operator receives a transfer labelled with someone's surname and has to work out
by hand who bought which Edition in which language. That is the step that breaks
first, and it breaks silently, in money.

## Scope

- On a priced Edition's paygate (`src/app/_components/Paygate.tsx`), alongside the
  existing PayFast button and **only when the EFT rail is enabled**: a
  **"Pay by EFT"** action.
- Clicking it writes an intent row and shows the buyer the operator's bank details
  plus **their own unique reference**.
- **New table `eftIntents`:** `{ ref, userId, topicId, lang, amount, status:
  "pending" | "confirmed" | "dismissed" }`, indexed by `ref` and by `status`.
- **Reference format:** short, human-readable, unambiguous on a bank statement —
  e.g. `TSW-4F2K` (topic-derived prefix + random suffix). Unique. Avoid
  characters that collide when handwritten or read aloud.
- Requires a signed-in account, exactly as PayFast checkout does (auth-first,
  ADR 0021) — the intent is keyed to a user, and access has to attribute to one.
- In-app **pending state** for a buyer who returns before confirmation, following
  the reactive pattern `market.checkoutStatus` already uses for the
  awaiting-payment banner.

## Out of scope

- Proof-of-payment upload. The reference is the matching key; an upload adds a
  buyer step and a storage surface for something the bank statement already tells
  the operator.
- Any change to the PayFast path.

## Acceptance criteria

- With the rail disabled, no EFT affordance appears anywhere.
- Clicking Pay by EFT yields a reference that is unique across existing intents,
  and the same buyer clicking twice on the same Edition does not silently create
  a second competing reference.
- The reference the buyer sees is the reference stored on the row.
- A buyer who leaves and returns sees a pending state, not the bare paygate — the
  paygate reappearing reads as "my payment failed".
- The buyer gets **no access** at this point. An intent is not a grant.

## Tests

- Reference uniqueness and format.
- Rail-disabled hides the affordance **server-side**, not only in the component.
- No entitlement is created by intent creation — assert the negative.
- Fixtures must be states production can produce: create intents through the
  mutation, never by hand-inserting rows.

## Notes

**Deviation from the grilling, deliberate.** The agreed shape was to reuse
`checkoutIntents`. On inspection that table sits on the live ITN path
(`market.checkoutIntentByRef`, `market.fulfillPurchase`) and has no status field —
adding one plus an EFT reference means editing a table that currently carries 5
real purchases' worth of working money path. A separate table is less code than
widening it and has zero blast radius on PayFast. Same shape, different table.
