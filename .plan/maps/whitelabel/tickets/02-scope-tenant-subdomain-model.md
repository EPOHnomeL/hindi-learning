---
type: grilling
blocked_by: []
---
# Scope tenant & subdomain model

## Question

The platform becomes multi-brand: one deployment serving **upf, ywampotch, almighty-warrior,
yknot** (initial set), each on its own subdomain with its own identity. Tenancy is the deepest
cut in the whole effort — this ticket decides the model everything else (theming, flags,
payments, email) hangs off.

Pinned by the user (2026-07-15) as requirements, not open questions: courses carry a subdomain
field (unset = default site only; set = default + that subdomain; `my-course.app` lists all for
v1); users connected to either the default only or exactly one subdomain; hosts are
`<slug>.my-course.app` (provisioning is ticket 05). This pins the *shape* of isolation (single
shared dataset, tenant = a visibility filter via a subdomain field, not hard partitions). Answer:

- **Tenant resolution:** subdomains via Cloudflare DNS + Vercel + host-header → tenant lookup in
  Next middleware? Any brands need their own apex domain from day one, or later?
- **Where a tenant lives:** a `tenants` table in Convex vs static config — and who edits it?
- **Data isolation semantics:** on a direct link to a course not assigned to the current
  subdomain — 404, redirect, render anyway? What does a Share/Public link mean across a subdomain
  boundary? What does "user connected to a subdomain" gate?
- **Auth & admission:** Allowlist and Admin become per-tenant — how does that interact with the
  single Convex Auth install and the exactly-one-Admin invariant (ADR 0011)?
- **Cross-cutting singletons:** Resend sender domain, invite-email copy, certificate branding,
  PayFast/Paystack merchant accounts (flag, don't solve), the Routine's owner-email env.
- Local dev story for subdomains (`*.localhost`)?

Out of scope: theming (03), flags (04), building any migration.

## Done when

An ADR draft exists covering tenant resolution mechanism, tenant record shape, the
data-isolation decision (with migration implications sketched), and the per-tenant auth/admission
model — the four named tenants as the worked example.

## Answer

Resolved 2026-07-15 (opus grilling). Deliverable: **ADR 0021 draft — Tenant & subdomain model**
(`adr-0021-draft-tenant-subdomain-model.md`); decisions in gist:

1. **A tenant is a Convex `tenants` table row**, keyed by slug, seeded with the four
   (operator/seed-created, no self-signup). Table over static config because the dashboard (06)
   edits theme/flags at runtime.
2. **Courses & users reference the tenant by slug string** — `topics.tenantSlug?` (index
   `by_tenant`), `users.tenantSlug?`; single optional field each. Slug not Id → host match is a
   plain indexed equality, no join.
3. **Data isolation = shared dataset, subdomain is a visibility filter.** Default lists all;
   subdomain lists its own (a set course shows on both). User↔subdomain gates **admission +
   home/catalogue only, not content access** (access stays ownership/Shares/public). Cross-host
   course link → **redirect to canonical host**, path preserved. **Skin follows the host**, not
   the viewer's tenant. Share/public/cert links canonical-host; marketplace checkout rides the
   canonical host (rails deferred).
4. **Two-tier admin model** (⚠️ scope change): **sys admin** (global, `jvorster63@gmail.com`) +
   **tenant admin** (scoped, e.g. `ywampotchtpm@gmail.com`). Encoded on `whitelist` via `isAdmin`
   + new `tenantSlug`. Multiple tenant admins per tenant allowed → **retires ADR 0011's one-Admin
   invariant**. `isCallerAdmin` becomes scope-aware. Allowlist becomes per-tenant; one account →
   one tenant.
5. **Singletons:** invite/notification email → **tenant-aware at v1** (brand name + canonical-host
   link); certificate branding → derived (no new field); Resend sender domain + payment merchant
   accounts → deferred; Routine authoring → no change (already per-owner).
6. **Resolution:** Next middleware host-label match; explicit per-tenant domains kept (5th tenant =
   operator task); tenant slug passed to Convex as a **spoof-safe query arg**; `*.localhost` for dev.

**Scope change made by the operator this session:** tenant admins are now wanted — absorbed into
the auth model here and into ticket 06 (now operator **and tenant-admin**-facing). Tenant
*provisioning* self-service (creating tenants, billing) stays out. **Unblocks** 03 (01✓+02✓), 04
(02✓); 06 still blocked on 03/04.
