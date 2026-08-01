---
type: task
blocked_by: [13, 14]
---

# Launch risk — rollback story and the prod walk-through

> `/wayfinder .plan/maps/ywampotch-launch/tickets/15-checkout-page-launch-risk-and-prod-walk.md`

## Question

This strand replaces the entry to the surface every Rand flows through, days
before YWAM Potch goes live, on a repo where pushing `main` deploys prod. Five
real purchases have already completed through the old dialog. That earns an
explicit risk pass rather than a hope.

- **Rollback.** If the checkout page is broken on prod at 9pm, what is the
  fastest safe undo? A revert of the strand's commits, or a flag that falls back
  to the dialog? (A flag means keeping `BuyDialog` alive, which ticket 13
  deliberately deletes — so this is a real trade, not a free safety net.)
- **The walk-through, on prod, on a real phone**, both entry paths and both
  rails: share link → sign in → page → EFT reference and bank details; and
  signed-in → page → PayFast redirect. This is the same walk ticket 07 needs;
  do them together rather than twice.
- **What breaks quietly.** The PayFast return redirect and the payment-return
  banner in `CourseShell` both assume where a buyer came from. Confirm the
  return lands somewhere sensible from the new route.
- **The other tenants.** Ticket 14 touches `SignIn`, which every signed-out
  visitor on every tenant sees. Check one non-YWAM tenant's signed-out view
  before this is called done.

## Done when

A rollback route is decided and written down. The full walk-through is done on
prod, on a phone, both entry paths and both rails, and the operator has signed
off. The PayFast return lands correctly from the new route. One non-YWAM tenant's
signed-out view is confirmed unbroken.
