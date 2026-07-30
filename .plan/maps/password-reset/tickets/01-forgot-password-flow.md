---
type: task
blocked_by: []
---

# Forgot-password flow (email OTP reset)

## Question

**Depends on:** — (Resend rail already exists from invite-emails)

## Why

A user who forgets their password is permanently locked out: sign-in throws
`InvalidSecret`, sign-up throws "account already exists", and
[`convex/auth.ts`](../../../../convex/auth.ts) configures `Password()` with **no
`reset` provider** — there is no self-serve way back in, and no change-password
UI either. This bit rene@y-knot.io on 2026-07-15 (prod logs: failed sign-up at
7:18, `InvalidSecret` ×2 at 7:52); the operator had to set a temp password by
hand. Interim workaround, for reference (runs the already-deployed auth store —
nothing to deploy):

```sh
npx convex run auth:store '{"args":{"type":"modifyAccount","provider":"password","account":{"id":"<email>","secret":"<temp-password>"}}}' --prod
```

That temp password is then permanent until this issue ships — unacceptable
beyond a one-off.

## Scope

- **Reset email provider** — a small Auth.js-style Email provider (Convex Auth's
  `ResendOTPPasswordReset` pattern): `generateVerificationToken()` returns a
  short numeric OTP (8 digits, ~15 min expiry), `sendVerificationRequest` sends
  it via the existing Resend rail — same raw `fetch` + `RESEND_API_KEY` /
  `INVITE_FROM_EMAIL` envs as [`convex/email.ts`](../../../../convex/email.ts) (no
  new deps, no `"use node"`). Renderer lives beside
  [`convex/inviteEmail.ts`](../../../../convex/inviteEmail.ts) as a pure function
  so it's testable.
- **Wire it** — `Password({ profile, reset: ResendOTPPasswordReset })` in
  [`convex/auth.ts`](../../../../convex/auth.ts). Honour the NOTE at
  [`convex/auth.ts:30`](../../../../convex/auth.ts#L30): the reset flow never
  routes through `createOrUpdateUser`, and it only works for **existing**
  accounts, so the Allowlist sign-up gate is untouched — state that in a
  comment where `reset` is added.
- **UI** — in [`SignIn.tsx`](../../../../src/app/_components/SignIn.tsx), a
  "Forgot password?" link on the sign-in flow, adding two states to the
  existing `flow` union:
  - `"reset"`: email field → `signIn("password", { email, flow: "reset" })` →
    "check your email".
  - `"reset-verification"`: code + new password fields →
    `signIn("password", { email, code, newPassword, flow: "reset-verification" })`
    — on success the user is signed in (Convex Auth signs in as part of
    verification).
  Keep the current visual language (same card, same input styles).
- **Errors** — wrong/expired code shows a retry message, mirroring the existing
  generic error handling; never reveal whether an email has an account.

## Out of scope

- Change-password-while-signed-in (separate issue if wanted; reset covers the
  lockout case).
- Email verification at sign-up (`verify` provider) — different feature, same
  NOTE applies when it comes.
- Swapping the raw Resend fetch for `@convex-dev/resend` (tracked as the
  upgrade path in `convex/email.ts`).
- Rate-limiting reset requests beyond what Convex Auth does itself.

## Acceptance criteria

- From the sign-in card, a user can request a reset code, enter it with a new
  password, and end up signed in — no operator involvement.
- The old password stops working after a successful reset.
- A wrong or expired code fails with a friendly error and can be retried.
- Reset for a non-existent email sends nothing and reveals nothing.
- Allowlist behaviour unchanged: reset cannot create an account.
- With `RESEND_API_KEY` unset (local dev), requesting a reset logs/no-ops
  rather than throwing (same convention as `sendInvite`).

## Tests (TDD, `convexTest` seam + pure renderer)

1. Reset flow end-to-end at the auth seam: request reset → capture token →
   `reset-verification` with new password succeeds; old secret now fails
   (`retrieveAccountWithCredentials` → `InvalidSecret`).
2. Wrong code fails; the password is unchanged.
3. Reset request for an email with no account does not create one (users and
   authAccounts counts unchanged).
4. Email renderer: subject/html/text contain the OTP and no tracking links;
   pure-function test like `inviteEmail.test.ts`.

## Done when

A user who forgets their password can get back in end-to-end via an emailed OTP, and the hand-set temp-password workaround is retired.

<!-- Migrated 2026-07-30 from GitHub issue #81 (filed 2026-07-24), when this repo retired
     its remote tracker; see docs/agents/issue-tracker.md. -->
