# whitelabel/21: Dashboard — flag toggles

**Status:** done
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

## Resolution (2026-07-18)

Built test-first (`/tdd`) and minimal (`/ponytail`).

**Backend** — `tenants.setTenantFlags` ([convex/tenants.ts](../../../convex/tenants.ts)): a
patch-style write (each flag `v.optional`, merged onto the existing `flags`, so one flag per
switch is enough), scope-gated by `isCallerAdmin(ctx, tenantSlug)` — sys admin any tenant, tenant
admin only their own. No confirm dialog and no destructive edit: flag-off is frozen-not-revoked,
the flip only changes what `assertTenantFlag` (issue 17) permits going forward. Tests in
[convex/tenants.test.ts](../../../convex/tenants.test.ts) (patch-only, toggle-back-on, own-tenant
vs another, member refused, unknown slug — 5 pass).

**Frontend** ([AdminPanel.tsx](../../../src/app/_components/AdminPanel.tsx)): the Flags
`<TenantSection>` renders `<FlagToggles>` — one plain switch per flag (`certificates`,
`translations`, `publicLinks`, `qa`, `seeding`) over `setTenantFlags`, driven by the live
`getTheme` query so a flip reflects immediately; a per-key busy guard blocks a double-click
mid-write. No plan/preset picker, no confirm dialog (04's decisions).

**Client tenant context (11)** already exposes `flags` — `TenantContext`'s `Tenant` type is
`FunctionReturnType<getTheme>`, and `getTheme` returns `flags` — so no change was needed there.
Wiring each reader-side button to hide on a flagged-off flag is left out of this tight scope; the
server throw (17) is the real boundary and `useTenant().flags` is available for that belt-and-
suspenders when a later ticket wants it.

Shipped across commits `01b4185` (backend `setTenantFlags` + tests — swept in by a concurrent
issue-22 commit that staged the shared `convex/tenants.ts`) and `3c52e04` (the `FlagToggles` UI).
`pnpm typecheck` clean. Browser check pending (needs an authed admin session), as with 11/13/19.

> Note: commit `3c52e04`'s subject line is a stray `@` (a here-string quoting slip); the body and
> code are correct. Left unfixed because `--amend`/history-rewrite is barred while other sessions
> share this `main` working tree.

