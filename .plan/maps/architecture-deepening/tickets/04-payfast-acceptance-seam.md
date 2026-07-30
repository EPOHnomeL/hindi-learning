---
type: task
blocked_by: []
---

# Name the PayFast ITN acceptance rules as their own seam

## Question

`convex/http.ts:29-91` (`payfastNotify`) has asymmetric depth. The mechanical parsing
(`verifySignature`, `centsFromRand`, `pfParamString`) is a deep, pure module in `convex/payfast.ts`.
But the actual money-acceptance rules — "only `COMPLETE` grants" (`http.ts:43`) and "amount must
match the frozen intent" (`http.ts:59`) — sit inline in the HTTP action, testable only through the
mocked-fetch test harness instead of as a plain function call.

Scope: add a pure `acceptNotification(params, intent)` (name TBD — grill it) to `convex/payfast.ts`
that encodes the acceptance rules and returns a verdict (accept / reject + reason); `payfastNotify`
becomes a thin adapter (parse → call `acceptNotification` → dispatch on the verdict, calling
`fulfillPurchase` or rejecting). Do not touch `convex/market.ts`'s `fulfillPurchase` (its boundary
already holds) or the sales/ledger reporting queries.

Tests (TDD, `convexTest` seam): (1) rejects a non-`COMPLETE` `payment_status`; (2) rejects an
amount that doesn't match the frozen intent; (3) accepts a `COMPLETE`, amount-matching
notification; (4) existing `http.ts` PayFast ITN integration tests (mocked fetch) stay green,
unmodified in intent.

## Done when

The "only COMPLETE grants" and "amount must match intent" rules are each expressed once in
`payfast.ts` as a pure function (not inline in `http.ts`), both covered by direct unit tests with
no HTTP mock required, and `payfastNotify`'s existing mocked-fetch integration tests still pass
unchanged.

## Answer

**Landed** on `main` (`ddd0eae`). `payfast.acceptNotification(fields, intent)` is pure and returns
a three-way verdict — `grant` / `ignore` / `refuse` — three, not two, because "don't grant" splits:
a CANCELLED notification should be 200-acknowledged (`ignore`) while a tampered one should be
400-rejected (`refuse`). `payfastNotify` is now an adapter that parses, calls `acceptNotification`,
and dispatches on the verdict. The existing mocked-fetch ITN tests pass unmodified.
