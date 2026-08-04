---
type: task
blocked_by: []
---

# Colour-coded tenant pill on a course card (default host only)

## Question

Operator ask, 2026-08-04: **on the default host you cannot tell which tenant a course
belongs to.** Every course is listed on `my-course.app` (the v1 policy pinned in the map's
Notes), so an owner/admin looking at their dashboard sees `upf`, `ywampotch`,
`almighty-warriors`, `yknot` and untenanted courses in one undifferentiated grid.

Put a **small colour-coded pill** on each course card naming the course's tenant.

**Show it only on the default host.** On `<slug>.my-course.app` every listed course is that
tenant's by construction ([02](02-scope-tenant-subdomain-model.md)'s visibility filter), so
the pill is pure noise there. The host check is already available client-side:
`useTenantSlug()` (from `TenantContext`) is `null` on the default host — `www` is not a known
tenant label, so `resolveTenantSlug` returns `null` for `www.my-course.app` too
([10](10-tenant-resolution-middleware.md)). Verify that before relying on it.

What is not decided yet, and should be settled while building:

- **Where the colour comes from.** Two candidates: (a) the tenant's own
  `theme.light.accent` — truthful and already stored on the `tenants` row, but `getTheme` is
  a *single*-tenant, host-keyed read ([11](11-ssr-theme-application.md)), so a grid spanning
  four tenants needs a new list-shaped read; (b) a deterministic slug→colour map in
  `src/design/`, no extra query, no risk of two tenants picking near-identical accents.
  Ponytail posture and four known tenants both point at (b) — pick (b) unless (a) is
  genuinely cheap.
- **Which surfaces.** The owner grid in `src/app/_components/Dashboard.tsx` is the ask. The
  admin Tenants tab already groups by tenant ([19](19-dashboard-tenants-tab-shell.md)), so it
  needs nothing. Decide whether shared/purchased course lists get it too.
- **Untenanted courses.** A course with no `tenantSlug` is default-site-only. Either an
  explicit neutral pill or no pill — no pill is probably right, and quieter.

Plumbing note: the dashboard card does **not** carry the field today.
`convex/content/reader.ts`'s `dashboard` query returns `tenantSlug` only nested inside
`publicLink` (`reader.ts:168`); the card needs it at the top level, added to the returns
validator alongside the existing fields.

Related: [23](23-legacy-course-tenant-backfill.md) is still waiting on the operator, so
until the backfill runs some prod courses will legitimately show no pill. That is the
backfill's problem, not this ticket's — but say so if it confuses the operator on prod.

## Done when

On the default host (`my-course.app` and `www.my-course.app`), each dashboard course card
shows a colour-coded pill naming its tenant, with a distinct colour per tenant and nothing
rendered for an untenanted course; on a tenant subdomain no pill renders at all. Covered by a
test on whatever pure seam decides pill-or-no-pill and its colour, so the host rule is not
only asserted by eye.
