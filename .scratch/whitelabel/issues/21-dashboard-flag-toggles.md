# whitelabel/21: Dashboard — flag toggles

**Status:** open
**Depends on:** [17](17-feature-flag-enforcement.md), [19](19-dashboard-tenants-tab-shell.md)
**Labels:** ready-for-agent

Child of [Whitelabel PRD](../PRD.md). Ground truth:
[04 — Resolution](04-scope-per-tenant-feature-flags.md) decision 1;
[06 — Resolution](06-scope-operator-whitelabel-dashboard.md) decision 1.

## Why

This is the "Flags" section of 19's per-tenant panel — the only way an admin turns a feature on
or off without touching Convex directly. [17](17-feature-flag-enforcement.md) is what makes the
toggle actually mean something server-side.

## Scope

- A plain toggle row: one switch per flag (`certificates`, `translations`, `publicLinks`, `qa`,
  `seeding`) — no plan/preset picker (04's decision: flat booleans, four known tenants doesn't
  buy anything from a plan abstraction).
- Each toggle calls a `patch`-style mutation updating `tenants.flags`, scope-checked by
  `isCallerAdmin(ctx, tenantSlug)`.
- **No confirm dialog on flag-off** — 04 already established flag-off is frozen-not-revoked (no
  destructive edit exists), so this is a bare toggle, not a destructive action requiring an "are
  you sure."
- Also extend the client tenant context (11) to expose `flags`, if not already done there, so
  reader-side UI elsewhere in the app can hide flagged-off buttons (belt-and-suspenders over
  17's server-side throw — the server throw is what actually matters).

## Acceptance criteria

- Toggling a flag off/on in the dashboard immediately updates the tenant's `flags` and is
  reflected the next time [17](17-feature-flag-enforcement.md)'s `assertTenantFlag` is checked
  (no caching lag beyond Convex's normal reactivity).
- No confirm dialog appears when toggling a flag off.
- A tenant admin can toggle only their own tenant's flags.
