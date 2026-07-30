---
type: task
blocked_by: [02]
---

# Buyer flow — "Pay by EFT" intent + reference

## Question

Buyers are abandoning at the gateway. A direct bank transfer removes the gateway
from the objection, but only works if the money that arrives can be matched back
to a person and an Edition. The reference is the whole mechanism: without one the
operator receives a transfer labelled with someone's surname and has to work out
by hand who bought which Edition in which language. That step breaks first, and
it breaks silently, in money.

Scope:

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
  ADR 0021) — the intent is keyed to a user.
- In-app **pending state** for a buyer who returns before confirmation, following
  the reactive pattern `market.checkoutStatus` already uses for the
  awaiting-payment banner.

Out of scope: proof-of-payment upload; any change to the PayFast path.

**Deviation from the grilling, deliberate.** The agreed shape was to reuse
`checkoutIntents`. On inspection that table sits on the live ITN path
(`market.checkoutIntentByRef`, `market.fulfillPurchase`) and has no status field —
adding one plus an EFT reference means editing a table that currently carries 5
real purchases' worth of working money path. A separate table is less code than
widening it and has zero blast radius on PayFast. Same shape, different table.

## Done when

With the rail disabled, no EFT affordance appears anywhere (enforced
server-side, not only in the component). Clicking Pay by EFT yields a reference
unique across existing intents; the same buyer clicking twice on the same Edition
does not silently create a second competing reference; the reference the buyer
sees is the reference stored on the row; a buyer who leaves and returns sees a
pending state, not the bare paygate; and no entitlement is created by intent
creation (asserted as a negative). Fixtures are created through the mutation,
never by hand-inserting rows.

## Answer

Built 2026-07-29 (`3adb7e6`) to the scope above: a "Pay by EFT" action on the
priced-Edition paygate shown only when the rail is enabled, writing a row to a
new `eftIntents` table (`{ ref, userId, topicId, lang, amount, status }`, indexed
by `ref` and `status`) and returning the operator's bank details plus a short
human-readable reference (topic-prefix + random suffix). Requires a signed-in
account; a returning buyer sees the reactive pending state via the
`market.checkoutStatus` pattern; intent creation grants no access. `checkoutIntents`
and the PayFast path were left untouched by using the separate `eftIntents` table.
