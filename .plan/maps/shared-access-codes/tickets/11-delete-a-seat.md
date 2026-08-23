---
type: task
blocked_by: [03]
---
# Delete a Seat

> `/wayfinder .plan/maps/shared-access-codes/tickets/11-delete-a-seat.md`

## Question

POPIA s11 gives a member the right to withdraw consent, and s27(1)(a) consent is the entire legal
basis for this rail. A withdrawal right that cannot be exercised is not a right, and the `seats` row
is the one place the link between a person and the organisation's cohort exists, so deleting it is
the meaningful act.

**The seat count must not move.** The bill is for seats consumed during the agreement, and a member
withdrawing afterwards did consume one. If deletion decremented the count, a member could reduce an
invoice the organisation already agreed to, and worse, the number would change under an operator who
had already raised it. The cap ledger and the personal link are two different facts, and only one of
them is being deleted.

That means the count has to survive as something durable that is not personal, which is the real
design question in this ticket rather than the deletion itself.

## Done when

- A member holding a Seat can delete it, and the `seats` row is gone: no nickname, no userId, no link
  to the organisation.
- The derived seat count for that Access Code is **unchanged**, asserted before and after.
- Whatever carries the count after deletion is not personal information, and the schema comment says
  why.
- The member's Entitlement is untouched by default. Losing access is a separate choice, and the flow
  makes clear which one they are making.
- Deleting a Seat either frees the nickname for reuse or retires it permanently. The ticket picks
  one and the answer says why: reuse lets a stranger claim a departed member's handle, and
  retirement leaves a tombstone that is arguably still a record.
- The credential stops working immediately, asserted.
