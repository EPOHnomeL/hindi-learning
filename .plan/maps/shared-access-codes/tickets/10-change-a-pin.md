---
type: task
blocked_by: [04]
---
# Change a PIN

> `/wayfinder .plan/maps/shared-access-codes/tickets/10-change-a-pin.md`

## Question

A member types a four-digit PIN on a phone, in a room full of people, at a party meeting. Being
unable to change it afterwards makes the credential worse than it looks.

This is a **change**, never a reset. It requires the old PIN, because the only thing that proves a
caller owns a Seat is the PIN, and a change that does not require it is a takeover. There is no
recovery path on this rail and this ticket must not accidentally create one.

## Done when

- A signed-in Seat can change its PIN by supplying the old one and a new one.
- The wrong old PIN is refused, rate-limited on the same counter as sign-in so this is not a way
  around ticket 04's limit.
- The new PIN takes effect immediately and the old one stops working, asserted.
- The Seat, its Entitlement and its progress are untouched, asserted on the key set.
- Nothing here lets a caller change a PIN they cannot already authenticate, asserted server-side.
- A member with no Seat, or with an ordinary account, never sees the control.
