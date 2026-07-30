---
type: grilling
blocked_by: []
---

# Tenant-domain link generation

## Question

Surfaced resolving [ticket 03](03-define-publish-action.md) (2026-07-18): the user requires that
**buy / share / public links for a tenant's course be generated on the owning tenant's subdomain**,
not the deployment-wide default origin. Today `appUrl` (`convex/payfast.ts:232`) builds **every** link
off a single `SITE_URL` env origin and **enforces same-origin against `SITE_URL`** (an open-redirect
guard feeding PayFast's return/cancel/notify URLs). There is no tenant awareness. Decide, via
`/grilling` (expect a short `research` lead-in on how subdomains are served today):

1. **Origin resolution** — given a course's `tenantSlug`, how is its subdomain origin derived? A
   convention over one base domain (`<slug>.<root>`)? A per-tenant configured host? Where does the
   root live (env, `tenants` row)?
2. **Preserving the open-redirect guard** — a tenant-aware `appUrl` must validate against the resolved
   tenant origin (a bounded allow-set of known tenant hosts), never trust an arbitrary host, and still
   discard off-origin paths into PayFast's fields. Pin the trusted-origin set.
3. **Which links are in scope** — checkout URLs (return/cancel/notify), per-Edition public link, share
   links, catalogue/course deep-links. Default-site courses keep `SITE_URL`. Note any that must stay
   on the default origin (e.g. PayFast ITN `notify_url` reachability).
4. **Interaction with existing whitelabel work** — invite-email branding already went tenant-aware
   (whitelabel issue 14); does that establish the origin-resolution pattern to reuse, or did it
   hardcode?

## Done when

Origin resolution, guard preservation, the in-scope link set, and the reuse pattern are decided and
recorded (feeding the PRD), with a Decisions-so-far line on the map.

## Answer

Resolved 2026-07-19. Research lead-in captured in the scratch `research-subdomain-serving.md` (ground
truth). Grilled one decision at a time; `/ponytail` held (four known tenants, one convention).

**Decisive facts:** the base domain is **never stored** — derived by stripping the leading host label
(`canonicalRedirect`, `src/lib/tenant.ts:40`); `tenants` has no host column; the subdomain is always
`<slug>.<base>` (four hardcoded slugs). The ITN `notify_url` is **already deployment-wide**
(`CONVEX_SITE_URL`, `market.ts:434`) — the reachability worry is a non-issue. Public/share links are
**already tenant-correct** — built client-side off `window.location.origin`
(`src/app/_components/Editions.tsx:336`). Issue 14 (`40fe67a`) made invite **branding** tenant-aware
but the invite **link origin** stayed on `APP_BASE_URL` (`shares.ts:16`) — so there is **no existing
origin resolver to reuse**; this ticket introduces the first one.

1. **Origin resolution: convention `<slug>.<base>`, base from `SITE_URL`.** Derive server-side from
   the course's trusted `topic.tenantSlug`: `https://<tenantSlug>.<base>`, where `base` = `SITE_URL`'s
   host with a leading `www` stripped. **No new env var, no new `tenants` column, no client input
   trusted.** Default-site courses (no `tenantSlug`) keep `SITE_URL`. Custom per-tenant domains stay
   deferred fog (ADR 0022 §1).
2. **Open-redirect guard: validate against the single resolved origin.** `appUrl(path, tenantSlug?)`
   resolves **one** origin from the server-only `tenantSlug`, then runs the existing same-origin check
   against **that** origin. Because `tenantSlug` is a topic column, never client-supplied, the
   resolvable set is implicitly `{ SITE_URL } ∪ { <slug>.<base> × 4 }` — **no allow-list to
   maintain**. Guard preserved, now per-tenant.
3. **Links in scope: checkout return/cancel + invite links.** Server-side tenant-aware:
   `startCheckout`'s `return_url`/`cancel_url` (`market.ts:432-433`) and `scheduleInvite`'s deep-links
   (`shares.ts:16-41`). **Unchanged:** `notify_url` stays `CONVEX_SITE_URL`; public/share links stay
   client-side; content-blob / catalogue deep-links stay on `CONVEX_SITE_URL`.
4. **Reuse pattern: one `appUrl(path, tenantSlug?)`, consolidate onto `SITE_URL`.** Extend the
   existing pure `appUrl` (`payfast.ts:232`), route both `startCheckout` and `scheduleInvite` through
   it, and **retire the redundant `APP_BASE_URL`** in favour of `SITE_URL`. One pure helper, no `ctx`,
   no second base-domain convention. `tenantBrand` remains the issue-14 brand seam.

**Build notes for the PRD:** after consolidation invite links flow through `appUrl`, which throws when
`SITE_URL` is unset — tests exercising `scheduleInvite` (today relying on `APP_BASE_URL` absent →
relative links) need `SITE_URL` provisioned; retire `APP_BASE_URL` from `convex/env.ts` and
provisioning. `base = rootOf(SITE_URL)` is a ~2-line pure derive; don't import `canonicalRedirect`
across the Next↔Convex boundary. A `localhost` `SITE_URL` keeps its value verbatim (no dev-subdomain
machinery).
