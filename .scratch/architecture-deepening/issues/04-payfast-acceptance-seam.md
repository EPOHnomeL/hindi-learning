# architecture-deepening/04: Name the PayFast ITN acceptance rules as their own seam

**Status:** closed (landed on `main`)
**Labels:** —

## Why

`convex/http.ts:29-91` (`payfastNotify`) has asymmetric depth. The mechanical parsing
(`verifySignature`, `centsFromRand`, `pfParamString`) is a deep, pure module in `convex/payfast.ts`.
But the actual money-acceptance rules — "only `COMPLETE` grants" (`http.ts:43`) and "amount must
match the frozen intent" (`http.ts:59`) — sit inline in the HTTP action, testable only through the
mocked-fetch test harness instead of as a plain function call.

## Scope

- Add a pure `acceptNotification(params, intent)` (name TBD — grill it) to `convex/payfast.ts`
  that encodes the acceptance rules and returns a verdict (accept / reject + reason).
- `convex/http.ts`'s `payfastNotify` becomes a thin adapter: parse → call `acceptNotification` →
  dispatch on the verdict (call `fulfillPurchase` or reject).

## Out of scope

- `convex/market.ts`'s `fulfillPurchase` (Entitlement mint + Ledger insert + split calc) — its
  boundary already holds per the review; this ticket doesn't touch it.
- Any change to the sales/ledger reporting queries (`sales.ts`, `ledger.ts`) — reviewed and
  found not duplicating ledger-interpretation logic.

## Acceptance criteria

- [x] The "only COMPLETE grants" and "amount must match intent" rules are each expressed once, in
      `payfast.ts`, as a pure function — not inline in `http.ts`.
- [x] Both rules are covered by direct unit tests against the pure function, with no HTTP mock
      required for that coverage.
- [x] `payfastNotify`'s existing mocked-fetch integration tests still pass unchanged (behavior
      preserved).

## Tests (TDD, `convexTest` seam)

1. `acceptNotification` rejects a non-`COMPLETE` payment_status.
2. `acceptNotification` rejects an amount that doesn't match the frozen intent.
3. `acceptNotification` accepts a `COMPLETE`, amount-matching notification.
4. Existing `http.ts` PayFast ITN integration tests (mocked fetch) stay green, unmodified in intent.

## Notes

Independent of tickets 01/02/03/05.

## Comments
