---
type: task
blocked_by: [03]
---
# Return to a Seat on another device

> `/wayfinder .plan/maps/shared-access-codes/tickets/04-return-to-a-seat-on-another-device.md`

## Question

The reason a PIN exists at all. A member picks the course back up on a different phone by typing
the same three things, and lands in the same seat with their progress intact.

Two things have to be true and neither is free. **Returning must not consume a seat**, or a member
who switches phones twice costs the organisation three seats and the bill is a lie. **The PIN must
actually hold**, and a shared code plus a guessable handle plus a four-digit PIN is brute-forceable
in an afternoon by anybody who was ever given the code, which is everybody.

Rate limiting is therefore part of this ticket rather than a hardening pass later, because without
it the credential is decorative.

## Done when

- Signing in with an existing code, nickname and PIN returns the same `users` row: same Entitlement,
  same progress.
- Returning consumes **no** seat, asserted by joining, signing out, signing back in, and reading the
  derived count.
- A wrong PIN is refused with `access/pin-wrong`, distinguishable from `access/nickname-taken`.
- Failed PIN attempts are rate-limited per `(accessCodeId, nicknameKey)`, asserted, and the limit
  survives signing out and back in.
- A **stopped** code still admits an existing Seat and still refuses a new one, asserted both ways.
  Stopping the deal never takes away what a member already holds.
- A code at its cap still admits an existing Seat.

## Answer

Built, and mostly by the provider's return branch **doing nothing**, which is the point: signing back
in reads the account, verifies the secret and returns the same `userId`. It touches no code row and
writes no seat, so "returning does not consume a seat" is true by construction rather than by a check
that could be forgotten.

Asserted end to end: a member joins, writes real progress through `capture.setProgress`, then comes
back typing `"  thandi "` for `"Thandi"` (nickname normalisation is what makes a second device work
at all) and lands on the **same `users` row** with the same single Entitlement and the same progress
row. The Seller's `taken` and `runningTotal` are unchanged at 1 and 15000. A second `users` row here
would be trap 1 wearing a different hat, which is why the assertion is on identity rather than on
"a seat exists".

**A stopped code and a full code both still admit an existing Seat**, asserted separately. Neither is
checked on the return branch, deliberately: stopping ends the agreement, not what a member was
already given, and a full code is full of seats that all still have to work, or a member is locked
out of a course by the success of the campaign that handed it to them.

**Rate limiting is the library's, keyed on the `authAccounts` row**, which is exactly
`(accessCodeId, nicknameKey)`. That was not a shortcut chosen for laziness: `retrieveAccount` runs
`isSignInRateLimited` / `recordFailedSignIn` / `resetSignInRateLimit` against the account id, so
going through it is what gets the limit, and a hand-rolled counter beside it would be a second
truth. Ten failed attempts per hour, refilling continuously
(`@convex-dev/auth`'s `DEFAULT_MAX_SIGN_IN_ATTEMPS_PER_HOUR`).

Three things the rate-limit test pins:

- Twelve wrong PINs produce `access/pin-wrong` and then `access/too-many-attempts`.
- The **right** PIN is refused while the limit holds. A limit the real member can walk past is a
  limit an attacker can walk past.
- **Another member on the same code still signs in.** Per-seat, not per-code, so one member being
  attacked never locks the rest of the organisation out of their own course.

`access/too-many-attempts` is the seventh tag, added beyond the spec's six because a locked-out
member told "your PIN is wrong" keeps typing the right PIN and concludes the seat is gone.

**Not asserted, and worth saying so rather than implying otherwise:** the limit surviving a *sign
out* is structural rather than tested. The counter is a row in `authRateLimits` keyed on the account,
and signing out touches sessions only, so there is nothing a sign-out could clear. Ticket 10's PIN
change goes through the same `retrieveAccount` call, so it shares the counter rather than offering a
way around it.

`access/pin-wrong` covers both a wrong PIN and a nickname with no Seat on the code, and the
conflation is deliberate: "the nickname and PIN you typed do not match a seat on this code" is one
thing to fix and one sentence to read. Nothing is protected by splitting them, since the join path
already discloses whether a nickname exists.
