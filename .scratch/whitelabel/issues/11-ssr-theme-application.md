# whitelabel/11: SSR theme application

**Status:** implemented (2026-07-16) — tenant-skin browser verify pending a `getTheme` deploy
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

---

## Resolution (2026-07-16, opus — `/tdd` + `/ponytail`)

Built the app's first server-side Convex fetch and the client tenant seam. Deps 07/09/10
were all met; main was green (typecheck clean, 367/367) before and after.

### What shipped

- **`convex/tenants.ts` `getTheme(slug)`** — one indexed `by_slug` read that resolves the whole
  frontend view: `{ displayName, theme: {light, dark?}, logoUrl, faviconUrl, flags }` (or `null`
  for an unknown slug = default site). Storage ids (logo/favicon) are surfaced as resolved urls;
  the returned `theme` is palette-only. **One query serves all three consumers** (SSR palette,
  server favicon, client context) so they can't drift. Public by design (ADR 0021 §6 — a slug
  only picks a skin). Tests in `convex/tenants.test.ts` (view / null / url-resolution).
- **`src/design/tokens.ts` `buildTenantThemeCss(theme)`** — the pure seam behind the no-flash
  `<style>`. Emits all 14 light tokens under **`:root:root`** (doubled `:root` beats Tailwind's
  `@theme :root` regardless of stylesheet source order — a plain `:root` would only tie) and a
  **partial** dark block (`:root:root[data-theme="dark"]`) with only the tenant's overridden
  tokens, so the rest fall through to globals.css's default dark via the cascade ("tenant dark,
  else default dark", decision 03 #5). No dark block when the tenant has none. Pinned in
  `tokens.test.ts`.
- **`src/lib/tenant-server.ts` `getTenantView()`** — resolves slug (issue 10) then `fetchQuery`s
  `getTheme`. **Guarded**: this fetch is in the root layout (every route), so a failure degrades
  to the default skin and logs, never 500s the site (small addition beyond the literal spec —
  a load-bearing external fetch on the root layout shouldn't be a single point of failure).
- **`src/app/layout.tsx`** — now async: injects `<style id="tenant-theme">` before the existing
  pre-paint dark-mode `<script>` (composes — the style supplies both states' values, the script
  only toggles the attribute); `generateMetadata` sets the per-host favicon **and** browser-tab
  title from the tenant (title override is a cheap whitelabel win reusing the same fetch — flag
  if unwanted); passes the resolved slug to the client provider.
- **`src/app/_components/TenantContext.tsx` + `ConvexClientProvider`** — the single client seam.
  Server hands the slug down (one resolution point, no client host-parsing); a `useQuery` resolves
  the flash-tolerant `{ displayName, logoUrl, flags }`. `undefined` while loading, `null` on the
  default site / unseeded host, the tenant object otherwise. Downstream (04/13/15/dashboard) read
  from `useTenant()`.

### Verification

- **Unit:** 367/367 pass (incl. the new `getTheme` + `buildTenantThemeCss` tests); `tsc` clean.
- **Server path (dev server, `Host: upf.localhost`):** middleware resolved slug `upf` → root
  layout called `getTenantView()` → attempted `fetchQuery(getTheme)`. Both the default site and
  the tenant host returned **200** with no crash; the default site is byte-for-byte unchanged (no
  `tenant-theme` style, default title/favicon). ✓ AC "default site unchanged" + wiring proven.
- **⚠ Blocked — the tenant skin actually painting:** the server-side fetch hits the live **dev
  deployment**, which does **not** have `getTheme` deployed yet (`Could not find public function
  for 'tenants:getTheme'`). This session has **no Convex CLI access to the project** (`npx convex
  dev`/`codegen` → "You don't have access to the selected project"), so I could not deploy it.
  **Next session / the user:** run `npx convex dev` (or `--once`) to deploy `getTheme` to dev, then
  visit `<slug>.localhost:3000` (Chrome routes `*.localhost` → 127.0.0.1) to confirm the palette
  applies with no flash in both light and dark. No schema change was made (the `tenants` table +
  theme validator already exist from issue 07), so the push is purely additive of one query.

### Notes for the chain

- **13** (`buildSrcDoc` `tenantPalette`) and **15** (certificate) read the palette/identity from
  the client `useTenant()` seam built here.
- The `getTheme` name returns more than a theme (displayName/flags/urls) — kept the spec's name
  since it's the `fetchQuery` target the docs pin; documented the scope in its doc comment.
