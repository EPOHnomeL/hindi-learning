# whitelabel — scoping tickets

The ambition (stated 2026-07-15): **a whitelabel course-generator LMS platform.** One codebase
serving multiple branded sites — initial tenant set **upf, ywampotch, almighty-warrior,
yknot** — each on its own subdomain, each with its own styling and its own set of features
switched on or off.

This effort is charted as a **wayfinder map**: [Whitelabel map](issues/00-whitelabel-map.md)
holds the destination, the decisions so far, and the fog. Work it with `/wayfinder <ticket>`
(or bare `/wayfinder` on the map to take the next frontier ticket) — one ticket per session.

## Tickets (children of the map)

| # | Ticket | Type | Depends on |
|---|--------|------|------------|
| 01 | [Design system integration](issues/01-scope-design-system-integration.md) ✅ done | grilling | — |
| 02 | [Tenant & subdomain model](issues/02-scope-tenant-subdomain-model.md) ✅ done | grilling | — |
| 03 | [Per-tenant branding & theming](issues/03-scope-per-tenant-theming.md) ✅ done | grilling | 01, 02 |
| 04 | [Per-tenant feature flags](issues/04-scope-per-tenant-feature-flags.md) | grilling | 02 |
| 05 | [Provision the four tenant subdomains](issues/05-provision-tenant-subdomains.md) ✅ done | task | — |
| 06 | [Operator + tenant-admin whitelabel dashboard](issues/06-scope-operator-whitelabel-dashboard.md) | grilling | 02, 03, 04 |

**Frontier** (open, unblocked, unclaimed): 04. (06 still blocked on 04.)

## Interactions to keep in view

- **Site-wide singletons break under tenancy**: the [[Allowlist]] and single [[Admin]]
  (ADR 0011) are per-*site* concepts today — ticket 02 owns this.
- **Published lesson blobs carry the design system**: lesson HTML is wrapped with a shared
  head at publish and stored immutably — per-tenant theming must not require republishing
  content (tickets 01/03).
- **Payments** (paid-marketplace) and **email** (Resend on my-course.app) become per-tenant
  concerns eventually — flagged in 02, not solved there.
- The [rich-media](../rich-media/README.md) tickets are parallel work; "video courses" would
  land as a tenant-flaggable feature via 04.
