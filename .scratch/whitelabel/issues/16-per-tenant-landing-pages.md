# whitelabel/16: Per-tenant landing pages

**Status:** open
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
