# course-publishing/08 — research lead-in: how tenant subdomains are configured & served today

Captured 2026-07-19 for [ticket 08](08-tenant-domain-links.md). Facts with file:line refs;
ground-truth for the 4 grilling decisions. **Don't re-derive.**

## 1. Root/base domain — derived, never stored

- **No `rootDomain`/`baseDomain`/custom-host column exists anywhere.** The literal
  `my-course.app` appears only in comments/ADRs, never in executable code.
- Base domain is **computed from the incoming host** by stripping the leftmost label —
  `canonicalRedirect` at [src/lib/tenant.ts:40-54](../../src/lib/tenant.ts#L40): strips a
  leading known-tenant label or `www`, keeps the rest as `base`, re-prefixes the target tenant.
- Tenant labels are a hardcoded tuple: `TENANT_SLUGS = ["upf", "ywampotch",
  "almighty-warriors", "yknot"]` — [src/lib/tenant.ts:11](../../src/lib/tenant.ts#L11).
- ADR 0022 §1 says per-tenant domain is **derivable as `<slug>.my-course.app`**; explicit
  custom-domain column is deferred fog.

## 2. Host → tenant resolution — server-side, edge middleware

- Pure resolver `resolveTenantSlug(host)` — [src/lib/tenant.ts:24-28](../../src/lib/tenant.ts#L24):
  takes the first host label, returns it only if in the known set, else `null` (default site).
- Middleware [src/middleware.ts:13-28](../../src/middleware.ts#L13) reads the `host` header,
  **deletes any inbound `x-tenant-slug` (anti-spoof)**, restamps it + `x-url`.
- Server reads it back via `getTenantSlug()` — [src/lib/tenant-server.ts:12-15](../../src/lib/tenant-server.ts#L12).
- Tenant slug reaches Convex as a **query arg** (spoof-safe; privileged actions guarded by identity).

## 3. `tenants` table — four columns, no host field

[convex/schema.ts:75-80](../../convex/schema.ts#L75): `{ slug, displayName, theme, flags }`,
indexed `by_slug`. Flags = `{ certificates, translations, publicLinks, qa, seeding }` (the
`selling` flag from ticket 02 is a planned sixth). **The subdomain host is the only per-tenant
origin identity, and it is derived from `slug`, never stored.**

## 4. Invite-email tenant-awareness (issue 14, commit `40fe67a`) — brand only, NOT origin

- `tenantBrand(ctx, slug)` — [convex/shares.ts:48-63](../../convex/shares.ts#L48): reusable
  `by_slug` read → `{ name, light, logoUrl }`. This is the reusable **tenant-record lookup** seam.
- **But the invite LINK origin is still deployment-wide**: `scheduleInvite` builds
  `` `${process.env.APP_BASE_URL}/...` `` inline — [convex/shares.ts:16-41](../../convex/shares.ts#L16).
  Tenant only drives `brand:`, not the host. **So issue 14 did NOT create an origin resolver;
  this ticket introduces the first one.**

## 5. Server-side reachability (PayFast ITN) — already fine

- All four `<slug>.my-course.app` hosts are **live over HTTPS with valid TLS** (four explicit
  `cname.vercel-dns.com` CNAMEs on the Vercel project) — whitelabel ticket 05 (done), ADR 0022.
- **But `notify_url` doesn't use a subdomain anyway**: it points at the Convex deployment —
  `` `${process.env.CONVEX_SITE_URL}/payfast/notify` `` — [convex/market.ts:434](../../convex/market.ts#L434).
  Tenant-agnostic `*.convex.site` HTTP action. **ITN reachability is a non-issue.**

## 6. `appUrl` call sites + the full link inventory

`appUrl` — [convex/payfast.ts:232-244](../../convex/payfast.ts#L232) — builds off `env().SITE_URL`,
enforces same-origin (the open-redirect guard to preserve). There is **no single origin seam**;
four mechanisms:

| Link group | Built where | Origin source today | Tenant-aware? |
|---|---|---|---|
| Checkout return / cancel | `market.ts:432-433` via `appUrl` | `SITE_URL` (Convex env) | ← the target |
| Checkout notify (ITN) | `market.ts:434` | `CONVEX_SITE_URL` | stays deployment-wide |
| Invite links | `shares.ts:16-41` (inline) | `APP_BASE_URL` (env) | brand yes, origin no |
| Share / public links | `Editions.tsx:336-337` (**client**) | `window.location.origin` | inherits owner's host |
| Catalogue / content blobs | `lib.ts:96-99` | `CONVEX_SITE_URL` | tenant-agnostic bearer |

**Key gap:** checkout uses `SITE_URL`, invites use `APP_BASE_URL`, public links use client
`window.location.origin`, base domain lives only inside `canonicalRedirect`. None take `tenantSlug`.
