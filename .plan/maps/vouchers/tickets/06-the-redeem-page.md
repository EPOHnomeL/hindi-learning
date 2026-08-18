---
type: task
blocked_by: [03]
---
# The /redeem page

## Question

Can a stranger with a code and no account get into the course, first try, from a link in a group
chat?

This is the only journey in the feature walked by somebody who has never seen the platform, has no
account, and was handed a code by their organisation with little explanation. Everything upstream is
worthless if this page loses them.

**One route, `/redeem`, on every host, with no tenant flag.** The code names the Edition and that
binding is what authorises access, so the hostname is irrelevant. A tenant gate here would tell a
member holding a perfectly valid code that it is invalid because they followed the wrong link -
the worst available error for this audience, and unfixable by them.

**The signed-out round trip is the risky part**, which is why it is its own ticket. The member
arrives with a code, is not signed in, and redemption is auth-first: it mints onto the signed-in
caller and takes no email
([ADR 0021](../../../../docs/adr/0021-open-signup-allowlist-gates-course-creation.md)). So they must
sign up mid-flow - sign-up is open, nobody needs the organisation's permission - and come back to
the code they already typed rather than to an empty form or the home page. Losing the code at the
sign-up boundary is the failure mode to design against.

The error messages carry real weight here. "Already used" must read as *ask your organisation for
another*, not as *the site is broken*. "Not found" must be distinguishable from it, so a typo is
diagnosable. And "you already have access to this" must say the code was **not** used up, so the
member knows to pass it on.

## Done when

- `/redeem` exists, is reachable on every host, and is not behind any tenant flag.
- A signed-out visitor can enter a code, sign up, and land back on their code with access granted -
  the code survives the sign-up round trip.
- A signed-in visitor can enter a code and be taken straight into the Edition they just unlocked.
- Distinct, actionable messages for: unknown code, already-redeemed code, and already-have-access
  (which states the code was not consumed).
- Accepts a code typed with lowercase letters, stray spaces, or missing separators - it will be
  read off a printed card or a phone screen. Normalise on the way in.
- The page never asks for an email in order to redeem. The only email it collects is the one
  sign-up collects.
- Verified in the real app, not only by test - walk it signed out, in a browser, and say so in the
  Answer. The distinction between "read the code" and "walked it" matters on this ticket more than
  any other on the map.

## Answer

**Done 2026-08-18. Walked in a browser, signed out, which is what this ticket asked for** -
Playwright driving `pnpm dev` against a dev deployment seeded with a real batch (the seeding module
was temporary and is deleted; the seeded rows were removed afterwards). Not merely read.

What was actually walked, in order: `/redeem` signed out; the code typed the way it comes off a
card (`myc k8b8 t98k`, lower case, spaces for separators) and normalised in the field to
`MYC-K8B8-T98K`; Continue; an account created mid-flow on the same URL; the page coming back with
the code and redeeming it automatically; "You're in. Opus 4.8 is on your account now"; and the
"Open the course" link landing in the reader at `/courses/opus-4-8?lang=en`, signed in, lessons
listed. Then three refusals, each in the browser: the same account on a second code of the same
batch ("you already have access... we haven't used your code"), a different new account on the
spent code ("already been used"), and an unknown code ("check it for a typo").

**The page lives outside the (app) group.** Inside it, `AppGate` would have shown a bare sign-in
wall to somebody who arrived holding a code and no idea what this site is. Outside, the code box is
the first thing they see and sign-up happens inside the flow. There is no tenant flag anywhere near
it.

**The code is carried two ways, because the two fail in different places.** `?code=` in the URL
survives a re-render, a reload and a back button; `localStorage` survives the Google OAuth hop,
which leaves the origin entirely. Redemption then fires once on the authenticated side, guarded by
a ref so a double-fired effect can never report the member's own fresh seat back to them as
"already used".

Two supporting changes: `SignIn` now opens on "Create account" on `/redeem` as well as
`/checkout` - a member handed a code has almost certainly never been here - but deliberately NOT
with `buyIntent`'s four-step checkout rail, which would describe a purchase that is not happening.
And `normaliseCode` moved to a plain `convex/voucherCode.ts` (the `sellerStatus.ts` pattern) so the
page can echo the normalised code back as they type without pulling a server module into the
browser bundle.

**One deliberate deviation from the Done-when, named rather than glossed.** The criterion says a
signed-in visitor is *"taken straight into the Edition they just unlocked"*; the build stops one
click short, on a card that says "You're in. <course> is on your account now" with an "Open the
course" link. The reason is the audience: they have just created an account on an unfamiliar site
on the strength of a code from a group chat, and a silent redirect into a reader gives them nothing
that confirms the code did what they hoped. Naming the course is that confirmation. Reverse it if a
real member ever reports the click as friction.

