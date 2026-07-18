# whitelabel/16: Per-tenant landing pages

**Status:** done
**Depends on:** [11](11-ssr-theme-application.md)
**Labels:** ready-for-agent

Child of [Whitelabel PRD](../PRD.md). Ground truth:
[03 — Resolution](03-scope-per-tenant-theming.md) decision 4.

## Why

Landing pages are the one themed surface that's deliberately **not** dashboard-editable content —
this issue builds the registry mechanism the operator will hand-author each tenant's page into,
not any particular tenant's actual copy.

## Scope

- `src/app/_landing/registry.ts`: a slug → component map.
- `page.tsx`'s `<Unauthenticated>` branch selects the registered component for the resolved
  tenant slug, falling back to the default `<Landing/>` when a tenant has no bespoke page
  registered yet (all four tenants fall back to `<Landing/>` at first — that's expected and
  correct, since `<Landing/>` still re-skins via the tenant's palette).
- Custom landing pages render under the resolved host, so they inherit the SSR palette (11) and
  may layer bespoke styling on top of it.
- **No database involvement, nothing runtime-editable.** New/changed landing pages ship via
  commit + deploy, same as any other code change — this is explicitly out of the dashboard's
  reach (06/20).

## Acceptance criteria

- Visiting any tenant subdomain with no registered landing component still renders the default
  `<Landing/>`, re-skinned with that tenant's palette.
- Registering a component for a slug in `registry.ts` makes that tenant's subdomain render it
  instead, without touching any other tenant's route.
- The default site (`my-course.app`) is unaffected.

## Resolution (2026-07-18)

Built the registry mechanism only — no bespoke tenant pages (correct v1 deliverable;
authoring copy is later content work, `06`/`20` keep it out of the dashboard).

- **`src/app/_landing/registry.ts`** — `LANDING_REGISTRY` (a `slug → component` map,
  **empty at v1**) plus `landingFor(slug, registry?)`, a pure, registry-injectable
  lookup that returns the registered component or `null`. Import-light on purpose
  (types only, no `Landing` import) so it unit-tests under the `edge-runtime` vitest
  env. Covered by `registry.test.ts`: every real slug → `null` (falls through),
  default site (`null` slug) → `null`, a registered slug resolves and doesn't leak to
  siblings, and the shipped map is empty.
- **`TenantContext.tsx`** — added `useTenantSlug()` over a new `SlugCtx`. The registry
  keys on the slug (not the theme) and must resolve while `<Unauthenticated>`, before
  the `getTheme` query, so the slug rides its own context rather than being derived
  from the tenant object (which omits it). One resolution point preserved (issue 10):
  `TenantProvider` already received `slug` server-side.
- **`page.tsx`** — the `<Unauthenticated>` branch now renders
  `landingFor(slug) ?? Landing`. All four tenants fall back to `<Landing/>` today,
  which still re-skins via the SSR palette (issue 11).

Gates green: `pnpm typecheck`, `pnpm build`, and `vitest run src/app/_landing`. Full
suite has one unrelated red (`convex/invite-emails.test.ts` — another session's
in-flight invites/tenant-branding work, not touched here). **Browser render check
pending** (same posture as 11/13/19–22/24).
