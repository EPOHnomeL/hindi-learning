# Sign in with Google

Add Google as a second sign-in method alongside the existing email + password,
and stop persisting sessions so badly that users are logged out on every browser
restart.

Status: agreed 2026-07-27. Supersedes the "verify-your-email backfill first"
idea, which was considered and dropped (see Rejected alternatives).

## Why

Two separate complaints, one work stream:

1. Sign-up friction, especially on the auth-first checkout path (`buy=1`), where
   a new buyer must invent a password before they can pay.
2. "It logs me out all the time." This turned out not to be session duration at
   all — see §3.

## Scope

### 1. Google provider

Add `Google` from `@auth/core/providers/google` to the `providers` array in
`convex/auth.ts`. Configuration is entirely env + console:

- `npx convex env set AUTH_GOOGLE_ID …` and `AUTH_GOOGLE_SECRET`, set separately
  on the dev and prod deployments.
- Google Cloud console authorised redirect URI:
  `https://<deployment>.convex.site/api/auth/callback/google` (one per
  deployment).

### 2. Link by email in `createOrUpdateUser`

The callback in `convex/auth.ts` currently does an unconditional
`ctx.db.insert("users", { email })` for every sign-in where no account row for
that provider exists. Adding Google without touching it would give an existing
password user a **second `users` row on the same email** on their first Google
click — no purchases, no progress, no certificates, no shares. This is the only
non-optional code change in the feature.

New behaviour, keyed on the normalised email:

- **Existing user with this email → return that `userId`.** Convex Auth then
  attaches the Google `authAccounts` row to it (`upsertUserAndAccount` calls
  `createOrUpdateAccount` with whatever id we return), so the accounts are
  linked and the user lands in the account they already had.
- **No existing user → insert as today**, then `claimPendingShares`.

Look up via the existing `users.email` index (`convex/schema.ts:62`).

Decided details:

- **`emailVerificationTime`** is set when the sign-in came from Google, which
  has verified the address. Today the field is declared in the schema and never
  written by anything; this makes it meaningful and leaves the door open to
  Convex Auth's built-in linking semantics later.
- **`name` is never overwritten on link.** `users.name` doubles as the
  certificate display name (`convex/users.ts:5-9`) and a user may have
  deliberately set it; clobbering it with the Google profile name would silently
  change what future certificates print. A *new* account does take Google's
  `name` and `image`, since there's nothing to lose.
- **`claimPendingShares` stays on the new-account path only**, matching today's
  behaviour. It is idempotent per (Topic, Viewer, Edition) so calling it on link
  would be safe, but it would add an index read to every Google sign-in and make
  Google sign-in behave differently from password sign-in for no clear win.
- **`tenantSlug` is untouched.** Nothing writes `users.tenantSlug` at sign-up
  today, so Google sign-up is already at parity with password sign-up. Out of
  scope.

### 3. Session persistence (independent, ship first)

Not a duration problem. Server-side sessions are already 30 days by default
(`totalDurationMs` and `inactiveDurationMs`, neither overridden). The bug is that
`src/middleware.ts` passes no `cookieConfig` to `convexAuthNextjsMiddleware`, and
with `maxAge` unset **Convex Auth writes the JWT and refresh-token cookies as
browser-session cookies**. They are discarded on browser quit / Chrome restart /
mobile Safari evicting a backgrounded tab, while the 30-day server session sits
there still valid. That matches the symptom: logouts track browser restarts, not
elapsed time.

Fix: pass `cookieConfig: { maxAge: … }`. Effective lifetime is
`min(cookie maxAge, server session duration)`, so going beyond 30 days means
raising both. Target: **cookie `maxAge` 365 days**, `session.totalDurationMs`
365 days, `session.inactiveDurationMs` 60 days — a learner who opens the course
once a month is never bounced, and a fully idle account still ages out.

The cross-subdomain half of cookie scoping is already handled by the managed
pnpm patch (`pnpm-workspace.yaml` → `patches/@convex-dev__auth@0.0.80.patch`)
and needs no change.

### 4. UI

A "Continue with Google" button on `src/app/_components/SignIn.tsx`, above the
email/password form with a divider, calling `signIn("google")`. New copy in the
`Auth` i18n namespace, translated across the offered locales. The button shows on
both the `signIn` and `signUp` toggle states — with auto-linking there is no
meaningful difference between the two for Google.

## Non-goals

- **No identifier-first / email-lookup redesign.** Considered and dropped as
  over-engineering. No query that reveals whether an email is registered.
- **No "Connect Google" UI in settings.** Auto-linking makes it redundant: an
  existing user clicking the sign-in button *is* the linking flow.
- **No email verification, and no verify-your-email backfill.**
- **No password reset flow.** Still absent, still a real gap, but out of scope
  here — it becomes more pressing only if we ever remove password sign-in.
- **No migration to Better Auth.** Evaluated; a much larger job (12 `v.id("users")`
  foreign keys, 29 files importing auth, password hashes needing a custom
  verifier or a forced reset for everyone). Not required for Google sign-in, and
  the linking logic written here is the same logic that migration would need.

## Accepted risk

Auto-linking on a Google-verified email means: if an attacker registers a
password account on `victim@gmail.com` *before* the victim ever uses the app, the
victim's later Google sign-in lands in the attacker's account, and the attacker
retains password access to it.

Accepted knowingly. It requires the attacker to pre-guess both the address and
that its owner will later sign up, and the payoff is a course-progress record.
The mitigation, if it ever matters, is a "Google was connected to your account"
notice email through the existing Resend action in `convex/email.ts` — cheap to
add later, deliberately not built now.

## Rejected alternatives

- **Verify-email backfill first.** Would work, but only fixes the existing
  cohort — the hazard returns for every new unverified signup unless
  verification-at-signup ships too. Plus a non-responder tail with no
  self-serve recovery (no reset flow), and a bulk send risking the domain
  reputation that carries invites and receipts.
- **Password challenge before OAuth (identifier-first).** Safe and rigorous, but
  needs a lookup query, a link-ticket table, a challenge page and a custom
  credentials provider. Rejected as over-engineered for the threat.
- **Challenge after OAuth.** Impossible as UX. Any throw inside the OAuth
  callback is swallowed and answered with a bare `Response.redirect` carrying no
  code, no error and no message
  (`node_modules/@convex-dev/auth/dist/server/implementation/index.js:225-227`),
  so the user would silently bounce back signed-out with no explanation. The
  throwing mutation also rolls back, so no ticket can be persisted on the way
  out.
- **Separate accounts on the same email.** Zero code change, but users end up
  with two accounts and the Google one has none of their purchases.

## Test plan

Backend, in `convex/auth.test.ts` with `convex-test` — the callback is the part
worth testing and it is reachable without a real OAuth round-trip:

- Google sign-in on an unknown email creates exactly one user, and claims any
  pending shares for that address.
- Google sign-in on an email that already has a password account returns the
  **same** `userId` — asserted by user count staying at 1 and by the pre-existing
  shares/purchases still resolving.
- Linking does not overwrite an existing `name`.
- A new Google account stores `name` and `image`, and sets
  `emailVerificationTime`.
- Email normalisation holds: `Foo@Bar.com` from Google links to a `foo@bar.com`
  password account.

Session cookie: assert `convexAuthNextjsMiddleware` is called with an explicit
`cookieConfig.maxAge`, so the regression (dropping back to session cookies) is
caught. Manual check: sign in, fully quit the browser, reopen — still signed in.

Manual OAuth smoke test on the dev deployment before prod, since the round-trip
itself can't be unit-tested.

## Issues

- #110 — session cookie persistence (§3), independent, ship first
- #111 — link by email in `createOrUpdateUser` (§2), before any button exists
- #112 — Google provider + sign-in button (§1, §4)

Order matters: #111 must land before #112 so the button never ships while a Google
click on a known email would fork the account.
