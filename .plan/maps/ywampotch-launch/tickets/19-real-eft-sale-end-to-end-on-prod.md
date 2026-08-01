---
type: task
blocked_by: [18]
---

# Close the loop — one real EFT sale, end to end, on prod

> `/wayfinder .plan/maps/ywampotch-launch/tickets/19-real-eft-sale-end-to-end-on-prod.md`

## Question

**The map's Done-when has no ticket.** Tickets 02–05 built the EFT rail and 06
wrote its ADR; every one of them was verified by tests and by reading the code,
and **not one of them was ever run against prod with real money**. Ticket 18
walks the *buyer's* half and deliberately stops at the Awaiting-payment screen.
The operator's half — confirm, email, access, Sales, Payouts — has never
happened outside `convex-test`, and it is precisely the half that mints an
Entitlement and writes a Ledger row.

That gap is the whole reason this ticket exists: the map's Done-when is a single
end-to-end claim on prod, and closing 18 does not close it.

Do it once, with a real (small, if you like) transfer to the operator's own
account, on `ywampotch.my-course.app`:

1. **Preconditions.** The bank-details settings record is filled in and
   `enabled` on prod (ticket 02) — check the Admin settings, not the code — and
   Resend is configured, or step 4 will silently no-op by design (ticket 05).
2. **Buy.** As a real buyer account that is *not* the operator's, take Basic
   Tswana through Pay by EFT and note the reference. Transfer the money.
3. **Confirm.** As sys admin, find the row in the pending-EFT queue: does it show
   the right reference, buyer email, course, Edition and amount? Confirm it.
4. **The buyer's side.** The confirmation email arrives, its link opens the
   course **on `ywampotch.my-course.app`** and not the default host (ADR 0025),
   the course is readable, and **Awaiting payment** has cleared from the overview
   in favour of Purchased.
5. **The money's side.** The sale appears in the **Sales** tab and the seller's
   share is `owed` in **Payouts**, with `fee: 0` and `net == gross` — the ADR 0026
   provenance rule, seen for real rather than asserted in a fixture.
6. **Idempotency, cheaply.** Press Confirm a second time on the same row (or
   re-open the queue): no second Entitlement, no second Ledger row, no second
   email. This is claimed by tests only.

If any step fails, forward-fix — no rollback is armed (ticket 15) — and record
what broke, because a fault here is a money fault, not a presentation one.

## Done when

The full Done-when sentence at the foot of the map is true, observed rather than
inferred: a real buyer paid by EFT, the operator confirmed, the buyer got the
email and the course on the tenant host, and the sale is visible in Sales and
`owed` in Payouts. Any fault found is fixed or ticketed, and the map's Done-when
is marked verified with the date and the reference used.
