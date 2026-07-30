---
type: task
blocked_by: [07]
---
# Tenant resolution middleware

## Question

Every tenant-aware surface (theme, flags, dashboard scope, cross-host redirect) needs to know
"which tenant is this request for" before it can do anything. This is the one place that answers
that. Ground truth: ADR 0021 §6. Scope:

- Extend `src/middleware.ts` (today just the Convex Auth wrapper): read the `Host` header, take the
  leftmost label, match against the four known tenant slugs (ponytail leans a static known-slugs
  list over a per-request Convex read, since new tenants are an operator task). No match / bare
  `my-course.app` / `www.my-course.app` → default.
- Thread the resolved slug to the client as a **spoof-safe Convex query arg** — it only selects
  catalogue + skin; no privileged action may trust it.
- Local dev: `<slug>.localhost:3000` resolves without a hosts-file edit; verify the host-parsing
  handles the `:3000` port suffix.
- Does **not** build theme application (11), the redirect (18), or dashboard scope (19).

## Done when

Visiting `ywampotch.my-course.app` (or `ywampotch.localhost:3000`) resolves to `ywampotch`;
`my-course.app` or an unrecognised subdomain resolves to no tenant; the resolved slug is available
to both server components and the client; no behaviour change for the default site.

## Answer

Built test-first (2026-07-16). **Seam:** the pure `resolveTenantSlug(host)` — 13 cases in
`src/lib/tenant.test.ts` (subdomain, hyphenated slug, `<slug>.localhost:3000`, case-insensitivity,
apex/www/unknown → null, null/undefined).

- **Resolver** (`src/lib/tenant.ts`): `TENANT_SLUGS` (static — adding a tenant is an operator task,
  no per-request Convex read on the hot path), `resolveTenantSlug` (strip port → lowercase →
  leftmost label → match), and `TENANT_SLUG_HEADER`. Pure; runs in middleware, server, or client.
- **Middleware** (`src/middleware.ts`): the Convex Auth wrapper's custom handler resolves from Host
  and forwards `x-tenant-slug`, **deleting any inbound value first** so a client can't force a skin.
  Convex Auth ports its cookies onto the returned `NextResponse.next`.
- **Server read** (`src/lib/tenant-server.ts`): `getTenantSlug()` reads the header with a **direct
  Host fallback**, so correctness never depends on the header surviving Convex Auth's response
  re-wrap. This is what 11's layout/context consumes.

**Verified at runtime** (dev + a temporary probe route, since removed): `localhost` → null;
`ywampotch.localhost:3000` → `ywampotch`; `almighty-warriors.my-course.app` → `almighty-warriors`;
`yknot.my-course.app` → `yknot`; `www.*`/unknown → null; **spoof** (`Host: my-course.app` +
`x-tenant-slug: yknot`) → null. Default & tenant homepages both 200, auth intact. Full suite
305/305; typecheck + `pnpm build` clean. **Unblocks 11, 18.**
