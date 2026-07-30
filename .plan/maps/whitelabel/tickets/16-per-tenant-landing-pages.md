---
type: task
blocked_by: [11]
---
# Per-tenant landing pages

## Question

Landing pages are the one themed surface that's deliberately **not** dashboard-editable content —
this issue builds the registry mechanism the operator will hand-author each tenant's page into, not
any particular tenant's actual copy. Ground truth: 03 decision 4. Scope:

- `src/app/_landing/registry.ts`: a slug → component map.
- `page.tsx`'s `<Unauthenticated>` branch selects the registered component for the resolved tenant
  slug, falling back to the default `<Landing/>` when a tenant has no bespoke page (all four fall
  back at first — `<Landing/>` still re-skins via the tenant's palette).
- Custom landing pages render under the resolved host, so they inherit the SSR palette (11) and may
  layer bespoke styling on top.
- **No database involvement, nothing runtime-editable.** New/changed pages ship via commit + deploy
  — explicitly out of the dashboard's reach (06/20).

## Done when

Visiting any tenant subdomain with no registered landing component still renders the default
`<Landing/>`, re-skinned with that tenant's palette; registering a component for a slug in
`registry.ts` makes that tenant's subdomain render it instead, without touching any other tenant's
route; the default site is unaffected.

## Answer

Resolved 2026-07-18 — built the registry mechanism only, no bespoke tenant pages (correct v1
deliverable; authoring copy is later content work).

- **`src/app/_landing/registry.ts`** — `LANDING_REGISTRY` (a slug → component map, **empty at v1**)
  plus `landingFor(slug, registry?)`, a pure, registry-injectable lookup returning the registered
  component or `null`. Import-light on purpose (types only, no `Landing` import) so it unit-tests
  under the `edge-runtime` vitest env. Covered by `registry.test.ts`: every real slug → `null`,
  default site (null slug) → `null`, a registered slug resolves and doesn't leak to siblings, and
  the shipped map is empty.
- **`TenantContext.tsx`** — added `useTenantSlug()` over a new `SlugCtx`. The registry keys on the
  slug (not the theme) and must resolve while `<Unauthenticated>`, before the `getTheme` query, so
  the slug rides its own context rather than being derived from the tenant object (which omits it).
  One resolution point preserved (10): `TenantProvider` already received `slug` server-side.
- **`page.tsx`** — the `<Unauthenticated>` branch now renders `landingFor(slug) ?? Landing`. All
  four tenants fall back to `<Landing/>` today, which still re-skins via the SSR palette (11).

Gates green: `pnpm typecheck`, `pnpm build`, `vitest run src/app/_landing`. Full suite has one
unrelated red (`convex/invite-emails.test.ts` — another session's in-flight work, not touched here).
**Browser render check pending** (same posture as 11/13/19–22/24).
