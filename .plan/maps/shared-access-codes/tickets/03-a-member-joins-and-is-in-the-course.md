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

## Answer

Built, and the tracer bullet fires: a member types a code, a nickname and a PIN and holds an
Entitlement for the Edition. No email is asked for at any point, and the `users` row a join creates
carries no `email` field at all.

**The provider is `convex/accessCodeAuth.ts`**, a `ConvexCredentials` provider registered as
`accessCode`. The account id is `${accessCodeId}:${nicknameKey}` (the code's **id**, not its string,
so a Seat's credential survives anything ever done to the string and one nickname can be held by two
different people on two organisations' codes). The PIN is the `secret`, hashed by Lucia's scrypt, so
nothing in `seats` can verify a PIN by construction.

Three things about it are worth reading before touching it:

- **`lucia` is now a direct dependency, for one import.** `Password`'s scrypt cannot be borrowed:
  `ConvexCredentials()` hides the real config under an internal `options` key the library marks
  `@ts-expect-error Internal`, so `Password().crypto` is `undefined`. Reaching through that to save a
  dependency line is a clever thing that breaks on a patch release. A missing `crypto` block is not a
  silent downgrade either, it is a throw in `provider.ts`, so this is load-bearing rather than
  hygienic.
- **`export const AccessCode: ConvexCredentialsConfig` needs that annotation.** `authorize` reaches
  for `internal.accessCodes.*`, `_generated/api` is built from `typeof` every module under `convex/`,
  and this module is one of them. Inferred, it is a cycle TypeScript resolves by making the **whole**
  generated api `any`, and the first symptom is a hundred implicit-any errors in
  `src/app/_components/*.tsx` with nothing pointing back here. It cost a debugging pass; the comment
  above the annotation says so.
- **There is a `flow` of `"join"` or `"return"`**, as ticket 01's Answer set out. Without a declared
  intent, `access/nickname-taken` and `access/pin-wrong` are the same request.

**Trap 1 is fixed and asserted.** `convex/auth.ts` gained exactly two things: `AccessCode` in the
providers array, and `if (provider.id === ACCESS_CODE_PROVIDER_ID) return await ctx.db.insert("users", {})`
as the **first** statement after the `existingUserId` early return, above the line that computes
`email`. The test drives **three** joins and asserts three distinct `users` rows with three
Entitlements, and asserts the member's row key set is exactly `["_creationTime", "_id"]`: no `email`
field at all, not an empty string and not `undefined`, because an absent field is absent from the
index.

**The cap is consumed in `internal.accessCodes.claimSeat`**, in the same transaction as the Seat
insert and the Entitlement insert. `internal.accessCodes.forJoin` reads the code id, whether the
nickname is taken and whether the code is stopped or full, but it decides nothing: it exists so a
member who cannot get in is told why before an account is created for them. The atomicity test drives
two joins at the last remaining seat with `Promise.allSettled` and asserts exactly one fulfils, two
seats and two Entitlements.

If `claimSeat` throws after `createAccount` succeeded (the race loser), the account exists and grants
nothing: no Seat, no Entitlement, no access. A retry re-enters `createAccount`, which returns the
same account for a matching secret, and completes. That is self-healing rather than tidy, and it is
called out in the provider.

**The Entitlement's key set is pinned exactly** to
`["_creationTime", "_id", "lang", "topicId", "userId"]` with a comment naming ADR 0031. Adding an
`accessCodeId` back fails that test. `convex/lib.ts` was not touched, and a separate test signs in as
the Seat's user and reads `market.myPurchases` to prove the grant walk already treats an ordinary
Entitlement as access.

**Seven refusal tags, not six.** The spec's six plus `access/too-many-attempts`, because ticket 04's
rate limit is real and a locked-out member told "your PIN is wrong" keeps typing the right PIN and
concludes the seat is gone. All are `ConvexError`s and the test asserts on `.data`, which is what
survives a production deployment.

Two input failures throw **plain** errors rather than tags: an empty nickname, and a PIN under four
characters. `/join` cannot submit either, so the only way to reach them is a direct call, and a
member never sees the redacted "Server Error". Tags are for distinctions a real member has to act on,
and two more would blur what the set is for.

`seats.userId` and `seats.nicknameKey` are **optional in the schema**, which looks wrong here and is
ticket 11's design: a withdrawal strips both and leaves a row that says "one seat was consumed" and
nothing else, so the count cannot move under an invoice that was already raised. The schema comment
carries the reasoning.

Consent is refused server-side in `claimSeat`, and a **stale** version is refused as well as an
absent one, so a cached page cannot record a member as agreeing to wording it never showed them. The
versioned wording lives in `convex/joinConsent.ts` (append only; the English there is the record and
the translations are for comprehension), which ticket 09 fills out for the page.

Twelve tests green, plus `auth.test.ts` and `vouchers.test.ts` unaffected. No UI (ticket 05).
