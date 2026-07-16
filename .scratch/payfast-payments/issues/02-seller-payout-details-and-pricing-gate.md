# 02 — Seller readiness = payout bank details + ZAR pricing gate

Status: done

## Parent

[PRD: PayFast Payments](../PRD.md)

## What to build

The complete seller side, with no money movement yet: an author becomes a ready
**Seller** by being granted `can-sell` and saving payout bank details, and can then price
a finished course's **Edition** in Rand.

- Admin `grantCanSell` / `revokeCanSell` stay Admin-only (revoke stops new pricing but
  leaves sold Entitlements and existing listings intact).
- A granted author can save SA payout bank details in-app (account holder, bank, account
  number, branch code). Details are Admin-readable (needed to pay out) but never returned
  by any non-admin query and never logged.
- `sellerStatus` (self) drives the UI: `not-granted | granted-no-payout-details | ready`.
- `setEditionPrice` guards on **ready Seller** (grant + bank details) **and** a
  `completed` course, and accepts **ZAR only** (reject any other currency); amount stays
  in cents. `clearEditionPrice` remains owner-only.

## Acceptance criteria

- [ ] An Admin can grant and revoke `can-sell`; both reject a non-admin caller.
- [ ] A granted author can save and update bank details; a non-granted user cannot.
- [ ] `sellerStatus` returns `ready` only once both the grant and bank details exist.
- [ ] Pricing is rejected for: a non-Seller, a granted Seller with no bank details, a
      non-`zar` currency, and a non-`completed` course.
- [ ] A ready Seller can price and re-price a completed course's Edition in ZAR, and clear it.
- [ ] Bank details are not present in the payload of any non-admin query.
- [ ] Tests cover the gating truth table and the bank-details round-trip; `tsc`/tests green.

## Blocked by

- [01 — Prefactor: rip out Stripe, land the PayFast schema + pure module](01-prefactor-payfast-schema-and-module.md)

## Comments

**2026-07-10 (agent)** — Done in `09be119`. `savePayoutDetails` (granted-only, write-only;
digits-validated), `listSellers` carries the details (the ONLY read that returns them),
ZAR-only `setEditionPrice`, bank-details form + ZAR price editor in Editions.
