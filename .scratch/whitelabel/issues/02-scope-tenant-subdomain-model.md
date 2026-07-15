# whitelabel/02: Scope tenant & subdomain model

**Status:** open
**Depends on:** —
**Labels:** wayfinder:grilling

Child of [Whitelabel map](00-whitelabel-map.md).

## Pinned by the user (2026-07-15) — requirements, not open questions

- Courses carry a **subdomain field**: unset = default site only; set = default site **and** that
  subdomain. `my-course.app` lists **all** courses for v1 (revisit later — map fog).
- Users are connected to **either the default only or exactly one subdomain**.
- Subdomain hosts are `<slug>.my-course.app` for the four tenants; provisioning is
  [ticket 05](05-provision-tenant-subdomains.md), not this one.

This pins the *shape* of data isolation (single shared data set, tenant = a visibility filter via
a subdomain field — not hard per-tenant partitions). The open questions below narrow accordingly.

## Why

The platform becomes multi-brand: one deployment serving **upf, ywampotch, almighty-warrior,
yknot** (initial set), each on its own subdomain with its own identity. Today the app is
single-site: one Vercel app on my-course.app, one site-wide [[Allowlist]], exactly one
[[Admin]], global Topics-per-user. Tenancy is the deepest cut in the whole whitelabel effort —
this ticket decides the model everything else (theming, flags, payments, email) hangs off.

## Questions to answer

- **Tenant resolution**: subdomains of my-course.app (`upf.my-course.app`) via wildcard DNS
  (Cloudflare) + Vercel wildcard domain + host-header → tenant lookup in Next middleware? Do
  any brands need their *own* apex domain (yknot.io-adjacent) from day one, or is that later?
- **Where a tenant lives**: a `tenants` table in Convex (slug, domains, theme ref, flags,
  branding assets) vs. static config. Runtime table strongly implied by "features on and off"
  — but who edits it (a platform-admin portal? direct DB?)?
- **Data isolation** (shape pinned above — shared data set, subdomain field as visibility
  filter): pin the semantics. Visiting `upf.my-course.app` shows only upf-assigned courses —
  what happens on a direct link to a course not assigned there (404, redirect to default,
  render anyway)? What does a Share/Public link mean when it crosses a subdomain boundary?
  What does "user connected to a subdomain" gate — sign-in host, course visibility, both?
  Answer with the marketplace in mind (a course sold on one tenant's site).
- **Auth & admission**: Allowlist and Admin become per-tenant (each brand admits its own
  people, has its own admin) — how does that interact with the single Convex Auth install and
  the existing exactly-one-Admin invariant (ADR 0011)?
- **Cross-cutting singletons to inventory**: Resend sender domain, invite-email copy,
  certificate branding, PayFast/Paystack merchant accounts per tenant (flag for the payments
  roadmap, don't solve), the Routine's owner-email env assumptions
  ([`scripts/_env.ts`](../../../scripts/_env.ts)).
- Local dev story for subdomains (hosts file / `*.localhost`)?

## Out of scope

- Theming (03) and feature flags (04) — this ticket defines the tenant *record* they hang off.
- Building any migration.

## Deliverable

An ADR draft: tenant resolution mechanism, tenant record shape, the data-isolation decision
(with migration implications sketched), and the per-tenant auth/admission model. The four
named tenants as the worked example.
