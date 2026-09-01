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

## Answer

**Done on prod with a real transfer, 2026-09-01. All six steps held.** The map's
Done-when is true, observed rather than inferred. Recorded from the operator's
report of the run; every claim below is something they saw on
`ywampotch.my-course.app`, not something a test asserted.

1. **Preconditions**: bank details filled and `enabled` in the prod Admin
   settings, Resend configured, so step 4 could not silently no-op.
2. **Buy**: a real buyer account, not the operator's, took Basic Tswana through
   Pay by EFT and the money moved.
3. **Confirm**: the row was in the pending-EFT queue with the right reference,
   buyer email, course, Edition and amount, and confirming it worked.
4. **The buyer's side**: the confirmation email arrived, its link opened the
   course **on the tenant host** and not the default one (ADR 0025), the course
   read, and **Awaiting payment** cleared in favour of Purchased.
5. **The money's side**: the sale is in the **Sales** tab and the seller's share
   is `owed` in **Payouts**, with `fee: 0` and `net == gross`. This is the ADR 0026
   provenance rule seen against real money for the first time; it had only ever
   been asserted in a fixture.
6. **Idempotency**: the second Confirm press was made. No second Entitlement, no
   second Ledger row, no second email. This was a **test-only claim until now**
   and is no longer.

**No faults found, so nothing to forward-fix and nothing to ticket.** That is the
outcome worth stating plainly: tickets 02 to 05 built the whole confirm side under
`convex-test` and none of it had ever run against a real transfer, so this was the
map's largest untested surface and it came back clean.

**The reference is deliberately not recorded here.** It belongs to a real buyer's
real payment and this file is committed to git. The sale is identifiable in the
prod pending-EFT queue by its 2026-09-01 date, and the operator holds the
reference. The ticket's Done-when asked for "the reference used"; the operator's
choice, made when this was resolved, is to keep it out of the repo.

With this, **the ywampotch-launch map is done**. 19 was the last open ticket and
the only one carrying the Done-when claim.
