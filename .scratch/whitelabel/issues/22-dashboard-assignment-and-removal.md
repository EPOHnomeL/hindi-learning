# whitelabel/22: Dashboard — course/member assignment + tenant removal guard

**Status:** implemented (2026-07-18, `/tdd` + `/ponytail`) — UI browser check pending (needs an authed sys-admin session; static gates green)
**Depends on:** [19](19-dashboard-tenants-tab-shell.md)
**Labels:** ready-for-agent

Child of [Whitelabel PRD](../PRD.md). Ground truth:
[06 — Resolution](06-scope-operator-whitelabel-dashboard.md) decisions 4 and 5.

## Why

This is the "Courses", "Members", and "Remove tenant" sections of 19's per-tenant panel — the
last three pieces needed before the dashboard covers every v1 surface from the PRD.

## Scope

- **Assigned courses** section: a list of courses currently carrying this tenant's `tenantSlug`,
  with a search-and-add picker (by title) to assign more, and a remove control per row that
  clears `tenantSlug` back to unset (default-only). Lives inside the tenant's own tab —
  tenant-centric, not on `CourseSettings.tsx`.
- **Assigned members** section: same shape, keyed by email against `whitelist.tenantSlug`
  (search-and-add / remove).
- **Remove tenant**: a destructive action, **blocked outright** (disabled + explanation text,
  not just a confirm dialog) whenever the tenant still has any `topics`/`whitelist`/`users` row
  referencing its `tenantSlug` — mirrors ADR 0011's "refuses to remove the one Admin row"; no
  cascade-delete pattern exists anywhere else in this codebase, and this issue does not introduce
  one. Only an empty tenant (no assigned courses or members) can actually be removed, and even
  then behind a plain confirm.
- All mutations scope-checked by `isCallerAdmin(ctx, tenantSlug)`.

## Acceptance criteria

- Adding a course via the search-and-add picker sets its `tenantSlug`; it now shows on both the
  default site and the tenant's subdomain (per the catalogue rule).
- Removing a course from the list clears its `tenantSlug` back to unset.
- The "Remove tenant" control is disabled with an explanation whenever any course or member is
  still assigned; it's only enabled once both lists are empty.
- Removing an empty tenant deletes its `tenants` row after a plain confirm.

## Resolution (2026-07-18)

Built test-first (`convex/tenants.test.ts` +17 → 59 pass) and kept minimal (ponytail) — assignment
is a one-field patch, removal is a refuse-to-remove guard, no cascade delete introduced.

**Backend** ([convex/tenants.ts](../../../convex/tenants.ts))
- **`courseAssignment({tenantSlug})`** — `{ assigned, available }`: the tenant's own courses (by
  `topics.by_tenant`) and the assignable pool (default-only courses via the same index at the
  unset slug), both sorted by title. A course owned by another tenant is in neither list.
- **`assignCourse` / `unassignCourse`** — patch `topics.tenantSlug` on/off. `assignCourse` refuses
  to steal a course already owned by another tenant; `unassignCourse` refuses one that isn't this
  tenant's (arg and row must agree).
- **`memberAssignment({tenantSlug})`** — `{ assigned (email + isAdmin), available }`: the tenant's
  own `whitelist` rows and the assignable pool (unassigned, **non-admin** emails — a sys admin is
  excluded so it can't be silently demoted). Both reads go through a new `whitelist.by_tenant`
  index (never a full Allowlist scan).
- **`assignMember` / `unassignMember`** — patch `whitelist.tenantSlug`. `assignMember` requires the
  email already be on the Allowlist, refuses to scope a sys admin, and refuses to steal another
  tenant's member. `unassignMember` refuses a **tenant admin** (clearing its slug would promote it
  to a sys admin — that goes through the Allowlist).
- **`tenantReferenceCounts` + `removeTenant`** — the removal guard mirrors ADR 0011: `removeTenant`
  is **blocked outright** while `courses + members + users > 0` (all counted via indexed reads —
  `topics.by_tenant`, `whitelist.by_tenant`, a new `users.by_tenant`), and only deletes an empty
  tenant's row. The UI reads the same counts to disable + explain; the mutation re-derives them.
- All writes gated by `isCallerAdmin(ctx, tenantSlug)` (sys admin any tenant, tenant admin only
  their own, member refused server-side).

**Schema** ([convex/schema.ts](../../../convex/schema.ts)) — added `by_tenant` indexes on `users`
and `whitelist` (index-only push, no backfill) so the growable-table reads never scan.

**Frontend** ([src/app/_components/AdminPanel.tsx](../../../src/app/_components/AdminPanel.tsx))
- `TenantDetail`'s Courses / Members / Remove sections now render `TenantCourses`,
  `TenantMembers`, `TenantRemoval`. A shared `SearchAddPicker` (type-to-filter, click to add) and
  `AssignedRow` (label + optional badge + Remove / locked note) back both assignment lists; live
  queries re-render on every write.
- Tenant admins in the members list are badged **Admin** with a "Remove via Allowlist" note (no
  remove control). Remove-tenant is disabled with an explanation of what's still assigned until all
  three counts hit zero, then removes behind a `window.confirm`; on success `TenantsManager` clears
  the selection.

**Verified:** `pnpm typecheck` clean; 451 tests pass (59 in `tenants.test.ts`); `pnpm build`
compiles `/admin`. UI behaviour is the pending browser check — needs an authed admin session (dev
has operator accounts only), matching how 11/13/19 were left. This was the last v1 dashboard
surface — the whitelabel dashboard now covers the full PRD scope.
