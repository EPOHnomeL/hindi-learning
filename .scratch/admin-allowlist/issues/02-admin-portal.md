# 02 — Admin portal (`/admin` route + Allowlist mutations)

Status: done (commit 42fc3f3). Backend + tests landed with issue 01; this slice
added the `/admin` route (App Router `(app)` group) + AdminPanel UI. Built
against the post-ADR-0012 routing, not the old Dashboard view-toggle the issue
text describes.

## Parent

[`../PRD.md`](../PRD.md). Decision:
[ADR 0011](../../../docs/adr/0011-allowlist-in-convex-admin-portal.md).
Vocabulary: **Allowlist**, **Admin** in [`CONTEXT.md`](../../../CONTEXT.md).

## What to build

Give the single **Admin** (`jonathan@y-knot.io`) an in-app page to manage the
**Allowlist** end-to-end — the Admin-gated mutations plus the UI that drives
them.

- Backend (on the `whitelist` module from issue 01):
  - `addEmail` — normalises (trim + lower-case), validates a basic email shape,
    inserts if absent, no-ops if already present.
  - `removeEmail` — deletes the row; **refuses to remove a row whose `isAdmin` is
    true** (the non-removable-Admin guard).
  - `list` — admitted emails plus their `isAdmin` flag.
  - `amIAdmin` — whether the caller is the Admin (false when unauthenticated),
    for the route guard.
  - A shared `requireAdmin(ctx)` helper backs the Admin-only functions: resolve
    the caller via `getAuthUserId` → user email → look that email up in the
    Allowlist and require `isAdmin`. Non-admin callers are rejected server-side —
    the mutations are the security boundary, not the route.
- UI: an `/admin` Next.js route (first added route in the app). Client-guarded by
  `amIAdmin` — non-admins see a not-authorised view with no controls. Renders the
  live list with the Admin row marked and un-removable, an add field, and a
  per-row remove control; add/remove reflect immediately (live Convex query).
  Follow the existing inline-form styling (busy/error states) used by
  `SharePanel` / `CardEditor` in
  [`Dashboard.tsx`](../../../src/app/_components/Dashboard.tsx).
- No notification email on add (no email infra); the Admin shares the sign-up URL
  out-of-band.

## Acceptance criteria

- [ ] Admin can add an email on `/admin`; it appears live and that person can
      then sign up.
- [ ] Re-adding an existing email is a no-op (no duplicate row, no error);
      malformed input is rejected with a clear message; casing/whitespace is
      normalised.
- [ ] Admin can remove an ordinary email; the removed person can no longer sign
      up.
- [ ] The Admin's own row is shown, marked as Admin, and has no working remove
      control; `removeEmail` refuses to remove it server-side.
- [ ] A non-admin signed-in user sees the not-authorised view on `/admin` and is
      rejected server-side from `list`, `addEmail`, and `removeEmail`;
      `amIAdmin` is false for non-admin and unauthenticated callers.
- [ ] Add/remove failures surface a clear retry signal in the UI.
- [ ] `convex/whitelist.test.ts` covers `addEmail` (admit, idempotent, malformed
      rejected, non-admin rejected), `removeEmail` (removes ordinary, refuses
      Admin row, non-admin rejected), and `list` / `amIAdmin` authz. Prior art:
      [`convex/shares.test.ts`](../../../convex/shares.test.ts).

## Blocked by

- Issue 01 (the `whitelist` table, `isAdmin` flag, and module must exist).
