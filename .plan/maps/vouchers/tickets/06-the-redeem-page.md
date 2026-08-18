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
