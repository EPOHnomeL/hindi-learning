---
type: task
blocked_by: [02]
---
# A member joins and is in the course

> `/wayfinder .plan/maps/shared-access-codes/tickets/03-a-member-joins-and-is-in-the-course.md`

## Question

The tracer bullet, and the ticket the whole rail exists for: a member types a code, a nickname and
a PIN, and is in the course. No email is asked for at any point.

**Read [spec.md](../spec.md) and ticket 01's ADR first.** Three of the rules below look like
mistakes and are not.

**It is a `ConvexCredentials` provider, not `Password`.** `Password` derives its account identity
from `profile.email` and writes into `users.email` and the `email` index, which would collide with
real accounts. `ConvexCredentials` is the primitive `Password` is itself built on, and it takes an
account id and a secret directly. The account id is `accessCodeId` joined to the normalised
nickname; the secret is the PIN, so the library hashes it with its own scrypt and **nothing in
`seats` can verify a PIN**.

**Trap 1 is live and it fails silently.** `convex/auth.ts`'s `createOrUpdateUser` computes
`String(profile.email ?? "").trim().toLowerCase()` before any provider branch, then reads the
`email` index unconditionally. A provider supplying no email inserts `email: ""`, so the *second*
member to join signs in as the first and inherits their Entitlement and progress; the third makes
`.unique()` throw. Re-verified against `@convex-dev/auth@0.0.80` on 2026-08-23. The branch for this
provider must come **first**, insert a fresh row with **no `email` field at all**, and skip
`claimPendingShares`, since a Seat has no email and nothing pending to claim.

**The cap is consumed in the same transaction as the Seat.** A cap read in one function and
consumed in another is a race, and the last seat gets sold twice. The provider runs inside Convex
Auth's `signIn` action and cannot open a transaction itself, so it calls one internal mutation that
checks the cap, inserts the Seat and mints the Entitlement together.

**The Entitlement carries no provenance.** No `accessCodeId`, no `pfPaymentId`, no `eftRef`. This
half of ADR 0029 is kept exactly: a Seat's Entitlement is byte-identical to an Admin comp, and the
only link to the organisation is the one `seats` row.

## Done when

- `seats` is in the schema: `accessCodeId`, `userId`, `nicknameKey` (trimmed, lower-cased),
  `consentedAt`, `consentVersion`. Indexes `by_code_and_nickname` and `by_code`.
- A `ConvexCredentials` provider takes a code, a nickname and a PIN, and for an unused nickname on a
  live code with room creates the account, the Seat and an ordinary Entitlement for
  `(userId, topicId, lang)`.
- **Three members joining one code end up as three accounts with three Entitlements**, asserted.
  Three, not two: the third is what makes `.unique()` throw today, and trap 1 looks correct with a
  single tester.
- The minted Entitlement's key set is pinned **exactly**, the way `convex/vouchers.test.ts` pins the
  voucher one, with a comment naming ticket 01's ADR. Adding an `accessCodeId` back must fail a test.
- The cap is atomic, asserted by driving two joins at the last remaining seat and proving exactly
  one wins.
- Consent is refused **server-side** when absent, not merely hidden in the UI, and the stored Seat
  carries the wording version and the timestamp.
- Refusals are tagged `ConvexError`s whose `data` survives a production deployment, never plain
  `Error`s: `access/code-unknown`, `access/code-stopped`, `access/code-full`,
  `access/nickname-taken`, `access/consent-required`.
- `access/nickname-taken` is distinguishable from a wrong PIN, deliberately. The test says why.
- `convex/lib.ts`'s grant walk is **unchanged**.
- No UI in this ticket. `/join` is ticket 05.
