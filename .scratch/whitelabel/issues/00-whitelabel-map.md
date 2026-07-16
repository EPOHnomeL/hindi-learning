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

- [Provision the four tenant subdomains](05-provision-tenant-subdomains.md) — the four
  `<slug>.my-course.app` hosts (upf, ywampotch, almighty-warriors, yknot) are live over HTTPS
  via four explicit Cloudflare CNAMEs → Vercel `hindi-learning`; all render the default site
  until tenant-resolution middleware lands.
- [Scope Claude design system integration](01-scope-design-system-integration.md) — app chrome is
  already token-driven, so integration is minimal; the real output is the token **contract**.
  Theme = a curated ~14-token flat map (`TenantTheme`, light required + dark optional) living in a
  new `src/design/tokens.ts`; one override re-skins both surfaces via shared var names (per-surface
  prefix). Lesson blobs re-skin by **render-time injection** (existing `buildSrcDoc` rail), with new
  courses generated in-style and migration scripts for old ones. Code is canonical; artifact
  archived. Tenant *application* machinery deferred to 03.
- [Scope tenant & subdomain model](02-scope-tenant-subdomain-model.md) — the deepest cut, captured
  as [ADR 0021 draft](adr-0021-draft-tenant-subdomain-model.md). Tenant = a Convex `tenants` row
  keyed by slug (seed the four). Courses/users carry `tenantSlug?` (slug string, no join). Isolation
  = shared dataset, subdomain is a **visibility filter**: default lists all, subdomain lists its own;
  user↔subdomain gates admission + home only (access stays grant-based); **skin follows the host**;
  cross-host links redirect to canonical host. **Two-tier admin** — sys admin + tenant admins
  (scope change, see Out of scope) on `whitelist` via `isAdmin`+`tenantSlug`; **retires ADR 0011's
  one-Admin invariant**. Invite emails tenant-aware at v1; middleware host-label resolution; tenant
  slug a spoof-safe Convex arg; `*.localhost` for dev. Unblocks 03 + 04.
- [Scope per-tenant branding & theming](03-scope-per-tenant-theming.md) — theme is an **inline
  object on the `tenants` row** (`{ light, dark?, logo?, favicon? }`), edit-is-live. Palette = the
  14-token `TenantTheme` from 01 (stored as a validated record). **No per-tenant fonts** (shared
  stack); **logo + favicon** as raster storage blobs via the emblem rail (og-image deferred).
  **Application = SSR server-fetch, no flash:** root layout reads Host → `fetchQuery` theme → inline
  `<style>` (light+dark) before paint; favicon via `generateMetadata`; logo via a client tenant
  context. **Landing pages are bespoke per-tenant, hand-authored in code** (slug→component registry,
  default `<Landing/>` fallback) — not DB, not dashboard-editable. Lessons/references/translated
  Editions re-skin via a `buildSrcDoc` palette param (partial fidelity on legacy). Email
  full-palette-derived + logo (light-only); certificate identity-only with frozen styling
  (print not themed). Mock palettes for the four tenants captured as the acceptance fixture
  (placeholders — real Claude design systems land later). Unblocks the theming half of 06.
- [Scope per-tenant feature flags](04-scope-per-tenant-feature-flags.md) — **flat required
  booleans** on the `tenants` row (`certificates`, `translations`, `publicLinks`, `qa`,
  `seeding`), all default `true` at the v1 migration (no regression from today's always-on
  behaviour). Sharing/invites and Routine on-demand fire stay **hardwired-on** (the former is the
  admission path itself; the latter already has its own cost guard). Marketplace/payments,
  rich-media/video, and two ideas the operator raised mid-grill — AI content-regeneration /
  "Builder prompt box" and a more dynamic content-aware Q&A — are **future rows**: name reserved,
  no enforcement built (nothing to enforce yet). **Enforcement is a new `assertTenantFlag` helper
  called explicitly from each gated mutation** (`claimCertificate`, `setTopicPublic`/
  `setEditionPublic`, `askQuestion`, `startTranslation`, `seedTopic`) — `getOwnedTopic`/
  `getViewableTopic` stay flag-agnostic. **Flag-off is frozen, not revoked**: blocks new
  Certificates/Editions/Questions/Public links; never touches ones already granted. A flag added
  later defaults `false` (opt-in) — the going-forward policy, distinct from the v1 migration's
  `true` seed. Unblocks the flags half of 06 — **06 is now fully unblocked** (02✓ 03✓ 04✓).

## Not yet specified

- **Four tenant theme fixtures** — the theme shape is pinned by
  [01](01-scope-design-system-integration.md) (14-token `TenantTheme`) and its storage/application by
  [03](03-scope-per-tenant-theming.md) (inline `theme` object on the `tenants` row; SSR override).
  03 carries **placeholder mock palettes** for all four as its acceptance fixture — the remaining
  work is authoring the **real** upf/ywampotch/almighty-warriors/yknot design systems (one Claude
  design system per tenant, per the operator) plus the hand-authored per-tenant **landing pages**.
  Likely a prototype/build ticket per tenant, or one covering all four.
- **Authoring-in-tenant-style + course migration scripts** — new courses should be *generated*
  in the owning tenant's palette (baked at publish, not just injected), and existing courses need
  scripts to move them under a tenant. Sharp as a requirement but hangs on
  [02](02-scope-tenant-subdomain-model.md) (course↔subdomain schema) + [03](03-scope-per-tenant-theming.md)
  (stored theme shape); lands as implementation issues in the final PRD breakdown, not a decision
  ticket. (Surfaced resolving [01](01-scope-design-system-integration.md).)
- **Default-site catalogue policy revisit** — "my-course.app shows all courses" is the pinned v1;
  the user expects to change this later (curation/opt-out). Becomes specifiable after the tenant
  model lands and real tenant courses exist.
- **Per-tenant payments & email** — merchant accounts (PayFast/Paystack) and Resend sender
  domains per tenant; flagged in the tenant-model ticket, deliberately not solved there. Hangs on
  the payments roadmap's gated phases. (Invite/notification email *branding* is v1 per
  [02](02-scope-tenant-subdomain-model.md); the per-tenant *sender domain* is the deferred part.)
- **Open/public self-signup for the marketplace** — v1 sign-up stays allowlist-gated per tenant
  ([02](02-scope-tenant-subdomain-model.md)); public buyers self-registering (no allowlist) is
  deferred, tied to the payments roadmap.
- **Apex/custom domains per tenant** (e.g. a brand's own domain instead of a my-course.app
  subdomain) — later; the subdomain model should merely not preclude it.
- **Rich-media/video as a tenant flag** — parallel [rich-media](../../rich-media/README.md)
  effort; reserved as a **future** row in [04](04-scope-per-tenant-feature-flags.md)'s flag
  inventory, enforced once the feature itself exists.
- **AI content-regeneration ("Builder prompt box") and a more dynamic, content-aware Q&A** —
  raised by the operator mid-grilling [04](04-scope-per-tenant-feature-flags.md); neither exists
  in the codebase today. Reserved as future rows in 04's inventory; get their own scoping ticket
  (feature + flag together) once the operator wants to build them.
- **PRD + implementation-issue breakdown** — the destination's final step; specifiable only once
  the scoping tickets close.

## Out of scope

- **Tenant *provisioning* self-service** — tenants creating their own tenant, billing/subscription
  self-management. Stays out. (⚠️ **Narrowed by [02](02-scope-tenant-subdomain-model.md), 2026-07-15:**
  tenant *admins* managing their own members/branding/flags/assignment are now **in** scope — a
  two-tier sys-admin/tenant-admin model. Ticket 06's dashboard is therefore operator **and
  tenant-admin**-facing, not operator-only.)
- **Building per-tenant payment rails** — the payments roadmap is separately gated
  (Paystack-first); this map only keeps the tenant record from precluding it.
- **Redesigning flows/visuals** — visual decisions were agreed in the UI-redesign prototype;
  ticket 01 integrates, it does not redesign.
