---
type: task
blocked_by: [07, 09, 10]
---
# SSR theme application

## Question

This is the core "each tenant looks like its own site" mechanism — the first server-side Convex
fetch in the app, and the thing every other themed surface (13, 14, 15, 16) reads from. Ground
truth: 03 decision 5 + the theme record shape; 04 implementation issue 4. Scope:

- Root layout (`src/app/layout.tsx`): read `Host` → resolved slug (10) → `await fetchQuery` a new
  `tenants.getTheme` query → inject `<style id="tenant-theme">` defining the 14 `--color-*` vars for
  `:root` (light) and `:root[data-theme="dark"]` (tenant dark, else default dark) — **before** the
  existing dark-mode script, so it composes.
- Favicon via `generateMetadata` (server-side, same resolved host).
- **Client tenant context:** one `useQuery` resolving `{ displayName, logoUrl, flags }` (logo is
  flash-tolerant, client-side). The single seam 04's flag UI, 13's reader, 15's certificate, and the
  dashboard read from — build it once here.
- No Next-level caching this pass (ponytail).

## Done when

Visiting a tenant subdomain renders that tenant's palette before first paint (no flash), light and
dark; the default site is unchanged; the client tenant context returns undefined (loading) then the
resolved `{ displayName, logoUrl, flags }` (or a no-tenant shape); favicon reflects the tenant's
favicon (or the shared default) per host.

## Answer

Built 2026-07-16 (opus, `/tdd` + `/ponytail`) — the app's first server-side Convex fetch and the
client tenant seam. Deps 07/09/10 met; main green (367/367) before and after.

- **`convex/tenants.ts` `getTheme(slug)`** — one indexed `by_slug` read resolving the whole
  frontend view: `{ displayName, theme: {light, dark?}, logoUrl, faviconUrl, flags }` (or `null` for
  an unknown slug = default site). Storage ids surfaced as resolved urls. One query serves all three
  consumers (SSR palette, server favicon, client context) so they can't drift. Public by design
  (ADR 0021 §6). Tests in `convex/tenants.test.ts`.
- **`src/design/tokens.ts` `buildTenantThemeCss(theme)`** — the pure seam behind the no-flash
  `<style>`. Emits all 14 light tokens under **`:root:root`** (doubled `:root` beats Tailwind's
  `@theme :root` regardless of source order) and a **partial** dark block with only overridden
  tokens (rest fall through to globals.css's default dark). No dark block when the tenant has none.
- **`src/lib/tenant-server.ts` `getTenantView()`** — resolves slug (10) then `fetchQuery`s
  `getTheme`. **Guarded:** a failure degrades to the default skin and logs, never 500s the site
  (a load-bearing root-layout fetch shouldn't be a single point of failure).
- **`src/app/layout.tsx`** — now async: injects the style before the pre-paint dark-mode script;
  `generateMetadata` sets per-host favicon **and** browser-tab title from the tenant; passes the
  slug to the client provider.
- **`src/app/_components/TenantContext.tsx` + `ConvexClientProvider`** — the single client seam. A
  `useQuery` resolves the flash-tolerant `{ displayName, logoUrl, flags }`; `undefined` loading,
  `null` on default/unseeded, tenant object otherwise. Downstream reads via `useTenant()`.

**Verification:** unit 367/367, tsc clean. Server path (dev, `Host: upf.localhost`): middleware →
`getTenantView()` → attempted `fetchQuery`; both default and tenant host returned 200, default site
byte-for-byte unchanged.

**⚠ Blocked — the tenant skin actually painting:** the server-side fetch hits the live dev
deployment, which did not have `getTheme` deployed yet (`Could not find public function for
'tenants:getTheme'`), and this session had no Convex CLI access to deploy it. Next session/user: run
`npx convex dev` to deploy `getTheme`, then visit `<slug>.localhost:3000` to confirm the palette
applies with no flash in light and dark. No schema change was made (purely additive of one query).
The `getTheme` name returns more than a theme (displayName/flags/urls); kept the spec's name since
it's the `fetchQuery` target the docs pin.
