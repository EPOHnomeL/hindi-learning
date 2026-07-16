# whitelabel/11: SSR theme application

**Status:** open
**Depends on:** [07](07-tenant-schema-and-seed.md), [09](09-design-token-contract-cleanup.md),
[10](10-tenant-resolution-middleware.md)
**Labels:** ready-for-agent

Child of [Whitelabel PRD](../PRD.md). Ground truth:
[03 — Resolution](03-scope-per-tenant-theming.md) decisions 5 and the theme record shape;
[04 — implementation issue 4](04-scope-per-tenant-feature-flags.md).

## Why

This is the core "each tenant looks like its own site" mechanism — the first server-side Convex
fetch in the app, and the thing every other themed surface (13, 14, 15, 16) reads from.

## Scope

- Root layout (`src/app/layout.tsx`, currently a Server Component with only the dark/light
  no-flash script): read the `Host` header → resolved slug (from 10) → `await fetchQuery` a new
  `tenants.getTheme` query (`convex/nextjs`) → inject a `<style id="tenant-theme">` defining the
  14 `--color-*` vars for `:root` (light) and `:root[data-theme="dark"]` (tenant dark, else the
  shared default dark palette) — **before** the existing dark-mode script runs, so it composes:
  the script only toggles the attribute, this style supplies both states' values.
- Favicon via `generateMetadata` (also server-side, reads the same resolved host).
- **Client tenant context**: one `useQuery` resolving `{ displayName, logoUrl, flags }` for the
  resolved tenant (logo is flash-tolerant — delivered client-side, not baked into the no-flash
  `<style>`). This is the single seam 04's flag-gated UI, 13's lesson reader, 15's certificate,
  and the future dashboard read from — build it once here.
- No Next-level caching in this pass (ponytail: the per-request tenant read is one indexed
  lookup; add caching later only if SSR latency shows up in practice).

## Acceptance criteria

- Visiting a tenant subdomain renders with that tenant's palette applied before first paint (no
  flash of default colors), in both light and dark mode.
- Visiting the default site is unchanged.
- The client tenant context returns `undefined` (loading) then the resolved `{ displayName,
  logoUrl, flags }` (or a "no tenant" shape) for any component that consumes it.
- Favicon reflects the tenant's uploaded favicon (or the shared default) per host.
