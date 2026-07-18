# whitelabel/19: Dashboard — Tenants tab shell

**Status:** implemented (2026-07-17, `/tdd` + `/ponytail`) — UI browser check pending (needs
an authed sys-admin + tenant-admin session; backend authz is fully unit-tested)
**Depends on:** [08](08-scope-aware-admin-roles.md)
**Labels:** ready-for-agent

Child of [Whitelabel PRD](../PRD.md). Ground truth:
[06 — Resolution](06-scope-operator-whitelabel-dashboard.md) decisions 1, 2, 5, 6 and the winning
prototype layout.

## Why

This is the navigation shell every other dashboard issue (20–22) mounts inside — build it once,
scope-gated correctly, before any of the per-section editors.

## Scope

- `AdminPanel.tsx`: add a "Tenants" tab alongside the existing "Allowlist" tab (a simple tab
  switcher, matching the existing component's style).
- **Sys admin** view: a sidebar tenant list (query all `tenants` rows) + a "+ New tenant" action
  (create mutation — slug + displayName, seeded with default theme/flags, scope-checked
  sys-admin-only) + the ability to select any tenant.
- **Tenant admin** view: no sidebar/picker — locked directly to their own tenant's panel (derive
  from the caller's own `whitelist.tenantSlug`).
- Selected-tenant panel is the **stacked-scroll layout** the prototype settled on: Theme → Flags
  → Courses → Members → Remove-tenant, as sections on one scrolling page, no sub-tab navigation.
  This issue builds the shell + section scaffolding (headings, layout); 20–22 fill in each
  section's actual content and mutations.
- Gate the whole tab (and every mutation it calls) with `isCallerAdmin(ctx, tenantSlug)` from
  [08](08-scope-aware-admin-roles.md).

## Acceptance criteria

- A sys admin sees the tenant list, can create a new tenant, and can select any of the four (or
  a newly created) tenants to view its panel.
- A tenant admin sees only their own tenant's panel directly, with no picker and no create
  action.
- The panel layout matches the stacked-scroll structure (sections in order: Theme, Flags,
  Courses, Members, Remove tenant) — even before 20–22 add real content, the section headings and
  scroll structure are in place.

## Resolution (2026-07-17)

Built test-first (`convex/tenants.test.ts` +7, `convex/whitelist.test.ts` +1 → 50 pass) and
kept minimal (ponytail) — the shell + section scaffolding only; 20–22 fill each section.

**Backend**
- **`whitelist.myAdminScope`** — one indexed read returning `{ role: "sys"|"tenant"|"none",
  tenantSlug }`. Backs the scope-aware `/admin` shell; `amIAdmin` (and its ~4 call sites) left
  untouched. This is what now admits a **tenant admin** to `/admin` at all — previously the page
  gated on sys-only `amIAdmin`.
- **`tenants.listTenants`** — sys-admin-only (`isCallerAdmin(ctx)` unscoped), slug + displayName,
  sorted by name. Full scan of the operator-bounded `tenants` table (same posture as
  `whitelist.list`).
- **`tenants.createTenant`** — sys-admin-only. Normalises the slug (trim + lower-case,
  `[a-z0-9-]` only), refuses dupes, seeds `DEFAULT_TENANT_THEME` (the house `--color-*` light
  palette, mirrored from globals.css) + all-on `DEFAULT_TENANT_FLAGS` so the row is immediately
  SSR/`getTheme`-resolvable; the operator paints the real brand in ticket 20.

**Frontend** ([src/app/_components/AdminPanel.tsx](../../../src/app/_components/AdminPanel.tsx))
- `AdminPanel` now gates on `myAdminScope`: `none` → not-authorised; `sys` → `SysAdminDashboard`
  (Allowlist | Tenants tab switcher, Allowlist default); `tenant` → the tenant's own panel
  **directly**, no tabs/picker/create.
- `TenantsManager` (sys): sidebar `listTenants` + `NewTenantForm` on the left, selected tenant's
  panel on the right (nothing selected on first load).
- `TenantDetail`: the stacked-scroll layout — Theme → Flags → Courses → Members → Remove tenant,
  each a `TenantSection` with heading + placeholder pointing at its filling ticket (20–22). Its
  `displayName` comes from the public `getTheme` read, so it serves both admin tiers with no extra
  query.

**Verified:** `pnpm typecheck` clean; 50 convex tests pass; `pnpm build` compiles the `/admin`
route. UI behaviour (both tiers, create, select) is the pending browser check — matches how 11/13
were left in this feature (dev has operator accounts only; a tenant-admin session needs prod data).
