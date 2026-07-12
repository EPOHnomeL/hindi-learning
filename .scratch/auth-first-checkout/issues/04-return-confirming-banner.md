# 04 — Return UX: confirming banner, reactive unlock

Status: open

## Parent

[PRD: Auth-first checkout + open sign-up](../PRD.md)

## What to build

The buyer returns from PayFast signed in — replace the post-payment sign-up flow with a
confirming state that resolves itself.

- `CoursePanes.tsx` `CourseIndex`: the root redirect must **carry the query string**
  through `router.replace` (today it rebuilds the URL keeping only `lang`, which would
  drop `purchase=return&mp=…` and the banner would never show).
- Authed reader: while `purchase=return&mp` is present and `market.checkoutStatus` is not
  `granted`, show a small "Confirming your payment — this usually takes a few seconds"
  banner. Entitlement queries invalidate when the ITN writes; content unlocks in place
  and the banner disappears. No timeout/failure branch (ponytail — support owns the freak
  case).
- `SignIn.tsx`: delete the locked-email machinery — the `checkoutStatus` wiring, the
  prefilled/read-only email, the paid-state panels, the flow-steering effect. (The
  backend shrink of `checkoutStatus` itself is issue 05.)

## Acceptance criteria

- [ ] The CourseIndex redirect preserves `purchase`/`mp` (pinned by test where cheap, else a recorded manual verify).
- [ ] Returning with the ITN not yet landed shows the banner over the (still locked) reader.
- [ ] When the ITN lands, content unlocks without refresh and the banner goes.
- [ ] SignIn has no locked-email/checkout state left.
- [ ] `tsc`, tests, build green.

## Blocked by

- [02 — Auth-first checkout: the account is the buyer](02-auth-first-checkout.md)
