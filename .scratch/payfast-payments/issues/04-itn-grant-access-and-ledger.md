# 04 — ITN → grant access + write the Ledger

Status: done

## Parent

[PRD: PayFast Payments](../PRD.md)

## What to build

The money-in seam: PayFast's server-to-server **ITN** is the sole grantor of access, and
each sale records what the operator owes the author.

- `POST /payfast/notify` (HTTP action) verifies the notification in three steps before
  trusting it: **inline-MD5 signature** (via `payfast.ts`), **amount match** against the
  stored listing for the Edition, and a **server postback** to PayFast's
  `/eng/query/validate` requiring a `VALID` response. The source-IP allowlist check is
  deliberately skipped. Only a `payment_status` of `COMPLETE` grants.
- On success it calls the idempotent `fulfillPurchase`, keyed on **`pf_payment_id`**
  (recorded in `payfastEvents`; a re-delivery is a safe no-op).
- `fulfillPurchase` mints a real **Entitlement** (if an account exists for the paid email)
  or an email-keyed **pending Entitlement** (guest), carrying `pf_payment_id`, and — in the
  same transaction — writes the **Ledger** row from the ITN's `amount_net`
  (gross / fee / net / author 50% / platform 50% / status `owed`). A pending Entitlement
  admits the email past the Allowlist (unchanged).

## Acceptance criteria

- [ ] A missing or forged-signature ITN → 400 and nothing is written (no `payfastEvents`
      row, no Entitlement, no Ledger row).
- [ ] A postback that does not return `VALID` → rejected, nothing written (validate `fetch`
      mocked at the action boundary).
- [ ] An ITN whose amount doesn't match the stored listing → rejected.
- [ ] A genuine `COMPLETE` ITN grants access once and is idempotent on `pf_payment_id`
      (replay is a no-op).
- [ ] Account exists → Entitlement; no account → pending Entitlement claimed later; both
      language-scoped.
- [ ] The Ledger row records gross/fee/net and a 50/50 split of `amount_net`, status `owed`.
- [ ] `fulfillPurchase` tests run without network; the HTTP boundary tests cover the reject
      paths; green.

## Blocked by

- [01 — Prefactor: rip out Stripe, land the PayFast schema + pure module](01-prefactor-payfast-schema-and-module.md)
- [03 — Checkout initiation: signed PayFast form fields](03-checkout-initiation-signed-payfast-fields.md)

## Comments

**2026-07-10 (agent)** — Done in `a057de8`. `/payfast/notify` verifies signature (received
order) → COMPLETE gate → amount match → postback VALID, then idempotent `fulfillPurchase`
(entitlement + Ledger in one transaction). Follow-up flagged by review: re-pricing/clearing
between Buy and ITN makes a genuine COMPLETE ITN 400 forever (money in, no grant, no
record) — spec-induced; consider logging rejected-but-signed ITNs or matching against the
checkout-intent's amount instead. NOT yet driven against the live sandbox.

**2026-07-10 (agent, follow-up fixed)** — Operator confirmed "if a user owns they own":
the amount match (and the grant's topic/lang/email) is now anchored to the
**checkout-intent** — the price frozen at the Buy click — instead of the live listing,
so a re-price/un-list between Buy and payment never strands a genuine payment. An ITN
whose `m_payment_id` resolves to no intent is rejected outright. PRD annotated; tests
pin the re-price/un-list path and the unknown-reference rejection.
