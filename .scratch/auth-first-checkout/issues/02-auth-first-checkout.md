# 02 — Auth-first checkout: the account is the buyer

Status: done

## Parent

[PRD: Auth-first checkout + open sign-up](../PRD.md)

## What to build

`startCheckout` stops taking an email and starts requiring a caller.

- `convex/market.ts` `startCheckout`: require `getAuthUserId` (throw when anonymous);
  derive the intent email from the caller's account (`users.email`, already normalised);
  drop the `email` arg and the shape-check on it. Intent record and signed-field build
  otherwise unchanged.
- `src/app/_components/Paygate.tsx` BuyDialog: remove the email field and the
  "Buying will create an account" copy — course summary, price, one button to PayFast.
- The authed reader's Paygate keeps opening the dialog in place (routing for the share
  reader is issue 03).

## Acceptance criteria

- [ ] Unauthenticated `startCheckout` throws; no checkout-intent row is written.
- [ ] A signed-in caller's intent carries their account email — no email argument exists.
- [ ] Existing checkout gating tests (unpriced edition, unready seller) stand green.
- [ ] BuyDialog has no email input; a signed-in buyer reaches PayFast's sandbox page.
- [ ] `tsc`, tests, build green.

## Blocked by

- [01 — Open sign-up; Allowlist becomes the course-creation gate](01-open-signup-allowlist-creation-gate.md)
  (a routed Guest must be able to sign up before this flow makes sense end-to-end)

## Comments

**2026-07-12 (agent)** — Done in `fd54164`. `startCheckout` args are now
`{topicSlug, lang}` only; anonymous callers throw before any write, the intent email
is the account's (re-normalised defensively). BuyDialog is summary + price + one
button. Test count 222 → 223 (new anonymous-caller case; the bad-email case died
with the argument). tsc, tests, build green.
