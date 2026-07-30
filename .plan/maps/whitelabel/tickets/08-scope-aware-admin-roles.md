---
type: task
blocked_by: [07]
---
# Scope-aware admin roles

## Question

Today's `isCallerAdmin` (`convex/whitelist.ts:63`) is global-only — it answers "is this the one
Admin" and nothing else. ADR 0021 §4 retires that one-Admin invariant (supersede ADR 0011) for
sys admin + per-tenant admins. The dashboard (19–22) cannot be scope-gated until this lands. Scope:

- `whitelist.tenantSlug?` (added in 07) encodes scope: absent + `isAdmin` = sys admin; present +
  `isAdmin` = tenant admin; no `isAdmin` = member.
- Change `isCallerAdmin` to `isCallerAdmin(ctx, tenantSlug?)`: no arg → true only for a sys admin
  (matches every existing call site); arg given → true for a sys admin OR a tenant admin whose own
  `tenantSlug` matches.
- Multiple tenant admins per tenant (no cap). Update the "refuses to remove the one Admin" guard so
  it blocks removing the last **sys admin** while tenant-admin rows are freely added/removed.
- Sign-up admission: a user signing up under `<slug>.my-course.app` must have a matching `whitelist`
  row with that `tenantSlug` (default to: an entry admits exactly the host it was added under).
- Promote the ADR draft; mark ADR 0011 superseded.

## Done when

`isCallerAdmin(ctx)` still returns true only for sys admins (existing Routine/content gates
unaffected); `isCallerAdmin(ctx, "ywampotch")` is true for a sys admin and any ywampotch tenant
admin, false for a upf tenant admin or plain member; the last-sys-admin removal guard holds while
tenant-admin rows are freely managed; the ADR is promoted and ADR 0011 marked superseded.

## Answer

Built test-first 2026-07-17 (`convex/whitelist.test.ts`, +4 tests). Kept small (ponytail) — the
auth-gate core only, not the sign-up plumbing.

- **`isCallerAdmin(ctx, tenantSlug?)`** (`convex/whitelist.ts`) — scope-aware. Row shape decides
  role: `isAdmin` + no slug = sys admin (passes every check); `isAdmin` + slug = tenant admin
  (passes only a matching scoped check). No-arg semantics unchanged, so every existing caller
  (`content`, `ledger`, `market`, `routine`, `sellers`) is unaffected.
- **`amITenantAdmin({ tenantSlug })`** — a new query exposing the scoped check for a dashboard route
  guard. Added alongside `amIAdmin` (left `args: {}`) so the ~4 existing no-arg call sites don't churn.
- **Last-sys-admin guard** — `removeEmail` refuses to drop a sys-admin row only when it's the last
  one; tenant-admin and member rows are freely removable.
- **`seedEmail`/`admitEmail`** gained an optional `tenantSlug` so tenant-admin/member rows are
  bootstrappable from CLI/tests. `addEmail` stays sys-admin-gated and default-site-only.
- **ADRs** — the draft graduated to `docs/adr/0022-tenant-subdomain-model.md` (not 0021: that
  number was taken by the open-sign-up ADR in the interim). ADR 0011's banner records the
  one-Admin-invariant supersession.

**Deferred** (flagged in ADR 0022 §4, not in this issue's AC): sign-up host→`users.tenantSlug`
stamping (threads the request host through the `createOrUpdateUser` auth callback) and the
tenant-admin-facing Allowlist editing UI — no current gate depends on either; both belong to the
dashboard chain (19–22).
