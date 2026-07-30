---
type: task
blocked_by: [19]
---
# Dashboard — course/member assignment + tenant removal guard

## Question

This is the "Courses", "Members", and "Remove tenant" sections of 19's per-tenant panel — the last
three pieces before the dashboard covers every v1 surface. Ground truth: 06 decisions 4 and 5. Scope:

- **Assigned courses:** a list of courses carrying this tenant's `tenantSlug`, a search-and-add
  picker (by title) to assign more, and a per-row remove that clears `tenantSlug` back to unset.
  Tenant-centric, inside the tenant's own tab.
- **Assigned members:** same shape, keyed by email against `whitelist.tenantSlug`.
- **Remove tenant:** a destructive action, **blocked outright** (disabled + explanation, not just a
  confirm) whenever the tenant still has any `topics`/`whitelist`/`users` row referencing its
  `tenantSlug` — mirrors ADR 0011's refuse-to-remove-the-one-Admin; no cascade-delete introduced.
  Only an empty tenant can be removed, behind a plain confirm.
- All mutations scope-checked by `isCallerAdmin(ctx, tenantSlug)`.

## Done when

Adding a course via the picker sets its `tenantSlug` (shows on both default site and the tenant's
subdomain); removing a course clears it; the "Remove tenant" control is disabled with an explanation
while any course or member is assigned and only enabled once both lists are empty; removing an empty
tenant deletes its row after a plain confirm.

## Answer

Built test-first 2026-07-18 (`convex/tenants.test.ts` +17 → 59 pass), minimal (ponytail) —
assignment is a one-field patch, removal is a refuse-to-remove guard, no cascade delete introduced.

**Backend** (`convex/tenants.ts`)
- **`courseAssignment({tenantSlug})`** — `{ assigned, available }`: the tenant's own courses (by
  `topics.by_tenant`) and the assignable pool (default-only courses via the same index at the unset
  slug), sorted by title. A course owned by another tenant is in neither list.
- **`assignCourse`/`unassignCourse`** — patch `topics.tenantSlug` on/off. `assignCourse` refuses to
  steal a course already owned by another tenant; `unassignCourse` refuses one that isn't this
  tenant's.
- **`memberAssignment({tenantSlug})`** — `{ assigned (email + isAdmin), available }`: the tenant's
  own `whitelist` rows and the assignable pool (unassigned **non-admin** emails — a sys admin is
  excluded so it can't be silently demoted). Both reads go through a new `whitelist.by_tenant` index.
- **`assignMember`/`unassignMember`** — patch `whitelist.tenantSlug`. `assignMember` requires the
  email already be on the Allowlist, refuses to scope a sys admin, refuses to steal another tenant's
  member. `unassignMember` refuses a **tenant admin** (clearing its slug would promote it to sys
  admin — that goes through the Allowlist).
- **`tenantReferenceCounts` + `removeTenant`** — the guard mirrors ADR 0011: `removeTenant` is
  **blocked outright** while `courses + members + users > 0` (all counted via indexed reads —
  `topics.by_tenant`, `whitelist.by_tenant`, a new `users.by_tenant`), only deletes an empty tenant.
  The UI reads the same counts to disable + explain; the mutation re-derives them.
- All writes gated by `isCallerAdmin(ctx, tenantSlug)`.

**Schema** (`convex/schema.ts`) — added `by_tenant` indexes on `users` and `whitelist` (index-only
push, no backfill) so the growable-table reads never scan.

**Frontend** (`src/app/_components/AdminPanel.tsx`) — `TenantDetail`'s Courses/Members/Remove
sections render `TenantCourses`, `TenantMembers`, `TenantRemoval`. A shared `SearchAddPicker` and
`AssignedRow` back both assignment lists; live queries re-render on every write. Tenant admins in the
members list are badged **Admin** with a "Remove via Allowlist" note (no remove control).
Remove-tenant is disabled with an explanation until all three counts hit zero, then removes behind a
`window.confirm`; on success `TenantsManager` clears the selection.

**Verified:** typecheck clean; 451 tests pass (59 in `tenants.test.ts`); `pnpm build` compiles
`/admin`. UI behaviour is the pending browser check — needs an authed admin session (dev has
operator accounts only). This was the last v1 dashboard surface — the dashboard now covers the full
PRD scope.
