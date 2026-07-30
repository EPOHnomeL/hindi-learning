---
type: task
blocked_by: []
---

# Operator bank details as an admin-editable settings record

## Question

The manual EFT rail needs somewhere to keep the **operator's collection** bank
details and a switch to turn the rail on. The existing `bankAccounts` table is
the wrong home — that holds a *Seller's payout* account (where the operator EFTs
money **to**), a different concept, per-seller, already in use. The operator's
collection account is global and singular: money always lands in one account
regardless of which tenant sold the course.

Scope:

- A **single global settings record**, sys-admin-only to edit. Fields: bank name,
  account name, account number, branch code, `enabled` (explicit on/off toggle).
- An editor in `src/app/_components/AdminPanel.tsx`. Reuse an existing tab rather
  than adding a sixth unless it reads badly there.
- Write path gated on `isCallerAdmin(ctx)` with **no tenant argument** — sys
  admin, not tenant admin. A tenant admin must not be able to change where the
  platform's money is collected.
- A read for the buyer-facing paygate that returns the details only while
  `enabled` is true.

Out of scope: per-tenant or per-course bank details; validating the account
number against a real bank. Write the authorisation negative (tenant admin
rejected) first, server-side. Seed the admin rows the way `whitelist` actually
writes them; don't invent a row shape.

The buyer-facing read exposes bank details to **any signed-in user** while the
rail is enabled. That is intentional — bank details are printed on invoices, not
secret — but it is a deliberate disclosure decision. State it in the query's
comment so a future reader doesn't "fix" it as a leak. (A prior recommendation
was Convex env vars mirroring `payfastConfigured`; the operator chose an editable
record for self-sufficiency on prod. Recorded so the trade is visible.)

## Done when

A sys admin can view and edit all five fields on prod without a deploy; a
**tenant** admin cannot read or write the record through any exposed function
(asserted server-side, not just the absence of a button); and with `enabled`
false the buyer-facing read returns nothing.

## Answer

Built 2026-07-29 (`2632b7e`) to the scope above: a single global settings record
with bank name, account name, account number, branch code and an explicit
`enabled` toggle, edited in `AdminPanel.tsx`, with the write path gated on
`isCallerAdmin(ctx)` and no tenant argument, and a buyer-facing read that returns
the details only while `enabled` is true. The intentional disclosure of bank
details to any signed-in user while enabled is documented in the query's comment.
