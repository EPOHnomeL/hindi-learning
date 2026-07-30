---
type: task
blocked_by: [08]
---
# Dashboard — Tenants tab shell

## Question

This is the navigation shell every other dashboard issue (20–22) mounts inside — build it once,
scope-gated correctly, before any per-section editors. Ground truth: 06's resolution decisions 1,
2, 5, 6 and the winning prototype layout. Scope:

- `AdminPanel.tsx`: add a "Tenants" tab alongside the existing "Allowlist" tab.
- **Sys admin** view: a sidebar tenant list (query all `tenants` rows) + a "+ New tenant" action
  (create mutation — slug + displayName, seeded default theme/flags, sys-admin-only) + selecting any
  tenant.
- **Tenant admin** view: no sidebar/picker — locked to their own tenant's panel (from the caller's
  `whitelist.tenantSlug`).
- Selected-tenant panel = the **stacked-scroll layout**: Theme → Flags → Courses → Members →
  Remove-tenant, sections on one scrolling page, no sub-tab navigation. This issue builds the shell +
  section scaffolding; 20–22 fill in each section.
- Gate the whole tab (and every mutation) with `isCallerAdmin(ctx, tenantSlug)` (08).

## Done when

A sys admin sees the tenant list, can create a new tenant, and can select any tenant to view its
panel; a tenant admin sees only their own tenant's panel directly (no picker/create); the panel
layout matches the stacked-scroll structure with all section headings in place before 20–22 add content.

## Answer

Built test-first 2026-07-17 (`convex/tenants.test.ts` +7, `convex/whitelist.test.ts` +1 → 50 pass),
minimal (ponytail) — shell + section scaffolding only.

**Backend**
- **`whitelist.myAdminScope`** — one indexed read returning `{ role: "sys"|"tenant"|"none",
  tenantSlug }`. Backs the scope-aware `/admin` shell; `amIAdmin` (and its ~4 call sites) untouched.
  This is what now admits a **tenant admin** to `/admin` at all (previously gated on sys-only `amIAdmin`).
- **`tenants.listTenants`** — sys-admin-only (`isCallerAdmin(ctx)` unscoped), slug + displayName,
  sorted by name. Full scan of the operator-bounded table (same posture as `whitelist.list`).
- **`tenants.createTenant`** — sys-admin-only. Normalises the slug (trim + lower-case, `[a-z0-9-]`),
  refuses dupes, seeds `DEFAULT_TENANT_THEME` (the house `--color-*` light palette mirrored from
  globals.css) + all-on `DEFAULT_TENANT_FLAGS` so the row is immediately SSR/`getTheme`-resolvable;
  the operator paints the real brand in ticket 20.

**Frontend** (`src/app/_components/AdminPanel.tsx`)
- `AdminPanel` gates on `myAdminScope`: `none` → not-authorised; `sys` → `SysAdminDashboard`
  (Allowlist | Tenants tab switcher, Allowlist default); `tenant` → the tenant's own panel directly.
- `TenantsManager` (sys): sidebar `listTenants` + `NewTenantForm` on the left, selected tenant's
  panel on the right (nothing selected on first load).
- `TenantDetail`: the stacked-scroll layout — Theme → Flags → Courses → Members → Remove tenant, each
  a `TenantSection` with heading + placeholder pointing at its filling ticket (20–22). Its
  `displayName` comes from the public `getTheme` read, so it serves both admin tiers with no extra query.

**Verified:** typecheck clean; 50 convex tests pass; `pnpm build` compiles `/admin`. UI behaviour
(both tiers, create, select) is the pending browser check — dev has operator accounts only; a
tenant-admin session needs prod data.
