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


## Answer

Built as `accessCodeAuth.changePin`, an **action** rather than a mutation, because
`modifyAccountCredentials` hashes the new secret and no mutation can call it.

Three things hold it shut, and each answers one line of the ticket:

- **It demands the old PIN.** The only thing that proves a caller owns a Seat is the PIN, so a change
  that skips it is a takeover, and on this rail there is no email to send a warning to afterwards.
  Asserted: the wrong old PIN gives `access/pin-wrong`.
- **It takes no seat argument.** The Seat comes from `ctx.auth` through
  `internal.accessCodes.mySeatAccount`, an internal query with no args, so there is no id a caller
  could pass to change somebody else's PIN. Asserted server-side against a signed-out caller and
  against an ordinary email-and-password account, both of which are refused because neither holds a
  Seat.
- **It shares sign-in's rate limit rather than routing around it.** The old-PIN check goes through
  `retrieveAccount`, which is where the library's per-account limiter lives. Asserted twice: twelve
  wrong old PINs produce `access/too-many-attempts`, and a `/join` sign-in with the *correct* PIN is
  then refused too, which is what proves it is one counter and not two.

The new PIN works immediately and the old one stops working, asserted in both directions. **The Seat,
its Entitlement and its progress are untouched**, asserted on the Entitlement's key set and on
`consentedAt` being byte-identical, not merely on a row count: a PIN change happens in
`authAccounts`, and anything it moved in `seats` or `entitlements` would be a bug hiding as a
convenience.

The control is in `src/app/_components/SeatSettings.tsx`, mounted in both `SettingsPage` (the route,
and the mobile door) and `SettingsDialog` (the desktop gear). It renders **nothing at all** unless
`accessCodes.mySeat` returns a Seat, so a Guest and an ordinary account never see it by server answer
rather than by a page's judgement. There is deliberately **no "forgot it?" link**: there is no reset,
and offering one would make the join page's promise a lie.


### Amended 2026-08-25 after `/code-review`

`accessCodes.mySeat` returns `nicknameKey`, so a member who joined as `Thandi` is shown
`thandi`. Not fixed, and the reason is worth writing down rather than leaving as a puzzle: the
normalised key is the **only** form stored (spec.md's schema is explicit, and it is half the
account identity), so there is nothing else to display. Adding a display field would be a schema
change for a cosmetic. The row's label was changed instead, to "Nickname you sign in with", which
is both true and the more useful thing to tell somebody whose next act is typing it on another
phone. If a Seller or a member ever complains, the fix is a `nicknameDisplay` field, not a
transformation, because casing cannot be recovered.
