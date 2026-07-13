# invite-emails/01: auto-admit invited emails to the Allowlist

**Status:** done
**Depends on:** —

## Why

Sign-up is Allowlist-gated ([`convex/auth.ts:39`](../../../convex/auth.ts#L39)),
but inviting a no-account email never admits it, so the invitee **can't sign up**
— the "they're in when they sign up" promise is false. Fix that so the pending
invite → sign-up → `claimPendingShares` path actually works. Independently
valuable even before any email is sent.

## Scope

- Export `admitEmail(ctx, email)` from [`convex/whitelist.ts`](../../../convex/whitelist.ts)
  (currently module-private). Keep its existing signature/idempotency.
- In [`convex/shares.ts`](../../../convex/shares.ts) `shareTopic`, call
  `admitEmail(ctx, addr)` for the invited address (covers both the existing-user
  and no-account branches — put it right after `normaliseEmail`). Same mutation
  ctx, atomic with the invite. No scheduling.

## Out of scope

- Un-admitting on `revokeShare` (admitting is monotonic).
- Any email sending (issues 02–03).

## Acceptance criteria

- After `shareTopic` to a no-account email, that email is admitted.
- A no-account invitee can complete sign-up and their pending Share is claimed.
- Re-inviting an already-admitted email is a no-op (no duplicate whitelist row).

## Tests (TDD, `convexTest` seam)

1. `shareTopic` to a no-account email → `whitelist:isAdmitted` (or
   `isEmailAdmitted`) returns true for that email.
2. End-to-end: invite no-account email → simulate account creation via the auth
   callback path → the pending Share becomes a real Share (claim works because
   admission passed).
3. Inviting an email already on the Allowlist adds no second row.
4. Existing behaviour intact: inviting an existing user still returns `"shared"`
   and creates the Share.
