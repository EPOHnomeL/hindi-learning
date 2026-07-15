# whitelabel/03: Scope per-tenant branding & theming

**Status:** open
**Depends on:** 01, 02
**Labels:** wayfinder:grilling

Child of [Whitelabel map](00-whitelabel-map.md). User-pinned at charting (2026-07-15): styling
is the **top priority** of the whole whitelabel effort, and tenant themes will be authored as
**Claude design systems** handed to each tenant — so the theme shape must be something a
Claude-generated design system can compile down to (a token override set, per ticket 01).

## Why

Each tenant site (upf, ywampotch, almighty-warrior, yknot) needs its own look: logo, palette,
typography, landing copy — "different styles" per brand. Ticket 01 turns the design system
into tokens; ticket 02 gives us a tenant record; this ticket scopes how a tenant's theme is
authored, stored, and applied.

## Questions to answer

- Theme shape: a token-override object on the tenant record (colors, fonts, radius, logo
  asset id) — how much is themeable in v1? (Recommendation to test: palette + logo + name +
  landing copy only; typography later.)
- Application mechanism: server-render CSS variables from the resolved tenant in the root
  layout (no flash, no client fetch)? Fonts — self-hosted per tenant or one shared stack?
- Brand assets: logos/og-images as Convex storage blobs on the tenant record (Emblem-style
  mint-new-never-overwrite), favicon per tenant?
- Surface inventory: dashboard/reader chrome (tokens from 01), Landing page (per-tenant copy —
  content, not just style?), invite emails, Certificates (tenant-branded certs matter for
  these orgs), the print stylesheet.
- Published lesson blobs: apply the 01 decision — themed at render time so one course looks
  native on its tenant without republishing. Confirm it holds for translations
  (inline-html rows) too.
- Who edits a theme — answered at charting: the platform operator, via the whitelabel
  dashboard ([ticket 06](06-scope-operator-whitelabel-dashboard.md)). This ticket only decides
  the theme *record* the dashboard will edit; tenant self-service stays out of the map's scope.

## Out of scope

- The token system itself (01) and tenant resolution (02).
- Tenant self-service theming UI (note as deferred unless scoping says otherwise).

## Deliverable

Theme record shape, the application mechanism (SSR CSS vars), the v1 themeable-surface list,
and mock theme values for the four named tenants as the acceptance fixture.
