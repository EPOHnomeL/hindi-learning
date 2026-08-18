---
type: task
blocked_by: [02]
---
# Redeem a Voucher

## Question

Can a member of the organisation turn a code into permanent access, **without anyone learning that
they did**?

This is the ticket the whole feature exists for, and it is defined as much by what it refuses to
record as by what it grants. Read
[ADR 0029](../../../../docs/adr/0029-seller-minted-voucher-rail.md) before starting; two of the
rules below look like oversights and are not.

**It mints onto the signed-in caller and takes no email.** `redeem` accepts a code and reads the
caller from `ctx.auth`. A Guest is refused. There is **no email argument** - accepting one would
rebuild the impersonation hole
[ADR 0021](../../../../docs/adr/0021-open-signup-allowlist-gates-course-creation.md) closed by
deleting `pendingEntitlements` and claim-on-sign-up. The member signs up with an address of their
own choosing, which is exactly how the organisation's list stays undisclosed.

**It records nothing about who redeemed.** The voucher row gets `redeemedAt` and no user id. And
the minted Entitlement carries **no voucher provenance** - no batch id, no voucher id, no
`pfPaymentId`, no `eftRef` - so it is byte-identical to an Admin comp. Both halves are needed: with
provenance on the Entitlement, the operator could list the redeemers by elimination and the
anonymity would be theatre. Assert the *absence* positively in a test, so that a future refactor
adding a `batchId` back fails loudly instead of quietly ending the feature.

**It refuses without consuming whenever it would grant nothing** - the caller already holds an
Entitlement for that Edition, holds a grandfathered Enrollment on it, or owns the course. Burning
the code in those cases would spend a seat the organisation paid for in exchange for nothing, and
`grantEntitlement` already treats a duplicate as a no-op, so this matches the house style.

## Done when

- `vouchers.redeem` takes a code and nothing else, and mints an Entitlement for `(caller, topicId,
  lang)` from the code's batch, setting `redeemedAt` on the voucher.
- The minted Entitlement has no `pfPaymentId`, no `eftRef`, and no voucher field - asserted
  positively in `convex/vouchers.test.ts`, with a comment naming the ADR so nobody deletes the
  assertion as redundant.
- The voucher row after redemption holds `redeemedAt` and no user id.
- Refusals, each a server-side throw with a message a stranger can act on: unknown code (a typo is
  distinguishable from a dud), already-redeemed code, a Guest caller, a voided batch's unredeemed
  code.
- Refuse-**without**-consuming, asserted three ways - caller already holds an Entitlement, holds an
  Enrollment on that Edition, owns the course - each leaving `redeemedAt` unset so the code stays
  redeemable by somebody else.
- A code works regardless of its batch's payment state. There is a test that says so, because the
  opposite is the intuitive assumption.
- An already-redeemed seat is untouched by anything: no path revokes it.
- `convex/lib.ts`'s grant walk is **unchanged** - a voucher mints an ordinary Entitlement and the
  walk already treats its presence as access. Editing the walk means the design has drifted.
- No UI in this ticket; `/redeem` is ticket 06.

## Answer
