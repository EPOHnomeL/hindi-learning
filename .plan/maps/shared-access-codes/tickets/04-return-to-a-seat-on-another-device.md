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
