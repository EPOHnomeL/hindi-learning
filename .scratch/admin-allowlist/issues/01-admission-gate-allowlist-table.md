# 01 — Admission gate backed by the Allowlist table

Status: ready-for-agent

## Parent

[`../PRD.md`](../PRD.md). Decision:
[ADR 0011](../../../docs/adr/0011-allowlist-in-convex-admin-portal.md).
Vocabulary: **Allowlist**, **Admin** in [`CONTEXT.md`](../../../CONTEXT.md).

## What to build

Move the **Allowlist** from the `AUTH_ALLOWED_EMAILS` env var into a Convex
table, and make sign-up gate on that table instead of the env var. This is the
foundation tracer bullet: schema → backend → auth flow → migration.

- A `whitelist` table of `{ email, isAdmin? }` with a `by_email` index. Emails
  are stored normalised (trimmed, lower-cased).
- An internal **admission decision** `isAdmitted({ email }) → boolean`. An empty
  table returns `false` (closed). This is the single decision the gate and tests
  share.
- An internal `seedEmail` mutation (insert an admitted/admin row), callable via
  `npx convex run`, so local dev and tests can open a closed-by-default table.
- The sign-up gate moves out of the Password provider's `profile()` (which is
  synchronous and cannot read the DB) into a `callbacks.createOrUpdateUser` hook
  that calls `isAdmitted` and throws the existing private-workspace message when
  the email is not admitted. This is a **sign-up gate only** — an account that
  already exists is unaffected (sign-in not blocked). Remove the old env-based
  check from `profile()`.
- A one-time migration reads `AUTH_ALLOWED_EMAILS`, writes a normalised row per
  email, and sets `isAdmin` on `jonathan@y-knot.io`. Idempotent on re-run.

The Admin portal UI and the add/remove mutations are issue 02 — this slice only
needs `seedEmail` / the migration to put rows in.

## Acceptance criteria

- [ ] `whitelist` table + `by_email` index exist; emails stored normalised.
- [ ] `isAdmitted` returns `false` for an empty table, `true` for an admitted
      email, `false` after removal, and matches case-insensitively / ignores
      surrounding whitespace in the input.
- [ ] Sign-up with an admitted email creates a user; sign-up with a non-admitted
      email is rejected with the existing private-workspace message.
- [ ] An already-registered user whose email is absent from the table can still
      sign in (sign-up gate only).
- [ ] The env-based check is gone from `profile()`; the gate runs in
      `createOrUpdateUser`.
- [ ] `seedEmail` can admit (and flag as Admin) an email via `npx convex run`.
- [ ] Migration copies current `AUTH_ALLOWED_EMAILS` into rows and flags the
      Admin; re-running it does not duplicate rows.
- [ ] `convex/whitelist.test.ts` covers the `isAdmitted` cases; new
      `convex/auth.test.ts` drives the Password sign-up flow for one admitted
      (accepted) and one non-admitted (rejected) email. Prior art:
      [`convex/content.test.ts`](../../../convex/content.test.ts),
      [`convex/shares.test.ts`](../../../convex/shares.test.ts).

## Blocked by

None - can start immediately.

## Notes

- Deploy ordering in prod: after this ships, the table is empty until the
  migration runs, so **new sign-ups are briefly closed** while existing accounts
  sign in normally — acceptable for the alpha. Run the migration, then unset
  `AUTH_ALLOWED_EMAILS` once verified.
- Local dev/tests start empty (the migration reads an unset env var locally), so
  `seedEmail` is the expected first step there.
