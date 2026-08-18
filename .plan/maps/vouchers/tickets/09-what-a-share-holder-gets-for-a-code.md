---
type: task
blocked_by: [03]
---
# What a Share holder gets for a code

## Question

`redeem` refuses without consuming for three holdings: an Entitlement on the Edition, a
grandfathered Enrollment, and owning the course. A **Share** is not among them, so a Share holder
who redeems spends the code. Built as specified rather than widened on the day, and the code review
flagged it as possibly a wasted seat.

Both readings are arguable and that is exactly why it needs deciding rather than drifting. Widen it
and a Share holder is told to keep their code, having been protected from spending it on access
they already had. Leave it and the organisation paid for a seat that went to somebody who could
already read the thing.

The question underneath is what "already has access" means, and the answer has to be a rule rather
than an enumeration, because a fourth grant kind will arrive one day and somebody will have to know
which side of the line it falls on.

## Done when

- The rule is stated in a sentence that decides future grant kinds, not just Shares.
- `vouchers.redeem` matches the rule, and the behaviour is pinned by a test that fails if a later
  session flips it by accident.
- The reasoning lives next to the code, so the next reader does not re-open it.

## Answer

**Decided 2026-08-18: a Share holder redeeming DOES spend the code, and the behaviour is
unchanged.** Verified by reading the code and by a new test at the Convex function boundary.

The rule: **the three refusals are the PERMANENT holdings.** Ownership, an Entitlement and a
grandfathered Enrollment all survive anything the course owner subsequently does. A Share does not
(the owner revokes it), and neither does access to a free published Edition (the owner unpublishes
or prices it, and `grantsFor` computes that access live rather than storing it). So a Share holder
who redeems converts revocable access into an Entitlement nobody can take away. That is not
nothing, so the seat is not wasted and the code is rightly spent. Redeeming on top of one of the
three permanent holdings, by contrast, really would buy the member nothing, which is the whole
reason those three refuse.

The rule decides the next grant kind too, which is why it is phrased this way and not as a list:
ask whether the caller keeps this access when the owner changes their mind. No means the
Entitlement is worth having, so let the code be spent.

Pinned by `convex/vouchers.test.ts`, "a Share holder redeeming DOES spend the code, and gains
something by it": the voucher ends up with a `redeemedAt`, the viewer ends up with exactly one
Entitlement, and that Entitlement still has the same five keys as every other voucher seat, so the
privacy assertion covers this path too. A later session that widens the refusal to Shares will fail
this test and be sent here.

No ADR was written. [ADR 0029](../../../../docs/adr/0029-seller-minted-voucher-rail.md) never
decided this either way, so there is nothing to supersede: this is the ticket that answers a
question the ADR left open, and the map's index is where it is recorded.
