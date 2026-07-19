# course-publishing/08: Tenant-domain link generation

**Status:** done
**Resolved:** 2026-07-19 (session 92134b96)
**Depends on:** —
**Labels:** wayfinder:grilling

Child of [Course publishing map](00-course-publishing-map.md).

Surfaced resolving [ticket 03 — Define the "publish" action](03-define-publish-action.md)
(2026-07-18): the user requires that **buy / share / public links for a tenant's course be generated
on the owning tenant's subdomain**, not the deployment-wide default origin ("make sure the links come
from the tenant domain").

## Question

Today `appUrl` ([convex/payfast.ts:232](../../../convex/payfast.ts#L232)) builds **every** link off a
single `SITE_URL` env origin — checkout `return_url` / `cancel_url` / `notify_url`
([`buildCheckoutFields`](../../../convex/payfast.ts#L115)), and (via the same helper family) share /
public / invite links. It also **enforces same-origin against `SITE_URL`** — an absolute or
protocol-relative off-origin path is discarded to the origin root, closing an open-redirect that would
otherwise flow into PayFast's return URLs. There is **no tenant awareness**: a tenant course's buy
link lands on the default domain. Decide, via `/grilling` (expect a short `research` lead-in on how
subdomains are configured/served today — url-routing + whitelabel):

1. **Origin resolution** — given a course's `tenantSlug`, how is its subdomain origin derived? A
   convention over one base domain (`<slug>.<root>`)? A per-tenant configured host? Where does the
   root/base live (env, `tenants` row)? Reconcile with how the app already serves tenant subdomains
   (whitelabel; `url-routing` scratch).
2. **Preserving the open-redirect guard** — `appUrl`'s same-origin check currently keys off the one
   `SITE_URL`. A tenant-aware version must validate against the *resolved tenant origin* (a bounded
   allow-set of known tenant hosts), never trust an arbitrary host, and still discard off-origin paths
   into PayFast's return/cancel/notify fields. Pin the trusted-origin set.
3. **Which links are in scope** — checkout URLs (return/cancel/notify), the per-Edition public link,
   share links, catalogue/course deep-links. Default-site courses (no `tenantSlug`) keep `SITE_URL`.
   Confirm the list; note any that must stay on the default origin (e.g. PayFast ITN `notify_url`
   reachability — does the subdomain resolve server-side for the ITN callback?).
4. **Interaction with existing whitelabel work** — invite-email branding already went tenant-aware
   (whitelabel issue 14); does that establish the origin-resolution pattern this should reuse, or did
   it hardcode? Don't fork a second convention.

Resolve, comment, close, add a Decisions-so-far line to the map. Feeds the PRD
([ticket 06](06-prd-and-issue-breakdown.md)).

## Resolution (2026-07-19)

Research lead-in captured in [08-research-subdomain-serving.md](08-research-subdomain-serving.md)
(how subdomains are configured/served today — ground truth, don't re-derive). Grilled with the user,
one decision at a time. The `/ponytail` posture held: four known tenants, one convention, no
speculative multi-tenant origin machinery.

**Decisive facts that shaped the answers:**

- The base domain is **never stored** — it's derived by stripping the leading host label
  (`canonicalRedirect`, [src/lib/tenant.ts:40](../../src/lib/tenant.ts#L40)). The `tenants` table
  has **no host/domain column** ([convex/schema.ts:75](../../convex/schema.ts#L75)); the subdomain
  is always `<slug>.<base>`, and the four slugs are a hardcoded tuple.
- The **ITN `notify_url` is already deployment-wide** — it points at `CONVEX_SITE_URL`, not `appUrl`
  ([convex/market.ts:434](../../convex/market.ts#L434)), and PayFast posts to `*.convex.site`. The
  ticket's ITN-reachability worry is a **non-issue**; notify stays put.
- **Public/share links are already tenant-correct** — built **client-side** off
  `window.location.origin` ([src/app/_components/Editions.tsx:336](../../src/app/_components/Editions.tsx#L336));
  since a tenant owner browses on their own subdomain, they come out on the tenant host by
  construction. No server work.
- Issue 14 (`40fe67a`) made invite **branding** tenant-aware (`tenantBrand`,
  [convex/shares.ts:48](../../convex/shares.ts#L48)) but the invite **link origin** stayed on a
  deployment-wide env (`APP_BASE_URL`, [convex/shares.ts:16](../../convex/shares.ts#L16)) — so there
  is **no existing origin resolver to reuse**; this ticket introduces the first one.

### Decision 1 — Origin resolution: convention `<slug>.<base>`, base from `SITE_URL`

Derive the tenant origin **server-side** from the course's trusted `topic.tenantSlug`:
`https://<tenantSlug>.<base>`, where `base` = `SITE_URL`'s host with a leading `www` stripped
(e.g. `https://www.my-course.app` → base `my-course.app` → `https://upf.my-course.app`).
**No new env var, no new `tenants` column, no client input trusted.** Default-site courses
(no `tenantSlug`) keep `SITE_URL` unchanged. Custom per-tenant domains stay deferred fog
(consistent with ADR 0022 §1).

### Decision 2 — Open-redirect guard: validate against the single resolved origin

Make `appUrl(path, tenantSlug?)` resolve **one** origin from the (server-only) `tenantSlug`, then
run the existing same-origin check against **that** origin (off-origin/protocol-relative path →
resolved origin root, exactly as today). Because `tenantSlug` is a topic column and never
client-supplied, the resolved origin is inherently bounded to `{ SITE_URL } ∪ { <slug>.<base> × 4 }`
— **no separate allow-list to maintain**; the trusted set is implicit in the derivation. The
open-redirect guard is preserved, now per-tenant.

### Decision 3 — Links in scope: checkout return/cancel + invite links

Server-side tenant-aware: **checkout `return_url`/`cancel_url`** ([market.ts:432-433](../../convex/market.ts#L432))
**and invite email deep-links** ([shares.ts:16-41](../../convex/shares.ts#L16), which already
resolves the tenant for branding). Explicitly **unchanged**:

- **`notify_url`** stays on `CONVEX_SITE_URL` (ITN, deployment-wide, tenant-agnostic — reachability fine).
- **Public/share links** stay client-side on `window.location.origin` (already tenant-correct by construction).
- **Content blobs / catalogue deep-links** stay on `CONVEX_SITE_URL` (anonymous bearer capability).

### Decision 4 — Reuse pattern: one `appUrl(path, tenantSlug?)`, consolidate onto `SITE_URL`

Extend the existing pure `appUrl` ([payfast.ts:232](../../convex/payfast.ts#L232)) to take an
optional `tenantSlug` and derive the base per Decision 1. Route **both** `startCheckout` and
`scheduleInvite` through it, **retiring the redundant `APP_BASE_URL`** in favour of `SITE_URL`
(both are Convex env vars holding the same web-app origin). One pure helper, no `ctx`, no second
base-domain convention forked. `tenantBrand` remains the brand seam from issue 14.

**Build notes for the PRD ([ticket 06](06-prd-and-issue-breakdown.md)):**
- After consolidation, invite links flow through `appUrl`, which **throws when `SITE_URL` is unset**
  — tests that exercise `scheduleInvite` (and today rely on `APP_BASE_URL` being absent → relative
  links) will need `SITE_URL` provisioned. Retire `APP_BASE_URL` from `convex/env.ts` and provisioning.
- `base = rootOf(SITE_URL)` is a ~2-line pure derive inside `appUrl` (strip a leading `www`);
  don't try to import `canonicalRedirect`'s logic across the Next↔Convex runtime boundary.
- Subdomains don't exist for a `localhost` `SITE_URL`; dev/default-site paths keep `SITE_URL`
  verbatim, so no dev-subdomain machinery is needed.
