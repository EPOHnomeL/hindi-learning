---
type: task
blocked_by: []
---

## Status

**Resolved:** 2026-08-06 — built.

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

## Answer

Built 2026-08-06. The whole pill-or-no-pill decision is one pure function,
`tenantPill(host, courseTenant)` in [src/design/tenantPill.ts](../../../../src/design/tenantPill.ts),
tested in `tenantPill.test.ts` (5 tests). The card component is only its paint.

The three open questions, as settled:

- **Colour source: (b), the deterministic map** — `TENANT_PILLS` in the same file, four
  hand-picked hues (`upf` teal `#0f9b8e`, `ywampotch` indigo `#5b5bd6`,
  `almighty-warriors` magenta `#c2367f`, `yknot` orange `#c96a1e`). (a) was not cheap:
  `getTheme` is single-tenant and host-keyed ([11](11-ssr-theme-application.md)), so a
  four-tenant grid needed a new list-shaped read — and a tenant's real accent is exactly
  the value two tenants are free to pick alike, which defeats the pill's one job. A test
  pins the colours distinct. Labels mirror `scripts/seed-tenants.ts`'s display names
  (`YWAM Potch`, not `ywampotch`) — static, so no query.
- **Surfaces: the owner grid only** (`CourseCard` in `src/app/_components/Dashboard.tsx`).
  Shared and purchased cards deliberately skipped: those are courses someone else owns, so
  the operator's "which of *my* tenants is this" question doesn't arise there, and neither
  list carries `tenantSlug` today. The admin Tenants tab already groups by tenant
  ([19](19-dashboard-tenants-tab-shell.md)), as the ticket predicted.
- **Untenanted courses: no pill.** `tenantPill` returns `null` for a `null`/empty slug, and
  the same for an *unknown* slug — a course carrying a slug retired from `TENANT_SLUGS`
  degrades to no pill rather than to `undefined.colour`.

Two implementation notes worth keeping:

- **The host premise held.** `useTenantSlug()` is `null` on the default host, and
  `www.my-course.app → null` was already pinned by an existing case in
  `src/lib/tenant.test.ts` — no new verification needed, and nothing to change in
  [10](10-tenant-resolution-middleware.md).
- **The colour rides inline styles, not a design token, and that is deliberate.** A hex
  from a static map has no token to live in, and `gold`/`accent2` already mean "paid"/
  "public" on this same card. `color-mix(in oklab, <hex> 16%, transparent)` tints the one
  hex into a background that reads on both the light and the dark card, so the pill needs
  no dark-mode variant.

**One stale claim in this ticket, corrected:** the plumbing note said the field should be
"added to the returns validator" of `content.reader.dashboard`. That query has **no**
`returns` validator (unlike `courseHeader`, which does) — adding `tenantSlug: t.tenantSlug ?? null`
to the returned card object was the whole backend change, plus the field on `Dashboard.tsx`'s
local `Course` type.

**Verification: static gates only** — `pnpm typecheck` clean across `src/` and `convex/`
(pre-existing errors in `topics/_devanagari/` are untouched and unrelated), `pnpm vitest run`
green on both suites (`src/` 208, `convex/` 567). **Not walked in a browser**, so the
rendered pill's placement and legibility on the dark card are unverified by eye — that
belongs on the map's outstanding-verification list.

Unchanged from the ticket: until [23](23-legacy-course-tenant-backfill.md) runs, prod courses
predating the tenant field will legitimately show no pill. That is the backfill's problem.
