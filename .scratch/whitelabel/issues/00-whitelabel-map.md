# whitelabel/00: Whitelabel map

**Status:** open
**Labels:** wayfinder:map

## Destination

Whitelabel v1 is fully specified and ready to build: an agreed tenant/subdomain model, per-subdomain
theming on a tokenised design system, per-tenant feature flags with backend enforcement, and an
operator whitelabel dashboard — captured as PRD(s) + implementation issues per the CLAUDE.md
pipeline. One task is carried in-map as execution: the four tenant subdomains live on my-course.app.

## Notes

- Tracker: local markdown (this directory). Blocking via `**Depends on:**` lines; a ticket is
  claimed by adding `**Claimed:** <who/session>` under Status before working it.
- Skills per session: `/grilling` + `/domain-modeling` for grilling tickets, `/prototype` for
  prototype tickets, `/ponytail` posture throughout (four known tenants — no speculative platform).
- **Constraints pinned by the user at charting (2026-07-15)** — treat as requirements, not open
  questions:
  - Tenants (initial four): **upf, ywampotch, almighty-warriors, yknot**, each on
    `<slug>.my-course.app`. Slug spelling confirmed plural (`almighty-warriors`) by the user
    on 2026-07-15 while working the provisioning task.
  - **Styling is the top priority**: the subdomain drives the look — same app, re-skinned per
    tenant.
  - Courses get a **subdomain field**: unset = default site only; set = the default site **and**
    that subdomain. `my-course.app` (default) lists **all** courses for now (revisit later — fog).
  - Users are connected to **either the default only or exactly one subdomain**.
  - The user (platform operator) wants a **whitelabel management dashboard** — tenants, themes,
    flags, course/user↔subdomain assignment. Operator-facing, not tenant-self-service.
  - Tenant themes will be authored as **Claude design systems** handed to each tenant (theme =
    token override, per ticket 01's premise).
- Prod carries the real tenant accounts; dev only operator accounts — data checks go through
  `pnpm *:prod` CLIs.

## Decisions so far

<!-- one line per closed ticket: gist + link -->

(none yet)

## Not yet specified

- **Four tenant theme fixtures** — once [Per-tenant branding & theming](03-scope-per-tenant-theming.md)
  fixes the theme shape, author the actual upf/ywampotch/almighty-warrior/yknot design systems
  (likely a prototype ticket per tenant, or one covering all four).
- **Default-site catalogue policy revisit** — "my-course.app shows all courses" is the pinned v1;
  the user expects to change this later (curation/opt-out). Becomes specifiable after the tenant
  model lands and real tenant courses exist.
- **Per-tenant payments & email** — merchant accounts (PayFast/Paystack) and Resend sender
  domains per tenant; flagged in the tenant-model ticket, deliberately not solved there. Hangs on
  the payments roadmap's gated phases.
- **Apex/custom domains per tenant** (e.g. a brand's own domain instead of a my-course.app
  subdomain) — later; the subdomain model should merely not preclude it.
- **Rich-media/video as a tenant flag** — parallel [rich-media](../../rich-media/README.md)
  effort; would land through the flag inventory once both exist.
- **PRD + implementation-issue breakdown** — the destination's final step; specifiable only once
  the scoping tickets close.

## Out of scope

- **Tenant self-service administration** — tenant admins editing their own branding/flags/members.
  The dashboard in this effort is operator-only; self-service is a future effort if tenants ask.
- **Building per-tenant payment rails** — the payments roadmap is separately gated
  (Paystack-first); this map only keeps the tenant record from precluding it.
- **Redesigning flows/visuals** — visual decisions were agreed in the UI-redesign prototype;
  ticket 01 integrates, it does not redesign.
