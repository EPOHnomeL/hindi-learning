# Whitelabel

## Verification still outstanding (recorded 2026-07-30)

The map is closed and every implementation issue is built, but **eight tickets
were never verified in a browser or on prod** — they went green on static gates
only. This is real open work that "destination reached" hides, so it is recorded
here rather than left buried in ticket Status lines. Nothing below is a decision;
none of it reopens the map.

**Six of the eight cleared on 2026-08-01** (see the first bullet). What is left is
[18 cross-host canonical redirect](tickets/18-cross-host-canonical-redirect.md), never
verified either way, and [23 legacy course tenant backfill](tickets/23-legacy-course-tenant-backfill.md),
which waits on the operator, not on a browser.

- **UI/browser check PASSED on prod** (operator, 2026-08-01, during the
  [ywampotch-launch ticket 07](../ywampotch-launch/tickets/07-prod-verify-security-fixes.md)
  sitting — reported as "up and running, all those things work perfectly for a whitelabel"):
  [11 SSR theme application](tickets/11-ssr-theme-application.md),
  [13 lesson palette override](tickets/13-lesson-tenant-palette-override.md),
  [19 Tenants tab shell](tickets/19-dashboard-tenants-tab-shell.md),
  [20 theme editor](tickets/20-dashboard-theme-editor.md),
  [22 assignment + removal guard](tickets/22-dashboard-assignment-and-removal.md),
  [24 grant/revoke tenant admin](tickets/24-grant-tenant-admin.md).
  All six of the outstanding UI checks — this bullet is now the whole of that list.
- **Implemented, no verification recorded either way**:
  [18 cross-host canonical redirect](tickets/18-cross-host-canonical-redirect.md).
- **Waiting on an operator decision, not on code**:
  [23 legacy course tenant backfill](tickets/23-legacy-course-tenant-backfill.md) — a real
  prod re-bake is the operator's call.

These overlapped the live [ywampotch-launch map](../ywampotch-launch/map.md): its
ticket 07 put a human on prod against a real tenant host, and that sitting is what
cleared the six above. Sequencing them together worked; 18 and 23 remain.

## Destination

<!-- Heading kept exactly `## Destination`: the parser matches section headings
     literally, so annotating it ("— reached") made the whole section invisible and
     the map reported as having no Destination at all. The reached/not-reached
     status belongs in the body, as below. -->

**Reached.** Whitelabel v1 is fully specified and captured as a [PRD](spec.md) + 17 local implementation
issues (07–23), per the CLAUDE.md pipeline: an agreed tenant/subdomain model, per-subdomain
theming on a tokenised design system, per-tenant feature flags with backend enforcement, and an
operator whitelabel dashboard. One task was carried in-map as execution: the four tenant
subdomains live on my-course.app. Building the implementation issues (`/tdd` + `/ponytail`, one
issue per session in dependency order) is the next work — not another `/wayfinder` session.

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

- [Provision the four tenant subdomains](tickets/05-provision-tenant-subdomains.md) — the four
  `<slug>.my-course.app` hosts (upf, ywampotch, almighty-warriors, yknot) are live over HTTPS
  via four explicit Cloudflare CNAMEs → Vercel `hindi-learning`; all render the default site
  until tenant-resolution middleware lands.
- [Scope Claude design system integration](tickets/01-scope-design-system-integration.md) — app chrome is
  already token-driven, so integration is minimal; the real output is the token **contract**.
  Theme = a curated ~14-token flat map (`TenantTheme`, light required + dark optional) living in a
  new `src/design/tokens.ts`; one override re-skins both surfaces via shared var names (per-surface
  prefix). Lesson blobs re-skin by **render-time injection** (existing `buildSrcDoc` rail), with new
  courses generated in-style and migration scripts for old ones. Code is canonical; artifact
  archived. Tenant *application* machinery deferred to 03.
- [Scope tenant & subdomain model](tickets/02-scope-tenant-subdomain-model.md) — the deepest cut, captured
  as [ADR 0021 draft](adr-0021-draft-tenant-subdomain-model.md). Tenant = a Convex `tenants` row
  keyed by slug (seed the four). Courses/users carry `tenantSlug?` (slug string, no join). Isolation
  = shared dataset, subdomain is a **visibility filter**: default lists all, subdomain lists its own;
  user↔subdomain gates admission + home only (access stays grant-based); **skin follows the host**;
  cross-host links redirect to canonical host. **Two-tier admin** — sys admin + tenant admins
  (scope change, see Out of scope) on `whitelist` via `isAdmin`+`tenantSlug`; **retires ADR 0011's
  one-Admin invariant**. Invite emails tenant-aware at v1; middleware host-label resolution; tenant
  slug a spoof-safe Convex arg; `*.localhost` for dev. Unblocks 03 + 04.
- [Scope per-tenant branding & theming](tickets/03-scope-per-tenant-theming.md) — theme is an **inline
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
- [Scope per-tenant feature flags](tickets/04-scope-per-tenant-feature-flags.md) — **flat required
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
- [Scope the operator + tenant-admin whitelabel dashboard](tickets/06-scope-operator-whitelabel-dashboard.md)
  — the map's last scoping ticket, **destination reached**. All five candidate surfaces are v1
  (tenant list+create, theme editing, flags, course/user↔subdomain assignment) — no CLI exists to
  defer any of them to. Lives as a new **"Tenants" tab extending `/admin`**, scope-aware: sys admin
  gets a tenant picker + create/remove, tenant admin is locked to their own tenant. **Theme editor
  is both** — JSON import (matches how a design handoff actually arrives) plus structured per-token
  fields for fine-tuning. **Assignment pickers live inside the tenant's own tab** (tenant-centric,
  not item-centric). **Only tenant removal needs a confirm, and it's a hard block** (not a cascade)
  while any course/member still references the tenant — mirrors ADR 0011's refuse-to-remove-the-
  one-Admin pattern; 04's flag-off rule already covers the other "existing grants" safety question.
  Ran a `/prototype` pass for the one open layout question (three structurally different
  tenant-detail layouts, mounted on the real `/admin` route, mock data, then deleted once judged):
  **winner is the stacked-scroll layout** — sidebar tenant list, selected tenant's Theme/Flags/
  Courses/Members/Remove stacked as sections on one scrolling page, no sub-navigation.
- [Tenant schema & seed](tickets/07-tenant-schema-and-seed.md) — `tenants` keyed `by_slug`;
  `tenantSlug?` on `topics`/`users`/`whitelist` as a **slug string, no join**. `users` had to be
  inlined from `authTables` (all original fields + email/phone indexes preserved) to carry the new
  field. `seedTenant` upserts idempotently — **skip, never overwrite**. The 14-key token contract is
  enforced in code (`assertThemeTokens`), but Convex cannot import `src/`, so its token list is a
  **mirror** of 09's — keep the two in sync.
- [Scope-aware admin roles](tickets/08-scope-aware-admin-roles.md) — **the row shape decides the
  role**: `isAdmin` + no slug = sys admin (passes every check), `isAdmin` + slug = tenant admin
  (passes only a matching scoped check). `isCallerAdmin`'s no-arg semantics are unchanged, so every
  existing caller was unaffected. `removeEmail` refuses to drop a sys admin only when it is the
  **last** one. The ADR graduated as **0022**, not 0021 — that number was taken in the interim —
  and ADR 0011's one-Admin invariant is formally superseded.
- [Design token contract cleanup](tickets/09-design-token-contract-cleanup.md) — `src/design/tokens.ts`
  is the contract: the 14 names, the per-surface prefix rule, the token semantics. Both stylesheets
  were reconciled **additively, zero visual change** (`globals.css` gained `good`/`bad`, `head.html`
  gained `line`/`danger`, each inert on the other surface), taking `head.html`'s values because
  **code is canonical**. One intended visual change: 7 raw red utilities → `text-danger`.
- [Tenant resolution middleware](tickets/10-tenant-resolution-middleware.md) — `resolveTenantSlug(host)`
  is pure, and `TENANT_SLUGS` is **static**: adding a tenant is an operator task, so there is no
  per-request Convex read on the hot path. The middleware **deletes any inbound `x-tenant-slug`**
  before forwarding, so a client cannot force a skin. `getTenantSlug()` keeps a direct Host
  fallback, so correctness never depends on the header surviving Convex Auth's response re-wrap.
- [SSR theme application](tickets/11-ssr-theme-application.md) — the app's first server-side Convex
  fetch. **One `getTheme(slug)` serves all three consumers** (SSR palette, server favicon, client
  context) precisely so they cannot drift; public by design (ADR 0021 §6). The no-flash `<style>`
  emits under **`:root:root`** — the doubled selector beats Tailwind's `@theme :root` regardless of
  source order — plus a **partial** dark block, so unset tokens fall through to the default dark.
  `getTenantView()` degrades to the default skin and logs rather than 500ing the site.
- [Brand asset upload](tickets/12-brand-asset-upload.md) — no new upload rail: reuses
  `resources.generateUploadUrl` and **`assertEmblemImage` verbatim** (raster only, **SVG refused**
  for anonymous-page XSS, 256 KB cap). **Mint-new-never-overwrite** — records the new storage id,
  never deletes the old blob, and spreads the existing `theme` so only one id changes. `getTheme`
  already resolved ids to urls, so there was no read-side change.
- [Lesson tenant palette override](tickets/13-lesson-tenant-palette-override.md) — one builder for
  both surfaces via a `prefix` param: chrome keeps `--color-<t>`, lessons pass `""` for the design
  system's bare `--<t>` names. `buildSrcDoc` splices the `<style>` **last**, closest to `</head>`,
  so it wins source-order ties. Wired once at `Frame`, which backs both `LessonView` and
  `ReferenceView` — so one point covers lessons, references and translated Editions.
- [Tenant-aware invite email](tickets/14-tenant-aware-invite-email.md) — `brand` is an **optional
  third param**, and omitting it renders the pre-whitelabel email **byte-identical**.
  `paletteFromTokens(light)` derives the 8-slot email palette, and a missing token falls back to the
  house default so a **partial palette cannot blank a slot**; `faint` has no dedicated token and
  shares `soft`. The header prefers the tenant logo, else the text wordmark.
- [Tenant-aware certificate](tickets/15-tenant-aware-certificate.md) — identity comes from the
  existing `useTenant()` seam, which resolves on anonymous pages too, replacing both hardcoded
  issuer strings from one place. **The palette freeze is the crux:** a `.cert-card` reset
  re-declares all 14 tokens back to the default, because custom-property resolution prefers a
  declaration on the element itself over an inherited one — which is what stops 11's `:root:root`
  tenant override from repainting a certificate.
- [Per-tenant landing pages](tickets/16-per-tenant-landing-pages.md) — **the registry mechanism
  only, no bespoke tenant pages**: that is the correct v1 deliverable, since authoring the copy is
  later content work. `LANDING_REGISTRY` ships **empty**; `landingFor` is pure and
  registry-injectable, kept import-light on purpose so it unit-tests under `edge-runtime`.
  `useTenantSlug()` rides its own context because the registry keys on the slug and must resolve
  while `<Unauthenticated>` — before the `getTheme` query, whose tenant object omits the slug.
- [Feature flag enforcement](tickets/17-feature-flag-enforcement.md) — `assertTenantFlag` no-ops
  when `tenantSlug` is undefined, **fails closed on an unknown slug**, and derives `TenantFlag` from
  the schema validator so the keys cannot drift. Called inline at five create-side sites, and
  **placement is what carries the frozen-not-revoked rule**: after `claimCertificate`'s idempotent
  return, so a cert earned before the flip keeps resolving; and only when `isPublic === true`, so
  revoking a link stays allowed.
- [Cross-host canonical redirect](tickets/18-cross-host-canonical-redirect.md) —
  `canonicalRedirect(currentUrl, courseTenant)` is pure: strip any known-tenant label to find the
  base domain, re-attach the course's tenant, and swap **only the host**, with path, query and port
  preserved. Returning `null` when already canonical **is the loop guard**, and is tested
  explicitly from both the tenanted-subdomain and untenanted-apex sides.
- [Dashboard — Tenants tab shell](tickets/19-dashboard-tenants-tab-shell.md) — `whitelist.myAdminScope`
  (one indexed read → `{ role, tenantSlug }`) is **what now admits a tenant admin to `/admin` at
  all**; it was sys-only before. `listTenants` is a sys-only full scan of an operator-bounded table,
  the same posture as `whitelist.list`. `createTenant` normalises the slug and seeds the default
  theme + all-on flags, so a new row is immediately SSR/`getTheme`-resolvable.
- [Dashboard — theme editor](tickets/20-dashboard-theme-editor.md) — `updateTenantTheme` is the
  **identity-guarded twin** of the secret-guarded `setTenantTheme`, so an admin repaints from the
  dashboard without `PUBLISH_SECRET`. `themeWithAssetsPreserved` was extracted so both write paths
  fold a palette identically: replace `light`, take `dark` only if given, carry `logo`/`favicon`
  across. The editor is **both** JSON import and per-token fields, as 06 decided.
- [Dashboard — flag toggles](tickets/21-dashboard-flag-toggles.md) — `setTenantFlags` is
  **patch-style** (every flag optional, merged onto the existing set) so one switch sends one flag.
  Deliberately **no confirm dialog and no destructive edit**, because flag-off is frozen-not-revoked:
  the flip only changes what `assertTenantFlag` permits going forward, and touches nothing granted.
- [Dashboard — assignment and removal](tickets/22-dashboard-assignment-and-removal.md) — assignment
  is a one-field patch and removal a refuse-to-remove guard: **no cascade delete was introduced**.
  `assignCourse` refuses to **steal** a course already owned by another tenant, and the assignable
  member pool excludes sys admins so one cannot be silently demoted. Needed a new
  `whitelist.by_tenant` index.
- [Legacy course tenant backfill](tickets/23-legacy-course-tenant-backfill.md) — an operator
  migration script, **not a runtime mechanism**. Fidelity beyond 13's render-time 14-var override
  comes from **value substitution**: every default-palette hex is swapped for the tenant's across
  the whole stored blob, which repaints the hardcoded literals that reused those values — the ones
  the render-time override can never reach. The default palette is read **live** from `head.html`
  so the bake cannot drift from what `publish.ts` inlines. Strictly more fidelity than 13, and
  **not pixel-perfect** — that is the accepted bar.
- [Grant tenant admin](tickets/24-grant-tenant-admin.md) — `setTenantAdmin` is **sys-admin-only, and
  deliberately not the scoped check** the other member mutations use, because minting a tenant admin
  is a platform privilege rather than a tenant one. Revoke **keeps** `tenantSlug` — it demotes to
  member rather than unassigning — and an admin row cannot be unassigned directly: demote first.

## Not yet specified

- **Four tenant theme fixtures** — the theme shape is pinned by
  [01](tickets/01-scope-design-system-integration.md) (14-token `TenantTheme`) and its storage/application by
  [03](tickets/03-scope-per-tenant-theming.md) (inline `theme` object on the `tenants` row; SSR override).
  03 carries **placeholder mock palettes** for all four as its acceptance fixture — the remaining
  work is authoring the **real** upf/ywampotch/almighty-warriors/yknot design systems (one Claude
  design system per tenant, per the operator) plus the hand-authored per-tenant **landing pages**.
  Likely a prototype/build ticket per tenant, or one covering all four.
- **Authoring-in-tenant-style + course migration scripts** — new courses should be *generated*
  in the owning tenant's palette (baked at publish, not just injected), and existing courses need
  scripts to move them under a tenant. Sharp as a requirement but hangs on
  [02](tickets/02-scope-tenant-subdomain-model.md) (course↔subdomain schema) + [03](tickets/03-scope-per-tenant-theming.md)
  (stored theme shape); lands as implementation issues in the final PRD breakdown, not a decision
  ticket. (Surfaced resolving [01](tickets/01-scope-design-system-integration.md).)
- **Default-site catalogue policy revisit** — "my-course.app shows all courses" is the pinned v1;
  the user expects to change this later (curation/opt-out). Becomes specifiable after the tenant
  model lands and real tenant courses exist.
- **Per-tenant default course-access policy + self-enroll** (raised & parked 2026-07-18) —
  **graduated 2026-07-18 into its own effort:
  [Course publishing map](../course-publishing/map.md)**.
  A `/grilling` + `/domain-modeling` pass reframed it: the driving need is *learner-driven
  discovery*, so the effort is now **course publishing + a tenant catalogue + free self-enroll** (the
  app has **no "enroll" concept** today — a new access-policy layer). No longer fog on this map; see
  that map for the frontier. Still interacts with the Default-site catalogue revisit above and the
  flags model ([04](tickets/04-scope-per-tenant-feature-flags.md)).
- **Per-tenant payments & email** — merchant accounts (PayFast/Paystack) and Resend sender
  domains per tenant; flagged in the tenant-model ticket, deliberately not solved there. Hangs on
  the payments roadmap's gated phases. (Invite/notification email *branding* is v1 per
  [02](tickets/02-scope-tenant-subdomain-model.md); the per-tenant *sender domain* is the deferred part.)
- **Open/public self-signup for the marketplace** — v1 sign-up stays allowlist-gated per tenant
  ([02](tickets/02-scope-tenant-subdomain-model.md)); public buyers self-registering (no allowlist) is
  deferred, tied to the payments roadmap.
- **Apex/custom domains per tenant** (e.g. a brand's own domain instead of a my-course.app
  subdomain) — later; the subdomain model should merely not preclude it.
- **Rich-media/video as a tenant flag** — parallel [rich-media](../../rich-media/README.md)
  effort; reserved as a **future** row in [04](tickets/04-scope-per-tenant-feature-flags.md)'s flag
  inventory, enforced once the feature itself exists.
- **AI content-regeneration ("Builder prompt box") and a more dynamic, content-aware Q&A** —
  raised by the operator mid-grilling [04](tickets/04-scope-per-tenant-feature-flags.md); neither exists
  in the codebase today. Reserved as future rows in 04's inventory; get their own scoping ticket
  (feature + flag together) once the operator wants to build them.

## Out of scope

- **Tenant *provisioning* self-service** — tenants creating their own tenant, billing/subscription
  self-management. Stays out. (⚠️ **Narrowed by [02](tickets/02-scope-tenant-subdomain-model.md), 2026-07-15:**
  tenant *admins* managing their own members/branding/flags/assignment are now **in** scope — a
  two-tier sys-admin/tenant-admin model. Ticket 06's dashboard is therefore operator **and
  tenant-admin**-facing, not operator-only.)
- **Building per-tenant payment rails** — the payments roadmap is separately gated
  (Paystack-first); this map only keeps the tenant record from precluding it.
- **Redesigning flows/visuals** — visual decisions were agreed in the UI-redesign prototype;
  ticket 01 integrates, it does not redesign.
