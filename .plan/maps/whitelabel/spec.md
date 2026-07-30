# Whitelabel v1 — PRD

**Status:** ready for implementation
**Owner:** platform operator (jvorster63@gmail.com)
**Source:** [Whitelabel map](map.md) — six scoping tickets (01–06), all
`done`. This PRD synthesizes their resolutions into one build plan; it does not re-decide
anything. Where a section restates a decision, the ticket/ADR is the source of truth — read it
before touching that area's code.

## Summary

Turn the single-site Hindi-learning app into a whitelabel platform serving four branded tenants
— **upf**, **ywampotch**, **almighty-warriors**, **yknot** — each on its own subdomain
(`<slug>.my-course.app`, already live over HTTPS per [ticket 05](tickets/05-provision-tenant-subdomains.md)),
each with its own palette/logo, its own set of features switched on or off, and its own admin
who manages it without touching the database directly.

One deployment, one Convex backend, one shared dataset. Tenancy is a **visibility filter and a
skin**, not a hard partition — courses and users optionally carry a `tenantSlug`; access control
stays exactly what it is today (ownership, Shares, public links).

## Goals

1. Each tenant subdomain renders with its own palette, logo, and favicon — no flash, no
   republishing content.
2. Each tenant can have certificates, translations, public links, Q&A, and course-seeding
   independently turned on or off, enforced server-side (not just hidden UI).
3. A **sys admin** manages all four tenants; each tenant additionally has its own **tenant
   admin(s)** who manage only their own tenant — members, theme, flags, course/user assignment —
   without CLI or direct DB access.
4. None of this regresses today's single-site behaviour for `my-course.app` itself or for
   content not yet assigned to a tenant.

## Non-goals (deferred — tracked as fog in the map, not built here)

- Tenant self-service (a brand creating its own tenant, or billing/subscription management).
- Per-tenant payment merchant accounts and Resend sender domains (payments roadmap, gated
  phases).
- Per-tenant fonts/typography, per-tenant print styling, per-tenant og-images.
- Real design systems for the four tenants (mock palettes are the acceptance fixture; the
  operator authors the real ones later, one Claude design system per tenant).
- Apex/custom domains per tenant (own-domain-instead-of-subdomain).
- Open/public self-signup (v1 sign-up stays allowlist-gated per tenant).
- Marketplace/payments and rich-media/video as *enforced* flags (name reserved, nothing to
  enforce yet — see [04](tickets/04-scope-per-tenant-feature-flags.md)).
- AI content-regeneration ("Builder prompt box") and dynamic content-aware Q&A — raised by the
  operator mid-grilling, neither exists in the codebase; get their own scoping ticket later.
- Default-site catalogue curation (`my-course.app` lists **all** courses for v1 — revisit later).

## Data model

One new table, three new optional fields on existing tables. Full detail:
[ADR 0021 draft](adr-0021-draft-tenant-subdomain-model.md) (graduates to `docs/adr/0021-*.md` at
build start — supersedes ADR 0011's one-Admin invariant).

```ts
// convex/schema.ts — new
tenants: defineTable({
  slug: v.string(),          // subdomain label, effectively immutable
  displayName: v.string(),
  theme: v.object({
    light: v.record(v.string(), v.string()),             // required — all 14 tokens (see 01)
    dark:  v.optional(v.record(v.string(), v.string())), // optional partial; else default dark
    logo:    v.optional(v.id("_storage")),                // raster, mint-new; else displayName wordmark
    favicon: v.optional(v.id("_storage")),                // raster; else /icon.svg
  }),
  flags: v.object({
    certificates: v.boolean(),
    translations: v.boolean(),
    publicLinks:  v.boolean(),
    qa:           v.boolean(),
    seeding:      v.boolean(),
  }),
}).index("by_slug", ["slug"]),

// convex/schema.ts — additions to existing tables
topics:    { tenantSlug: v.optional(v.string()) }  // + index("by_tenant", ["tenantSlug"])
users:     { tenantSlug: v.optional(v.string()) }
whitelist: { tenantSlug: v.optional(v.string()) }  // admin scope: absent = sys admin reach
```

Seed data: four `tenants` rows (upf, ywampotch, almighty-warriors, yknot) with the mock palettes
from [03](tickets/03-scope-per-tenant-theming.md) and all five flags `true` (04's v1-migration
default — no regression from today's always-on behaviour). Existing `topics`/`users`/`whitelist`
rows are untouched (`tenantSlug` absent = default site, safe no-op backfill).

## Feature areas

### 1. Design token contract (ticket 01)

The app chrome is already token-driven (500+ Tailwind token-class uses); this is a cleanup pass
that pins the contract everything else rides: a curated **14-token palette**
(`paper card ink soft line accent accent2 gold hi danger good good-b bad bad-b`), light required
+ dark optional, living in a new `src/design/tokens.ts`. No component reorg.

### 2. Tenant resolution (ADR 0021 §6)

Next middleware reads the `Host` header, matches the leftmost label against known tenant slugs;
match → that tenant, no match / bare `my-course.app` → default. Tenant slug passed to Convex as a
query arg — spoof-safe by construction (it only picks catalogue + skin; every privileged action
stays guarded server-side by identity). Local dev via `<slug>.localhost:3000`.

### 3. Per-tenant theming (ticket 03)

SSR, no flash: root layout reads `Host` → resolves slug → `fetchQuery`s the tenant's theme →
injects a `<style>` tag with the 14 CSS vars (light + dark) before paint. Favicon via
`generateMetadata`. Logo is flash-tolerant, delivered via a client tenant context. Lessons,
references, and translated Editions re-skin via a `buildSrcDoc` palette-injection param (the same
rail that already injects dark-mode/Devanagari CSS at render time — no republishing). Invite
emails and certificates get identity (name/logo) but certificates freeze their palette to the
default gold-foil look. Landing pages are **bespoke per-tenant components hand-authored in code**
(a slug→registry lookup), not database-editable — out of the dashboard's reach.

### 4. Per-tenant feature flags (ticket 04)

Five v1 flags, flat required booleans on the tenant row: `certificates`, `translations`,
`publicLinks`, `qa`, `seeding`. Enforcement is a new `assertTenantFlag(ctx, tenantSlug, flag)`
helper called explicitly inside each gated mutation (`claimCertificate`, `setTopicPublic`/
`setEditionPublic`, `askQuestion`, `startTranslation`, `seedTopic`) — the ownership/visibility
resolvers (`getOwnedTopic`/`getViewableTopic`/`getEditableTopic`) stay flag-agnostic. No-ops when
`tenantSlug` is absent, so off-tenant content is unaffected. **Flag-off is frozen, not revoked**:
blocks new grants, never touches what's already been earned/created. Sharing/invites and
Routine on-demand fire are hardwired-on (not flags).

### 5. Two-tier admin model (ADR 0021 §4)

Roles live on the `whitelist` row: **sys admin** (`isAdmin: true`, no `tenantSlug`) reaches every
tenant and is the only role that creates/removes tenants; **tenant admin** (`isAdmin: true`,
`tenantSlug` set) reaches only their own tenant — members, theme, flags, assignment. Multiple
tenant admins per tenant allowed (retires ADR 0011's exactly-one-Admin invariant — supersede it).
`isCallerAdmin` becomes scope-aware: `isCallerAdmin(ctx, tenantSlug?)`.

### 6. Operator + tenant-admin dashboard (ticket 06)

A new **"Tenants" tab** on the existing `/admin` route (alongside the current Allowlist tab), not
a separate area. Sys admin sees a tenant picker (list + create); tenant admin is locked to their
own tenant, no picker. Per-tenant panel — **stacked-scroll layout** (chosen via a `/prototype`
pass over three candidate layouts): Theme (JSON-import textarea *and* structured per-token
fields, light/dark, live preview, logo/favicon upload) → Flags (five toggles) → Courses
(search-and-add assignment) → Members (search-and-add assignment) → Remove tenant (blocked
outright while any course or member still references the tenant — no cascade-delete anywhere in
this codebase, stays consistent).

### 7. Cross-host behaviour (ADR 0021 §3)

`my-course.app` lists all courses; a tenant subdomain lists only its own (a course with
`tenantSlug` set shows on both). A course link opened on the wrong host redirects to the course's
canonical host, path preserved — never 404s, never renders under the wrong skin. Skin always
follows the host, never the viewer's own tenant. Share/public/certificate links are canonical to
the course's host.

## Acceptance criteria (v1 done when...)

- The four tenant subdomains each render with their own palette/logo/favicon, no flash, no
  content republish.
- Flipping a flag off on a tenant blocks new creation of that feature server-side (verified via
  a direct mutation call, not just hidden UI) and never touches existing grants.
- A sys admin can create a tenant, see/edit all four; a tenant admin logging in sees only their
  own tenant's panel.
- A tenant admin can toggle their tenant's flags, edit their theme, and assign/unassign courses
  and members entirely through `/admin` — no CLI, no direct Convex dashboard edits needed for any
  v1 surface.
- Removing a tenant with assigned courses/members is blocked with an explanation; an empty
  tenant can be removed.
- A course link opened on the wrong subdomain redirects to its canonical host instead of 404ing.
- None of the above changes behaviour for `my-course.app` or for any course/user with no
  `tenantSlug` set.

## Implementation issues

Broken out as local issues under `.scratch/whitelabel/issues/`, built test-first
(`/tdd`) with a lazy-first posture (`/ponytail` — four known tenants, no speculative
plan/preset/multi-tenant-partition machinery). Rough dependency order (later issues may parallelize
within a phase):

| # | Issue | Depends on |
|---|---|---|
| 07 | [Tenant schema & seed](tickets/07-tenant-schema-and-seed.md) | — |
| 08 | [Scope-aware admin roles](tickets/08-scope-aware-admin-roles.md) | 07 |
| 09 | [Design token contract cleanup](tickets/09-design-token-contract-cleanup.md) | — |
| 10 | [Tenant resolution middleware](tickets/10-tenant-resolution-middleware.md) | 07 |
| 11 | [SSR theme application](tickets/11-ssr-theme-application.md) | 07, 09, 10 |
| 12 | [Brand asset upload](tickets/12-brand-asset-upload.md) | 07 |
| 13 | [Lesson/reference tenant palette override](tickets/13-lesson-tenant-palette-override.md) | 09, 11 |
| 14 | [Tenant-aware invite email](tickets/14-tenant-aware-invite-email.md) | 07 |
| 15 | [Tenant-aware certificate](tickets/15-tenant-aware-certificate.md) | 07, 11 |
| 16 | [Per-tenant landing pages](tickets/16-per-tenant-landing-pages.md) | 11 |
| 17 | [Feature flag enforcement](tickets/17-feature-flag-enforcement.md) | 07 |
| 18 | [Cross-host canonical redirect](tickets/18-cross-host-canonical-redirect.md) | 07, 10 |
| 19 | [Dashboard: Tenants tab shell](tickets/19-dashboard-tenants-tab-shell.md) | 08 |
| 20 | [Dashboard: theme editor](tickets/20-dashboard-theme-editor.md) | 11, 12, 19 |
| 21 | [Dashboard: flag toggles](tickets/21-dashboard-flag-toggles.md) | 17, 19 |
| 22 | [Dashboard: course/member assignment + tenant removal guard](tickets/22-dashboard-assignment-and-removal.md) | 19 |
| 23 | [Legacy course tenant backfill](tickets/23-legacy-course-tenant-backfill.md) | 07, 11, 13 |

23 is explicitly a downstream/follow-up issue (both 01 and 03 called it out as "own ticket, not
v1 mechanism") — full fidelity for *existing* courses under a tenant, not required for v1
correctness (new tenant-generated courses get full fidelity at publish).
