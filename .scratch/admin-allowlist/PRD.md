# PRD: Admin portal for the Allowlist

Status: ready-for-agent

> Vocabulary follows [`CONTEXT.md`](../../CONTEXT.md) — in particular the new
> **Allowlist** and **Admin** terms added for this feature. Decision recorded in
> [ADR 0011](../../docs/adr/0011-allowlist-in-convex-admin-portal.md): the
> Allowlist moves from the `AUTH_ALLOWED_EMAILS` env var into a Convex table,
> managed by a single in-app Admin, gating **sign-up only**.

## Problem Statement

The set of emails allowed into the private alpha — the **Allowlist** — lives in
the `AUTH_ALLOWED_EMAILS` environment variable, read synchronously inside the
Password provider's `profile()` ([convex/auth.ts](../../convex/auth.ts)).
Changing who may join means the operator has to run
`npx convex env set AUTH_ALLOWED_EMAILS "…" --prod` from a terminal and redeploy
the env. The operator (`jvorster63@gmail.com`) wants to admit and remove people
from inside the running app, not from a CLI.

## Solution

A single **Admin** (`jvorster63@gmail.com`) gets a dedicated `/admin` page listing
the admitted emails, with a field to add one and a per-row control to remove
one. The Allowlist becomes a Convex table edited at runtime; the Admin's own row
is shown but cannot be removed through the portal.

Admission gates **account creation only**: adding an email lets that person sign
up; removing one closes off *new* sign-ups for it but does not evict an account
that already exists. A one-time migration carries the current
`AUTH_ALLOWED_EMAILS` values into the table (flagging the Admin), after which the
env var is retired. An empty table admits nobody.

## User Stories

### Admin — managing the Allowlist
1. As the Admin, I want an `/admin` page, so that I can manage who may join without touching the CLI or env vars.
2. As the Admin, I want to see the full list of admitted emails, so that I know exactly who can sign up.
3. As the Admin, I want my own email shown on the list and clearly marked as the Admin, so that I can see I'm in control.
4. As the Admin, I want to add an email to the Allowlist, so that a new person can create an account.
5. As the Admin, I want adding an email I've already added to be a no-op (not an error or a duplicate row), so that I don't have to check first.
6. As the Admin, I want emails normalised (trimmed, lower-cased) on add, so that casing or stray spaces never create a second entry or a mismatch at sign-up.
7. As the Admin, I want obviously malformed input rejected with a clear message, so that I don't accidentally admit garbage.
8. As the Admin, I want to remove an admitted email, so that a person can no longer create an account.
9. As the Admin, I want the remove control absent (or disabled) on my own Admin row, so that I can't accidentally lock myself out.
10. As the Admin, I want add/remove to take effect immediately and the list to update live, so that I get instant confirmation it worked.
11. As the Admin, I want a clear signal when an add or remove fails, so that I know to retry.

### Prospective user — sign-up
12. As an admitted person, I want to sign up with my email, so that I can start using the app.
13. As a non-admitted person, I want my sign-up rejected with the existing "this workspace is private" message, so that it's clear the app isn't open.
14. As an already-registered user whose email was later removed, I want to still sign in to my existing account, so that removal doesn't surprise me by destroying access mid-alpha (sign-up gate only).

### Non-admin user — access control
15. As a non-admin signed-in user, I do not want to reach the `/admin` page's controls, so that only the Admin governs admission.
16. As a non-admin user, I want any attempt to call the Allowlist mutations to be rejected server-side, so that the gate can't be bypassed by hitting the API directly.

### Operator — bootstrap & operations
17. As the operator, I want a one-time migration that copies the current `AUTH_ALLOWED_EMAILS` emails into the Allowlist and flags my email as Admin, so that nobody currently admitted loses the ability to sign up.
18. As the operator, I want a `convex run`-able way to seed an admitted email in local dev and test, so that an empty-table-closed environment isn't a dead end during development.
19. As the operator, I want to retire `AUTH_ALLOWED_EMAILS` after the migration, so that there's a single source of truth for admission.

## Implementation Decisions

- **New module `convex/whitelist.ts`** is the backend API surface for the
  Allowlist. It exposes:
  - `list` (query, Admin-only) — the admitted emails plus their `isAdmin` flag.
  - `addEmail` (mutation, Admin-only) — normalises the email (trim + lower-case),
    validates a basic email shape, inserts if absent, no-ops if present.
  - `removeEmail` (mutation, Admin-only) — deletes the row; **refuses** to remove
    a row whose `isAdmin` is true (the non-removable-Admin guard).
  - `amIAdmin` (query) — returns whether the caller is the Admin, for the route
    guard. Returns false when unauthenticated.
  - `isAdmitted` (internal query) — `{ email } → boolean`. **Empty table ⇒
    false** (closed). This is the single admission decision, called by the auth
    callback and exercised directly by tests.
  - `seedEmail` (internal mutation) — insert an admitted/admin row; the dev/test
    and migration bootstrap path, callable via `npx convex run`.
- **Admin authorization** reuses the existing identity pattern: `getAuthUserId`
  → `ctx.db.get(userId)` → user email → look up that email in the Allowlist and
  require `isAdmin`. A shared `requireAdmin(ctx)` helper backs the Admin-only
  functions. The route guard is UX only; the mutations are the security boundary.
- **Schema change** ([convex/schema.ts](../../convex/schema.ts)): add a
  `whitelist` table `{ email: string, isAdmin?: boolean }` with a `by_email`
  index. Emails are stored already-normalised.
- **Auth gate moves out of `profile()`** ([convex/auth.ts](../../convex/auth.ts)).
  `profile()` is synchronous (not awaited by the Password provider) and cannot
  read the DB, so the env check is removed and replaced by a
  `callbacks.createOrUpdateUser` hook (which receives a mutation ctx). The hook
  calls `whitelist.isAdmitted` for the sign-up email and throws the existing
  private-workspace message when not admitted. Because this callback fires only
  on account creation for credentials, the gate is **sign-up only** — existing
  accounts' sign-in is unaffected (a deliberate change from the env era, which
  also blocked sign-in; see ADR 0011).
- **One-time migration** reads `AUTH_ALLOWED_EMAILS`, writes a normalised
  `whitelist` row per email, and sets `isAdmin` on `jvorster63@gmail.com`. Run once
  against prod; idempotent on re-run.
- **`/admin` route** (`src/app/admin/page.tsx`): client-guarded by `amIAdmin`
  (non-admins get a not-authorised view, no controls). Renders the list with the
  Admin row marked and un-removable, an add field, and per-row remove. Follows
  the existing inline-form styling used by `SharePanel`/`CardEditor` in
  [Dashboard.tsx](../../src/app/_components/Dashboard.tsx) (live Convex queries,
  busy/error states). No router was previously used; this is the first added
  route, chosen over an in-dashboard panel for a clean, hideable URL.
- **No notification on add.** There is no email infrastructure; the Admin shares
  the sign-up URL out-of-band. Adding an email only permits account creation.
- **Cleanup**: once the migration has run in prod, `AUTH_ALLOWED_EMAILS` is unset
  and the env-reading code path is deleted.

## Testing Decisions

Good tests here assert **external behavior at the backend seam** — the
admission decision and the Admin-governed mutations — not internal wiring. The
prior art is the Convex function tests that run `convexTest(schema, modules)` and
act as a signed-in user with `t.withIdentity({ subject: "<userId>|session" })`
([convex/content.test.ts](../../convex/content.test.ts),
[convex/shares.test.ts](../../convex/shares.test.ts)).

- **`convex/whitelist.test.ts`** (the primary seam):
  - `isAdmitted`: empty table ⇒ false (closed); an admitted email ⇒ true;
    a removed email ⇒ false; normalisation — mixed-case/whitespace input matches
    a stored normalised row.
  - `addEmail`: admits an email; re-adding is idempotent (no duplicate, no
    throw); malformed input rejected; **non-admin caller rejected**.
  - `removeEmail`: removes an ordinary email; **refuses to remove the Admin row**;
    **non-admin caller rejected**.
  - `list` / `amIAdmin`: Admin sees the list and `amIAdmin` is true; a non-admin
    is rejected from `list` and gets `amIAdmin` false; unauthenticated ⇒
    `amIAdmin` false.
- **`convex/auth.test.ts`** (confirmed in-scope — a seam the suite doesn't have
  yet): drive Convex Auth's Password sign-up end-to-end and assert a non-admitted
  email is rejected at `signUp` while an admitted email creates a user. This
  verifies the `createOrUpdateUser` gate is actually wired, beyond the
  `isAdmitted` unit decision. Faking the Password flow is new setup; keep it
  minimal (one rejected, one accepted).
- **Not tested**: the `/admin` React route (no component tests exist in the repo)
  and the one-shot migration.

## Out of Scope

- **Full revocation / eviction.** Removing an email does not invalidate sessions
  or block an existing account's sign-in. (ADR 0011 records this; a
  `requireAdmitted` check on every authed function would be the future path.)
- **Multiple admins / in-app promotion.** Exactly one fixed Admin; the `isAdmin`
  flag is not editable through the portal.
- **Invite / notification emails** on add — no email infrastructure.
- **Self-service requests to join** (a "request access" flow) — admission is
  Admin-push only.
- **Audit log** of who was added/removed when.
- **OAuth / non-password providers** — the gate is specified against the Password
  sign-up flow that exists today.

## Further Notes

- The migration must run in prod before `AUTH_ALLOWED_EMAILS` is unset; between
  deploying the new gate and running the migration the table is empty, so **new
  sign-ups are briefly closed** while existing accounts sign in normally. This is
  acceptable for a ~4-user alpha.
- Local dev and tests start with an empty table (the migration reads an env var
  that's unset locally), so seeding a row via `seedEmail` is the expected first
  step there — otherwise sign-up is closed by design.
- This is the runtime successor to issue
  [`08-whitelist-and-button-gating`](../multi-topic/issues/08-whitelist-and-button-gating.md),
  which set the env-var Allowlist; the button-gating half of that issue is
  unrelated and untouched here.
