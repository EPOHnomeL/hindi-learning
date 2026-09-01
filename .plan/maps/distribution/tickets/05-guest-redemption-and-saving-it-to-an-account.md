---
type: task
blocked_by: []
---
# Guest redemption, and saving it to an account

## Question

Walking `/redeem` on 2026-08-18 the operator's verdict was that making a member create an account
with an email before they can use a code their organisation already paid for is too much ceremony.
The ask: **let them in as a guest, keep their progress, and let them attach a real account later.**

The spec says the opposite in so many words (story 12: "As a member, I want to sign up with any
email address I choose"), but the promise that story protects is that the ORGANISATION never
discloses its members' addresses, not that members must have accounts. A guest seat does not breach
that promise. So this is a change of mind about ceremony, not a reversal of the privacy design, and
it does not need a superseding ADR - **as long as it is built the way below and not the other way.**

**The other way, which was proposed and must not be built without an ADR:** storing the progress
*on the voucher code*, so a member retypes their code on a new phone and gets back in. That needs a
code to account link, and the Seller holds the code list, so the organisation could then map every
code to a person's progress. That is precisely what `batchCodes` refuses to disclose (it returns
codes with no spent flag for this exact reason) and what `vouchers.test.ts` pins by asserting the
voucher row's key set. The map's Out of scope calls it out: reversing it needs a superseding ADR.
There is no cryptographic dodge, because the threat model in ADR 0029 includes the operator, and
the operator has the database.

So the shape is: **an anonymous account is the guest**, the code is never linked to it, and the
recovery story is attaching an account rather than re-entering the code. What is NOT solved by this
design, and should be said out loud on the page: a guest who clears their browser before attaching
an account loses the seat, and nobody can restore it, because nothing records who redeemed.

## The two traps, both verified in the library source on 2026-08-18

Read these before writing any code. Neither is theoretical; both were found by reading
`node_modules/@convex-dev/auth/dist/server/implementation/users.js`.

1. **This repo's custom `createOrUpdateUser` would merge every guest into one account.** The
   Anonymous provider supplies no email, so the callback's `const email = String(profile.email ??
   "")` becomes `""`, it inserts the first guest as `email: ""`, and the SECOND guest's
   `.withIndex("email", q => q.eq("email", ""))` finds that row and returns it - so guest two signs
   in as guest one and inherits their Entitlement and progress. A third guest makes `.unique()`
   throw. The anonymous branch must come FIRST in that callback, always insert a fresh row with
   `isAnonymous: true` and **no** `email` field at all, and skip `claimPendingShares`.
2. **Attaching an account later would orphan the seat.** `existingUserId` is populated only from an
   `authAccounts` row for the *same* provider (`users.js`, `defaultCreateOrUpdateUser`), so a
   signed-in guest clicking Google arrives with `existingUserId: null` and this repo's callback
   creates a brand new user row on their Google address. Their Entitlement, progress and any
   certificate stay on the abandoned anonymous row. Linking therefore has to be explicit: the
   callback needs to notice a currently-signed-in anonymous caller (via `getAuthUserId(ctx)`) and
   adopt THAT row - patching the email on and clearing `isAnonymous` - instead of inserting.

Trap 2 in particular wants verifying against a running dev deployment rather than by inference:
whether `ctx.auth` is populated inside `createOrUpdateUser` during a `signIn` call made by an
already-authenticated client is exactly the kind of thing that is cheaper to observe than to reason
about.

## Done when

- `/redeem` offers "Continue as guest" beside the account options, and a code redeems onto that
  guest with no email typed anywhere.
- Two guests redeeming two codes on the same deployment end up as two accounts with two
  Entitlements - asserted, because trap 1 fails silently and looks like it works with one tester.
- A guest who later signs in with Google or a password keeps the same `users` row: same Entitlement,
  same progress, same certificates, and `isAnonymous` cleared.
- The page says plainly that a guest seat lives in this browser until they save it, because nobody
  can restore it afterwards.
- Somewhere inside the course invites a guest to save their access; a member who already has an
  account never sees it.
- The privacy assertions in `convex/vouchers.test.ts` are untouched and still green: a guest's
  Entitlement carries the same five keys as everyone else's, and the voucher row still records
  nothing but `redeemedAt`.

<!-- Moved 2026-09-01 from vouchers/11 during the .plan consolidation (33 map dirs to 7 active maps).
     Renumbered because blocked_by is map-local; the old number stays that ticket's identity in the donor
     map's history. blocked_by: [06] was dropped, not lost: vouchers/06 is RESOLVED and stayed on that map, so the edge cannot be expressed map-locally and no longer gates anything. -->
