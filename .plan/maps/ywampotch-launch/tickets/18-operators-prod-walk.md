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
session could settle alone and found the sequencing constraint this ticket runs
on: **ticket 14's code (`00c78c5`) is not on prod**, and pushing it *is* the
deploy. The operator chose to **walk prod as-is first, then push, then re-walk
the phone treatment**. Two passes, deliberately — the first one leaves the known
rollback target untouched.

This is judged by the operator's eye. There is no rubric; taste is the bar and it
is theirs. 15 also established the standing decision that **there is no armed
rollback** — findings here are forward-fixed.

### Pass 1 — prod as it stands now (deployment `344c933`)

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

### Pass 2 — after pushing `00c78c5`

7. **Before pushing**, note the current rollback target in the Vercel dashboard;
   **after** the build, re-check that a pre-strand candidate is still reachable.
   15's hatch (`ae3f1d3`) was the only one, and a push may move it.
8. Re-walk the two screens 14 actually changed, on the **smallest phone you can
   find** — the rail overflow it fixed is arithmetic, never measured: the
   sign-in screen with the rail, and the locked card where the price now sits
   above a full-width CTA.
9. The same non-YWAM tenant again, since `SignIn` is what 14 touched.

## Done when

Both passes are walked on prod on a real phone and the operator has said what to
change, or that they're happy. Whatever they name is either fixed or ticketed.
Tickets 13, 14, 16 and 17 lose their "walk pending" note on the map.
