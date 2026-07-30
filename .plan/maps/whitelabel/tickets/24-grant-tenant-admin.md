---
type: task
blocked_by: [08, 22]
---
# Grant / revoke tenant admin from the dashboard

## Question

The scope-aware role exists (08: `isAdmin` + `tenantSlug` = tenant admin, enforced by
`isCallerAdmin`) and members can be assigned to a tenant (22), but there is **no way to make someone
a tenant admin** short of editing the DB / CLI `seedEmail`. 08 explicitly deferred this UI. Ground
truth: 08's resolution + ADR 0022 §4.

**Decision (2026-07-18): only a sys admin mints tenant admins.** A tenant admin manages its members
but cannot create or revoke other admins (matches the Allowlist "Admit email" being sys-admin-only).
Scope:

- **`tenants.setTenantAdmin({ tenantSlug, email, makeAdmin })`** — sys-admin-only (`isCallerAdmin(ctx)`
  unscoped). On a `whitelist` row (must already be admitted): `makeAdmin: true` promotes (set
  `isAdmin` + `tenantSlug`, assigning the tenant in the same step if the row was an unassigned
  default-site member; refuses a sys admin and a member scoped to a *different* tenant);
  `makeAdmin: false` demotes to a plain member of the same tenant (clear `isAdmin`, **keep**
  `tenantSlug`; refuses anyone who isn't currently an admin of *this* tenant).
- **Members UI** (`AdminPanel.tsx` `TenantMembers`): a sys-admin-only per-row control — "Make admin"
  on a member, "Revoke admin" on an admin. Hidden for a tenant admin (UX only; the mutation is the
  real boundary). An admin row can't be unassigned directly — demote first.

## Done when

A sys admin promotes an assigned member → their row shows the Admin badge and `isCallerAdmin(ctx,
tenantSlug)` passes for them; revoking returns them to a plain member (still assigned); promoting an
unassigned admitted email assigns + admins in one step; a tenant admin calling `setTenantAdmin` is
refused and shown no control; promoting a sys admin or a member of another tenant throws; revoking a
non-admin throws.

## Answer

Built test-first 2026-07-18 (`convex/tenants.test.ts` +7 → 66 in-file / 458 suite pass).

**Backend** (`convex/tenants.ts`) — **`setTenantAdmin({ tenantSlug, email, makeAdmin })`**:
sys-admin-only (`isCallerAdmin(ctx)` unscoped, *not* the scoped check the other member mutations use,
because minting a tenant admin is a platform privilege). Promote sets `isAdmin: true` + `tenantSlug`
(assigning in one step if the row was unassigned); revoke clears `isAdmin` and **keeps** `tenantSlug`
(demote to member). Refuses: non-admitted email, a sys admin, a member owned by another tenant, and
revoking a non-admin of this tenant.

**Frontend** (`src/app/_components/AdminPanel.tsx`) — `TenantMembers` reads `myAdminScope`; when the
caller is a **sys admin**, each member row shows a "Make admin" / "Revoke admin" control (hidden for
tenant admins — UX only). An admin row still can't be unassigned directly (demote first).
`AssignedRow` gained an optional `action` slot (a self-contained `RowActionButton` with its own
busy/error) so the grant/revoke button composes without disturbing the existing Remove control.

**Verified:** typecheck clean, 458 tests pass, `pnpm build` compiles `/admin`. Browser check of the
grant/revoke flow pending an authed session (dev = operator accounts only), consistent with 19–22.

**Item 2 (per-tenant default course-access / self-enroll) parked** — recorded as fog on the map
("Not yet specified"): the app has no "enroll" concept today, so it needs a `/grilling` pass before
ticketing.
