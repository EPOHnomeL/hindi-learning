# whitelabel — scoping tickets

The ambition (stated 2026-07-15): **a whitelabel course-generator LMS platform.** One codebase
serving multiple branded sites — initial tenant set **upf, ywampotch, almighty-warrior,
yknot** — each on its own subdomain, each with its own styling and its own set of features
switched on or off.

These are **scoping tickets** (answered questions + recommendation → PRD/ADR), one per
component, same convention as [.scratch/rich-media/](../rich-media/README.md).

## Tickets

| # | Ticket | Component |
|---|--------|-----------|
| 01 | [Design system integration](issues/01-scope-design-system-integration.md) | Token/component substrate (prerequisite for theming) |
| 02 | [Tenant & subdomain model](issues/02-scope-tenant-subdomain-model.md) | Tenancy: routing, data isolation, auth, provisioning |
| 03 | [Per-tenant branding & theming](issues/03-scope-per-tenant-theming.md) | Styles per tenant, riding 01's tokens |
| 04 | [Per-tenant feature flags](issues/04-scope-per-tenant-feature-flags.md) | Features on/off, UI + backend enforcement |

Dependency order: 01 and 02 are the foundations (independent of each other);
03 depends on both; 04 depends on 02.

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
