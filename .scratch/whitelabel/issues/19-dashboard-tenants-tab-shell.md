# whitelabel/19: Dashboard — Tenants tab shell

**Status:** open
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
