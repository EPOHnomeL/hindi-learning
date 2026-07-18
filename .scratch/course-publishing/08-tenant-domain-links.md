# course-publishing/08: Tenant-domain link generation

**Status:** open
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
