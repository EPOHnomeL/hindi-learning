# whitelabel/22: Dashboard — course/member assignment + tenant removal guard

**Status:** open
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
