# The Allowlist lives in Convex and is managed by an in-app Admin, gating sign-up only

The private-alpha **Allowlist** moves from the `AUTH_ALLOWED_EMAILS` env var into
a Convex `whitelist` table, editable at runtime by a single **Admin** through a
dedicated `/admin` route. The gate fires on **account creation only** (via the
`createOrUpdateUser` auth callback); an empty table denies all sign-ups.

## Context

The Allowlist was a comma-separated env var read synchronously inside the
Password provider's `profile()` ([convex/auth.ts](../../convex/auth.ts)), so
changing who may join meant `npx convex env set --prod` — not something the
operator can do from the running app. The ask is an in-app portal to add/remove
admitted emails, which forces the list into queryable, mutable storage.

The auth flow constrains *where* the check can run. `profile(params, ctx)` is
invoked on every flow (sign-up and sign-in) but is **not awaited**
([Password.js:56](../../node_modules/@convex-dev/auth/dist/providers/Password.js)),
so it cannot do an async DB read — only the synchronous env read worked there.
The only DB-capable hook is `callbacks.createOrUpdateUser` (a mutation ctx), and
for credentials it fires **only on account creation**, never on an existing
account's sign-in.

## Decision

- **Storage:** a `whitelist` table of `{ email, isAdmin }`, `by_email` index.
  Emails normalised lower-case + trimmed; adds are idempotent.
- **Admin:** the table itself carries `isAdmin`. A small fixed set of Admins
  (`jvorster63@gmail.com`, `josuavorster2003@gmail.com`) — `isCallerAdmin` grants
  Admin to any row flagged `isAdmin`, so more than one is supported. Every Admin
  row is non-removable through the portal; the portal only adds/removes ordinary
  admitted emails (no in-app promotion — Admins are set in the migration's fixed
  list, so re-running it after adding an email flags that Admin).
- **Bootstrap:** a one-time migration reads the current `AUTH_ALLOWED_EMAILS`,
  writes a row per email, and flags the Admin. The env var is retired afterward.
  Dev/test seed a row via a `convex run`-able mutation (the env-reading migration
  seeds nothing locally).
- **Enforcement:** the gate moves out of `profile()` into `createOrUpdateUser`,
  which reads the table and rejects sign-up for a non-admitted email. This is a
  **sign-up gate only** — removing an email stops new sign-ups, but an account
  that already exists keeps access (its sessions are untouched).
- **Empty table = closed:** no rows ⇒ no sign-ups. Safer prod default; the cost
  is that dev/test must seed first and there is a brief no-new-signups window in
  prod between deploying the gate and running the migration.
- **Portal:** a dedicated `/admin` Next.js route, guarded client-side to the
  Admin for UX. The real boundary is the `whitelist` mutations, which verify the
  caller is the Admin server-side (`getAuthUserId` → user email → `isAdmin`).

## Consequences

- Behaviour change from the env-var era: the old gate blocked **sign-in** too
  (the synchronous env read ran on every flow). The DB gate cannot — so a
  previously-admitted, then-removed, already-registered user can still sign in.
  Accepted deliberately for a trusted ~4-user alpha; true revocation (a
  `requireAdmitted` check on every authed function + session invalidation) was
  considered and rejected as over-scope.
- `AUTH_ALLOWED_EMAILS` and the gate in `profile()` are removed once the
  migration has run in prod.
