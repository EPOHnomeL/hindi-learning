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


## Answer

Built as `accessCodes.deleteMySeat`. The real design question was the one the ticket named, and the
answer is a **strip rather than a delete**.

**Three things happen, and the third is the one nobody expects.**

1. **The `seats` row is stripped, not deleted.** `userId` and `nicknameKey` go (patched to
   `undefined`, so the fields are genuinely absent rather than blank); `consentedAt` and
   `consentVersion` stay. What is left says "one seat was consumed on this code" and nothing about
   who consumed it. **That is what carries the count, and it is not personal information** because it
   identifies nobody: the schema comment says so and why. The count must not move, because the bill is
   for seats consumed during the agreement and this member did consume one. A decrement would let a
   member reduce an invoice the organisation already agreed to, and worse, change a number under an
   operator who had already raised it. Asserted before and after (2 seats, R300.00 both times), and
   then asserted again by stopping the code and reading the Ledger row at `gross: 30000`.
2. **The `authAccounts` row is deleted**, which is what makes the credential stop working
   immediately. It **has** to go: `providerAccountId` is `${accessCodeId}:${nicknameKey}`, so leaving
   it would leave the nickname and the link to the organisation sitting in plain text, which is
   exactly what was asked to be forgotten. Asserted: coming back with the right nickname and PIN gives
   `access/pin-wrong`.
3. **The Entitlement is left alone, and the honest consequence of (2) is that the account becomes
   unreachable.** The member keeps the course on the device they are holding, for as long as this
   sign-in lasts (365 days here), and cannot sign in again anywhere else. This is not a bug to
   engineer around: the credential **is** the personal link, so keeping one means keeping the other.
   `SeatSettings`'s confirm says it in those words, because a member who was not told will reasonably
   believe they can come back. That is the "which one they are making" the ticket asked the flow to
   make clear.

**The nickname is freed for reuse, and the ticket asked for a reason.** Retiring it permanently means
keeping the handle in a tombstone, and a kept handle is arguably still a record of the person who
asked to be forgotten, which defeats the act. The cost is that a stranger can later claim a departed
member's handle on the same code, and that cost is affordable precisely because the handle was never a
real name. Asserted: after a deletion, `Thandi` can be claimed again, it **consumes a new seat**
(correct: a different person taking a place, on top of a place already consumed during the
agreement), and the departed member's PIN does not reach the newcomer's seat.

Deleting twice is harmless. `accessCodes.mySeat` returns null afterwards, so the controls disappear
on their own.

One shape worth flagging for whoever reads the schema cold: **`seats.userId` and `seats.nicknameKey`
are optional**, and they look wrong that way until you reach this ticket. The schema comment carries
the reasoning at the field, so nobody narrows them back.
