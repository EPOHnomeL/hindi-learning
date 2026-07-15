# whitelabel/06: Scope the operator whitelabel dashboard

**Status:** open
**Depends on:** 02, 03, 04
**Labels:** wayfinder:grilling

Child of [Whitelabel map](00-whitelabel-map.md).

> **Updated by [02](02-scope-tenant-subdomain-model.md) (2026-07-15):** the auth model is now
> **two-tier** — sys admin (global) + **tenant admins** (scoped to their own tenant). This dashboard
> is therefore **operator *and* tenant-admin**-facing, not operator-only. Scope it as one surface
> with role-scoped views: a sys admin sees all tenants + tenant create/remove; a tenant admin sees
> only their tenant's members/theme/flags/assignment. Tenant *creation* and cross-tenant reach stay
> sys-admin-only. Access is gated by the scope-aware `isCallerAdmin` from ADR 0021.

## Question

The platform operator (the user) wants a dashboard to run the whitelabel system — this
supersedes the "flag/theme UI deferred, operator edits DB" position tickets 03/04 took before
the map was charted. What does v1 of that dashboard manage, and where does it live?

- **Surface inventory**: tenant list + create; per-tenant theme editing (the Claude design
  system handoff — paste/upload a token set? edit fields?); per-tenant flag toggles; course →
  subdomain assignment; user → subdomain assignment. Which of these are v1 vs "still fine in
  the DB for now"?
- **Where it lives**: a new operator area in the app (gated by the platform-Admin role — how
  does that interact with per-tenant admins from the tenant-model decision?) vs. extending the
  existing operator CLIs. The user asked for a dashboard — assume UI, but scope the minimum.
- **Theme editing fidelity**: raw token JSON with live preview vs. structured fields
  (palette/logo/name/copy). Depends on the theme shape from
  [Per-tenant branding & theming](03-scope-per-tenant-theming.md).
- **Safety**: prod tenant data is live — what needs confirmation/undo (e.g. flag off with
  existing grants, per ticket 04's flag-off rule)?
- Likely wants a `/prototype` pass once the surface list is agreed.

Deliverable: the v1 dashboard surface list, its access model, and a rough screen-level sketch —
enough for the PRD.
