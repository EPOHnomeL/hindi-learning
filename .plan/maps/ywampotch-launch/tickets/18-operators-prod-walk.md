---
type: task
blocked_by: [15]
---

# The operator's prod walk — both entry paths, both rails, on a phone

> `/wayfinder .plan/maps/ywampotch-launch/tickets/18-operators-prod-walk.md`

## Question

Four tickets stand "operator's walk pending" — [13](./13-move-purchase-out-of-buydialog.md)
(the page itself), [16](./16-eft-dead-end-and-awaiting-payment.md) (the way out
and the waiting room), [17](./17-payment-complete-moment-on-card-return.md) (the
card buyer's receipt) and [14](./14-phone-first-pass-locked-card-and-signin.md)
(the 320px phone pass). None of them was ever seen in a browser by the person
whose taste is the bar. This is that walk, once, covering all four.

[15](./15-checkout-page-launch-risk-and-prod-walk.md) settled everything a
session could settle alone, and wrote this ticket around a sequencing constraint
that **no longer exists**: it recorded ticket 14's `00c78c5` as unpushed, so the
walk was split into prod-as-is and then a re-walk after the deploy. `00c78c5` has
since been pushed — it is an ancestor of `origin/main`, and prod has moved several
commits past it (the marketplace donation rail rode the same branch). **The two
passes collapse into one**: everything the strand built, 14's phone treatment
included, is live right now. Nothing here is gated on a push any more.

This is judged by the operator's eye. There is no rubric; taste is the bar and it
is theirs. 15 also established the standing decision that **there is no armed
rollback** — findings here are forward-fixed.

### The walk — prod as it stands (all of 13, 14, 16, 17 live)

On a **real phone**, on `ywampotch.my-course.app`:

1. **Share link, signed out** → the checkout URL directly. `SignIn` should render
   *at that URL* with the four-step rail (Create account → Choose method → Pay →
   Continue), step 1 lit. Sign in with Google; you should land back on the
   checkout page, not the dashboard.
2. **Signed in, published site** → Basic Tswana → the locked card → the CTA is a
   link now, no dialog. Same page, rail at step 2.
3. **EFT rail**: choose South African bank transfer. Reference and bank details
   readable and select-all copyable without pinching. Take the **"Done"** exit
   (16) → the overview should show an **Awaiting payment** section above
   Purchased, carrying the reference, and Basic Tswana must **not** also appear
   under Available at full price.
4. **Card rail**: a real PayFast purchase, or re-read the one already completed.
   On return you should get the **Payment complete** panel (17) — check mark and
   a start CTA — not the generic Welcome, and not a bare lesson.
5. **Cancel** out of PayFast once: 15 verified in code that you land on the
   *course page* with the Preview readable, not a bare index. Confirm it reads
   that way.
6. **One non-YWAM tenant, signed out** — `upf`, `almighty-warriors` or `yknot`.
   15 confirmed 14's `SignIn` diff is class strings only, so this is a look-see
   for ugliness, not a functional gate.

7. **The 320px check, in the same sitting** — 14's fix is arithmetic, never
   measured, so use the **smallest phone you can find** on the two screens it
   changed: the sign-in screen with the rail (does it overflow?), and the locked
   card where the price now sits above a full-width CTA.
8. **Ticket 01's brand check, still owed.** [07](./07-prod-verify-security-fixes.md)
   cleared the whitelabel list but explicitly left this one undone, and 01 is
   closed, so it has nowhere else to live. On `ywampotch.my-course.app`: the
   tenant logo and "YWAM Potch" on **sign-in, dashboard, course reader and public
   reader**, no layout regression at phone width; and on the default host all four
   still say "My Course" with the book logo. Steps 1–6 already put you on three of
   the four — this is mostly a look, not a separate trip.

## Done when

The walk is done on prod on a real phone and the operator has said what to
change, or that they're happy. Whatever they name is either fixed or ticketed.
Tickets 13, 14, 16 and 17 lose their "walk pending" note on the map, and ticket
01's brand check stops being owed.

This walk stops at **Awaiting payment** — the buyer's half. The operator's half
(confirm the intent, the email, the Entitlement, the Sales row and the Payouts
`owed`) is [19](./19-real-eft-sale-end-to-end-on-prod.md), which is the map's
Done-when claim in full.
