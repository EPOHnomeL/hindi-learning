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
>
> **Updated by [03](03-scope-per-tenant-theming.md) (2026-07-15):** the theme record 06 edits is an
> inline `theme` object on the `tenants` row — `{ light, dark?, logo?, favicon? }` (14-token palette
> + two raster asset uploads). So "theme editing" here = **palette fields/JSON + logo + favicon
> upload**, edit-is-live. **Landing pages are explicitly OUT** of the dashboard: 03 chose bespoke
> per-tenant landing components hand-authored in code, shipped via commit + deploy — not runtime
> content. So 06 manages palette + assets + flags + assignment + members, **not** landing copy. The
> "theme editing fidelity" question below (raw token JSON vs structured fields) is now the main open
> theming decision for 06.
>
> **Updated by [04](04-scope-per-tenant-feature-flags.md) (2026-07-15):** the flags 06 edits are five
> flat required booleans on the `tenants` row — `certificates`, `translations`, `publicLinks`, `qa`,
> `seeding` (all default `true` at the v1 migration; a flag added later defaults `false` and needs an
> explicit opt-in per tenant). So "flag editing" here is a **plain toggle row, one per flag** — no
> plan/preset picker. **Safety note for the "existing grants" question below:** 04 already answered
> it — flipping a flag off is **frozen, not revoked** (blocks new Certificates/Editions/Questions/
> Public links; never touches ones already granted) — so 06 needs no extra confirm/undo step beyond
> the toggle itself; there is nothing destructive to warn about.

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
