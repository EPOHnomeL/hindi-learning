# whitelabel — scoping tickets

The ambition (stated 2026-07-15): **a whitelabel course-generator LMS platform.** One codebase
serving multiple branded sites — initial tenant set **upf, ywampotch, almighty-warrior,
yknot** — each on its own subdomain, each with its own styling and its own set of features
switched on or off.

This effort is charted as a **wayfinder map**: [Whitelabel map](issues/00-whitelabel-map.md)
holds the destination, the decisions so far, and the fog. Work it with `/wayfinder <ticket>`
(or bare `/wayfinder` on the map to take the next frontier ticket) — one ticket per session.

**The map has reached its destination.** All six scoping tickets are closed, synthesized into
[PRD.md](PRD.md), broken into local implementation issues 07–24 (listed in the PRD's own table).

**Whitelabel v1 is built** (reconciled against `main` 2026-07-29): issues **07–24 have all
landed** — tenant schema + seed, scope-aware admin roles, token cleanup, resolution
middleware, SSR theming, brand-asset upload, lesson palette override, tenant-aware invite
email and certificate, per-tenant landing pages, flag enforcement, canonical redirect, and
the whole dashboard Tenants tab (shell, theme editor, flag toggles, assignment/removal,
tenant-admin grant) plus the legacy-course tenant backfill. Remaining follow-up work — the
bespoke per-tenant landing pages, the last unbranded header, the colour-literal audit — is
tracked in [TODO.md](TODO.md), not here.

Note the tenant slug is **`almighty-warriors`** (plural). This README's opening line says
"almighty-warrior"; the slug in the DB, the Vercel domain and `src/lib/tenant.ts` is plural.

## Tickets (children of the map)

| # | Ticket | Type | Depends on |
|---|--------|------|------------|
| 01 | [Design system integration](issues/01-scope-design-system-integration.md) ✅ done | grilling | — |
| 02 | [Tenant & subdomain model](issues/02-scope-tenant-subdomain-model.md) ✅ done | grilling | — |
| 03 | [Per-tenant branding & theming](issues/03-scope-per-tenant-theming.md) ✅ done | grilling | 01, 02 |
| 04 | [Per-tenant feature flags](issues/04-scope-per-tenant-feature-flags.md) ✅ done | grilling | 02 |
| 05 | [Provision the four tenant subdomains](issues/05-provision-tenant-subdomains.md) ✅ done | task | — |
| 06 | [Operator + tenant-admin whitelabel dashboard](issues/06-scope-operator-whitelabel-dashboard.md) ✅ done | grilling | 02, 03, 04 |

**Frontier**: none — all six scoping tickets are closed. The map has reached its destination:
whitelabel v1 is fully specified. Next step is the PRD + implementation-issue breakdown per
CLAUDE.md's pipeline, not another `/wayfinder` session.

## Interactions to keep in view

- ~~**Site-wide singletons break under tenancy**: the [[Allowlist]] and single [[Admin]]
  (ADR 0011) are per-*site* concepts today~~ — **resolved.** The Admin singleton is gone:
  ADR 0022 §4 replaced it with the two-tier sys-admin / tenant-admin model (a `whitelist`
  row's optional `tenantSlug` is the scope), shipped in issue 08. The Allowlist table
  itself is still one site-wide table — that is now a deliberate shape, not debt.
- **Published lesson blobs carry the design system**: lesson HTML is wrapped with a shared
  head at publish and stored immutably — per-tenant theming must not require republishing
  content (tickets 01/03).
- **Payments** (paid-marketplace) and **email** (Resend on my-course.app) become per-tenant
  concerns eventually — flagged in 02, not solved there.
- The [rich-media](../rich-media/README.md) tickets are parallel work; "video courses" is one of
  04's **future** flag rows (name reserved, no enforcement yet) — lands for real once both exist.
