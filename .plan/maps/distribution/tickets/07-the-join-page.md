---
type: task
blocked_by: []
---
# The /join page

> `/wayfinder .plan/maps/distribution/tickets/07-the-join-page.md`

## Question

Where a stranger with a code meets the product. It is a form, and `/redeem` is the prior art for
every structural decision in it, so read `src/app/redeem/` before starting.

**It sits outside the `(app)` group**, on every host, so somebody arriving from a WhatsApp broadcast
meets the code box rather than a sign-in wall. That was the point of the whole rail.

**Two sentences on this page are compliance controls, not copy.** The nickname field must say, in
plain words, that it need not be a real name: that is the POPIA mitigation the design rests on, and
a UI nudging toward a real name removes it. The PIN field must say that a forgotten PIN cannot be
recovered by anybody, because it cannot, and a member who was not told will reasonably believe
support can help.

The consent step comes **before** the nickname box. Consent obtained after the fact is not consent.

## Done when

- `/join` exists on every host, outside `(app)`, and takes a code from the URL as well as the box,
  the way `/redeem` does, so a Seller can hand out a link.
- Three steps on one page: consent, then code, then nickname and PIN.
- The consent step states what is stored and why, in the wording ticket 09 versions, and refusing is
  a real choice that explains what the member can do instead.
- The nickname field says the nickname need not be a real name.
- The PIN field says a forgotten PIN cannot be recovered by anybody.
- All six refusal tags render as translated sentences, never a raw tag and never "Server Error".
- On success the member lands **in the Edition**, not on a success message with nowhere to go.
- **Walked in a browser, signed out**, end to end, including a return on a fresh browser profile and
  each of the six refusals seen on screen.


## Progress (not resolved: the browser walk is outstanding)

**Built, typechecked, and it compiles as a real route** (`next build` lists
`/join  6.03 kB  152 kB First Load JS`). **Not walked in a browser**, which is a Done-when condition,
so this ticket stays open. Nothing was listening on port 3000 in this session and this repo's rule is
never to start a dev server, so the walk could not happen here. It is the only outstanding work on
this ticket and the next session should do exactly that.

What exists: `src/app/join/page.tsx` and `src/app/_components/JoinPanel.tsx`.

- **Outside the `(app)` group, on every host, no tenant flag**, mirroring `/redeem` for the same
  reasons its own header comment gives: `AppGate` would show a sign-in wall to somebody holding a
  code, and a tenant gate would tell a member with a valid code that it is invalid because they
  followed the wrong link.
- **Three steps in order: consent, code, then nickname and PIN.** Consent obtained after the fact is
  not consent.
- The code comes from `?code=` as well as the box, read after mount so nothing decides on a half-read
  URL. `normaliseAccessCode` runs as they type, so what is on screen is what is looked up.
- **The structural difference from `RedeemPanel`, worth naming because it is the reason this file is
  smaller:** redemption is auth-first and has to send a stranger through sign-up mid-flow, so
  `RedeemPanel` is built around not losing the code across that boundary (a URL carrier plus a
  localStorage stash for the OAuth hop). **There is no boundary here.** The form *is* the sign-up. All
  of that machinery is absent, and its absence is the feature.
- **Both compliance sentences are on the page**, marked in the source as compliance controls rather
  than copy: the nickname need not be a real name, and a forgotten PIN cannot be recovered by
  anybody. The consent wording itself is rendered from `messages/*.json` and pinned to
  `convex/joinConsent.ts` by `messages/consent.test.ts`, so the page cannot restate it and drift.
- Refusing consent is a real choice with a real destination (what to ask the organisation, and a way
  to see the rest of the site), not a wall.
- **All seven tags render as translated sentences** in five locales, never a raw tag and never
  "Server Error". Seven, not the spec's six: `access/too-many-attempts` is included, because a
  locked-out member told "your PIN is wrong" keeps typing the right PIN.
- On success the member lands **in the Edition**: `AlreadyIn` reads `accessCodes.mySeat` the moment
  the token arrives and `router.replace`s into the course. The success card is a fallback for a
  blocked client-side navigation, not the way through.
- A visitor who arrives already signed in on an ordinary account is told so, rather than being shown
  a form that would swap them out of their own account.

The new/returning toggle is the one thing on the page the spec did not describe. It is not a
convenience: see ticket 01's Answer and `accessCodeAuth.ts`. Without a declared intent the server
cannot distinguish "that nickname is taken, pick another" from "you typed your PIN wrong", and the
spec requires that it can.

<!-- Moved 2026-09-01 from shared-access-codes/05 during the .plan consolidation (33 map dirs to 7 active maps).
     Renumbered because blocked_by is map-local; the old number stays that ticket's identity in the donor
     map's history. blocked_by: [04] was dropped, not lost: shared-access-codes/04 is RESOLVED and stayed on that map. This ticket is code-built and holds open only for the browser walk its own Progress section names. -->
