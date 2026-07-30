---
type: task
blocked_by: [17, 19]
---
# Dashboard — flag toggles

## Question

This is the "Flags" section of 19's per-tenant panel — the only way an admin turns a feature on or
off without touching Convex directly. 17 is what makes the toggle actually mean something
server-side. Ground truth: 04 decision 1; 06 decision 1. Scope:

- A plain toggle row: one switch per flag (`certificates`, `translations`, `publicLinks`, `qa`,
  `seeding`) — no plan/preset picker.
- Each toggle calls a `patch`-style mutation updating `tenants.flags`, scope-checked by
  `isCallerAdmin(ctx, tenantSlug)`.
- **No confirm dialog on flag-off** — 04 established flag-off is frozen-not-revoked (no destructive
  edit exists), so this is a bare toggle.
- Also extend the client tenant context (11) to expose `flags` if not already, so reader-side UI can
  hide flagged-off buttons (belt-and-suspenders over 17's server throw).

## Done when

Toggling a flag off/on immediately updates the tenant's `flags` and is reflected the next time 17's
`assertTenantFlag` is checked (no caching lag beyond Convex reactivity); no confirm dialog appears
when toggling off; a tenant admin can toggle only their own tenant's flags.

## Answer

Built test-first (`/tdd`) and minimal (`/ponytail`), 2026-07-18.

**Backend** — `tenants.setTenantFlags` (`convex/tenants.ts`): a patch-style write (each flag
`v.optional`, merged onto the existing `flags`, so one flag per switch is enough), scope-gated by
`isCallerAdmin(ctx, tenantSlug)` — sys admin any tenant, tenant admin only their own. No confirm
dialog and no destructive edit: flag-off is frozen-not-revoked, the flip only changes what
`assertTenantFlag` (17) permits going forward. Tests in `convex/tenants.test.ts` (patch-only,
toggle-back-on, own-tenant vs another, member refused, unknown slug — 5 pass).

**Frontend** (`AdminPanel.tsx`): the Flags `<TenantSection>` renders `<FlagToggles>` — one plain
switch per flag over `setTenantFlags`, driven by the live `getTheme` query so a flip reflects
immediately; a per-key busy guard blocks a double-click mid-write. No plan/preset picker, no confirm dialog.

**Client tenant context (11)** already exposes `flags` — `TenantContext`'s `Tenant` type is
`FunctionReturnType<getTheme>`, and `getTheme` returns `flags` — so no change needed. Wiring each
reader-side button to hide on a flagged-off flag is left out of this tight scope; the server throw
(17) is the real boundary and `useTenant().flags` is available for that belt-and-suspenders later.

Shipped across commits `01b4185` (backend `setTenantFlags` + tests — swept in by a concurrent
issue-22 commit that staged the shared `convex/tenants.ts`) and `3c52e04` (the `FlagToggles` UI).
Typecheck clean. Browser check pending (needs an authed admin session), as with 11/13/19.
(Note: commit `3c52e04`'s subject line is a stray `@` from a here-string quoting slip; the body and
code are correct — left unfixed because `--amend`/history-rewrite is barred while other sessions
share this `main` working tree.)
