# ywampotch-launch/02: Operator bank details as an admin-editable settings record

**Status:** open

## Why

The manual EFT rail needs somewhere to keep the **operator's collection** bank
details and a switch to turn the rail on. The existing `bankAccounts` table is
the wrong home — that holds a *Seller's payout* account (where the operator EFTs
money **to**), which is a different concept, per-seller, and already in use.

The operator's collection account is global and singular: money always lands in
one account regardless of which tenant sold the course.

## Scope

- A **single global settings record**, sys-admin-only to edit. Fields: bank name,
  account name, account number, branch code, `enabled` (explicit on/off toggle).
- An editor in `src/app/_components/AdminPanel.tsx`. Reuse an existing tab rather
  than adding a sixth unless it reads badly there.
- Write path gated on `isCallerAdmin(ctx)` with **no tenant argument** — sys
  admin, not tenant admin. A tenant admin must not be able to change where the
  platform's money is collected.
- A read for the buyer-facing paygate that returns the details only while
  `enabled` is true.

## Out of scope

- Per-tenant or per-course bank details. Money lands in one account either way;
  there is nothing tenant-specific to configure. Build it when a second course
  wants a different answer.
- Validating the account number against a real bank. Out of reach and not worth
  faking.

## Acceptance criteria

- A sys admin can view and edit all five fields on prod without a deploy.
- A **tenant** admin cannot read or write the record through any exposed
  function. Assert the negative server-side, not just the absence of a button.
- With `enabled` false, the buyer-facing read returns nothing.

## Tests

- The authorisation negative (tenant admin rejected) is the important one — write
  it first.
- Seed the admin rows the way `whitelist` actually writes them; don't invent a row
  shape.

## Notes

The buyer-facing read exposes bank details to **any signed-in user** while the
rail is enabled. That is intentional — bank details are printed on invoices, not
secret — but it is a deliberate disclosure decision. State it in the query's
comment so a future reader doesn't "fix" it as a leak, or tighten it deliberately.

A prior recommendation was Convex env vars mirroring `payfastConfigured` (no UI,
no deploy to change). The operator chose an editable record for self-sufficiency
on prod. Recorded so the trade is visible — not to relitigate it.
