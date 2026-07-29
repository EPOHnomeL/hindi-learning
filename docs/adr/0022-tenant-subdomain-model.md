# Tenant & subdomain model (whitelabel v1)

> Deliverable of [whitelabel/02](../../.scratch/whitelabel/issues/02-scope-tenant-subdomain-model.md).
> Promoted from draft when whitelabel implementation started. The draft reserved
> "ADR 0021", but that number was taken by
> [ADR 0021 (open sign-up)](0021-open-signup-allowlist-gates-course-creation.md)
> in the interim, so this graduated as **ADR 0022**.

## Status

accepted — decisions agreed with the operator (jvorster63@gmail.com) 2026-07-15;
two-tier admin model implemented in whitelabel issue 08 (2026-07-17). Supersedes
[ADR 0011](0011-allowlist-in-convex-admin-portal.md)'s one-Admin invariant.

## Context

The app is single-site today: one Vercel app on `my-course.app`, one site-wide
[[Allowlist]] (`whitelist` table), exactly one [[Admin]] (ADR 0011), global
users/courses. Whitelabel v1 turns it multi-brand: one deployment serving
**upf, ywampotch, almighty-warriors, yknot**, each on `<slug>.my-course.app`
(subdomains already live over HTTPS via four explicit CNAMEs — ticket 05), each
re-skinned and feature-gated per tenant. This ADR fixes the tenant *model* that
theming (03), flags (04), and the admin dashboard (06) hang off. It does **not**
build any of them.

## Decision

### 1. A tenant is a Convex `tenants` table row

A thin runtime record, keyed by **slug** (the subdomain label = the tenant's
stable public identity). Seeded with the four known rows by a seed script; no
tenant self-signup, no public "create your brand" flow. The operator dashboard
(06) edits it at runtime — which is why it's a table, not static config.

Shape (grows as 03/04 land):
- `slug` (string, indexed `by_slug`) — the subdomain label, effectively immutable
  (renaming needs DNS work).
- `displayName` (string) — brand name shown in UI + emails.
- `theme` — **resolved by [ticket 03](../../.scratch/whitelabel/issues/03-scope-per-tenant-theming.md)**: an inline
  object `{ light, dark?, logo?, favicon? }` (14-token palette as a validated record +
  two raster asset storage ids). Edit-is-live; no separate `themes` table.
- `flags` — **resolved by [ticket 04](../../.scratch/whitelabel/issues/04-scope-per-tenant-feature-flags.md)**: a flat
  `{ certificates, translations, publicLinks, qa, seeding }` object of required booleans (no
  optional-with-implicit-default — every tenant row always carries an explicit value per flag).
  Enforced by a new `assertTenantFlag` helper called from each gated mutation, not baked into
  `getOwnedTopic`/`getViewableTopic`.
- branding assets (logo, favicon) — **inline on `theme`** per ticket 03 (raster storage
  blobs via the emblem rail).
- Per-tenant domain is derivable as `<slug>.my-course.app` for v1; an explicit
  custom-domain list is deferred fog.

### 2. Courses and users reference the tenant by slug string

`topics.tenantSlug?: v.string()` (indexed `by_tenant`) and
`users.tenantSlug?: v.string()`. Single optional field on each (cardinality
pinned: a course is default-only or default + one subdomain; a user is
default-only or exactly one). Slug (not `Id<"tenants">`) because it's already the
host identity — host→tenant match and every tenant-scoped query is a plain
indexed string equality, no join on the hot course-list path.

### 3. Data isolation — shared dataset, subdomain is a visibility *filter*

- **Catalogue rule (pinned):** `my-course.app` (default) lists **all** courses;
  `<slug>.my-course.app` lists only courses whose `tenantSlug` = that slug. A
  course with `tenantSlug` set shows on **both** the default site and its
  subdomain; unset = default-only.
- **User↔subdomain gates admission + home/catalogue only, NOT content access.**
  A user's tenant marks which brand owns the account (who admitted them, which
  branded catalogue is their home). It is **not** a second access-control layer:
  access to a course stays governed by ownership / Shares / public links, exactly
  as today. (No hard per-tenant partitions.)
- **Cross-host course link → redirect to the course's canonical host**
  (its subdomain if `tenantSlug` set, else default), path preserved. Never 404,
  never render under the wrong skin. Links are minted canonical from the start, so
  the redirect is a rarely-hit safety net; no loop (target host matches course).
- **Skin follows the host, never the viewer's tenant.** A upf-connected user who
  opens a course shared with them on `yknot.my-course.app` sees the yknot brand.
- **Share / public / certificate links are canonical to the course's host** and
  carry their token through the redirect. Marketplace consequence: a course sold
  on yknot's site is bought/viewed on `yknot.my-course.app`; the payment *rails*
  (merchant account, sender domain) are deferred (see §5).

### 4. Two-tier admin model (supersedes ADR 0011's one-Admin invariant)

Roles encoded on the `whitelist` row by scope — reuse `isAdmin`, add `tenantSlug`:

| Role | `whitelist` row | Reach |
|---|---|---|
| **Sys admin** | `isAdmin: true`, `tenantSlug` absent | Global — all tenants; the only role that creates/edits/removes tenants |
| **Tenant admin** | `isAdmin: true`, `tenantSlug: "<slug>"` | Their tenant only |
| **Member** | no admin flag, `tenantSlug` = their tenant (or absent = default) | — |

- **Sys admin** (`jvorster63@gmail.com`): everything, every tenant; owns the
  tenant *set*.
- **Tenant admin** (e.g. `ywampotchtpm@gmail.com` for ywampotch): admit/remove
  **their** members, edit **their** theme + flags, assign courses/users to
  **their** subdomain. Cannot create tenants or reach other tenants.
- **Multiple tenant admins per tenant allowed** — no cap. This **retires ADR
  0011's exactly-one-Admin invariant**; ADR 0011 must be superseded.
- `isCallerAdmin` becomes **scope-aware**: "is sys admin" (global) and "is admin
  *of tenant X*"; sys admin passes every tenant-scoped check.
- **Allowlist is per-tenant data.** `whitelist.tenantSlug?` added; the sign-up
  gate checks admission for **the host's tenant**. Editable by the sys admin (any
  tenant) and each tenant's own tenant admin (their tenant only).
- **One account → one tenant.** `users.tenantSlug` is stamped at sign-up from the
  host (this *is* the admission). Single Convex Auth install unchanged;
  authoring/ownership (`topics.ownerId`) stays orthogonal to admin role.

> **Implementation status (issue 08, 2026-07-17):** the scope-aware
> `isCallerAdmin(ctx, tenantSlug?)`, the scoped last-sys-admin lockout guard, and
> `seedEmail`'s `tenantSlug` bootstrap are **built and tested**. The **sign-up
> host→`users.tenantSlug` stamping** (threading the host through the
> `createOrUpdateUser` auth callback) and the tenant-admin-facing Allowlist
> editing surface are **deferred** to the dashboard chain (issues 19–22) — no
> current gate depends on them, and the auth-callback host plumbing is its own
> piece. Tenant-admin rows are creatable today via `seedEmail`.

### 4a. One session (and device settings) across subdomains — cookie scope

> **SUPERSEDED 2026-07-29 by [ADR 0025](0025-per-tenant-session-isolation.md).**
> Sessions, app language and theme are now **per tenant subdomain** — the exact
> opposite of this section. The reasoning below is left intact on purpose: it records
> that host-locked sessions were once treated as a bug, which is precisely what a
> future reader needs to know before "fixing" them again. What changed is the
> product intent, not a misunderstanding of the mechanics. Everything else in §4a —
> the `NEXT_PUBLIC_COOKIE_DOMAIN` knob, `src/lib/cookieDomain.ts`, and the
> `@convex-dev/auth` cookie patch — is deleted.

> Added 2026-07-21. Clarifies §3/§4 after the host-locked session was found to
> contradict them in practice.

"One account → one tenant" (§4) governs *admission and home catalogue*, not where
a session is valid. §3 already says a user may open a course shared to them on
another tenant's subdomain (skin follows host, no per-tenant partition). So a
**single session spans every `*.my-course.app` subdomain** — switching subdomains
must **not** force a re-sign-in.

The earlier re-sign-in was an unintended artifact: Convex Auth's Next.js
integration writes its session cookies with the `__Host-` prefix, which forbids a
`Domain` attribute and so locks them to one exact host. The same applied to the
chosen theme (localStorage, per-origin) and UI language (host-only cookie) — all
reset on a subdomain switch.

**Decision:** scope the session, theme, and locale cookies to the registrable
parent domain (`Domain=my-course.app`) so one sign-in and the device's
theme/language carry across subdomains. Mechanics:

- A single knob, `NEXT_PUBLIC_COOKIE_DOMAIN` (e.g. `my-course.app`), drives it.
  Unset → cookies stay host-only (the safe default for local dev and Vercel
  preview hosts — `*.vercel.app` is a public suffix and rejects a `Domain`).
  Resolved by `src/lib/cookieDomain.ts` (`cookieDomainFor(host)`), which only
  attaches the domain when the request host actually belongs to it.
- The auth cookies need a `patches/@convex-dev+auth` patch (`getCookieStore`):
  when a parent domain applies it swaps the `__Host-` prefix for `__Secure-`
  (which permits `Domain`) and sets `Domain`. Both the read and write paths run
  through that one function, so the cookie name stays consistent.
- Theme moves from localStorage to a parent-domain `hindi_theme` cookie (with a
  one-time localStorage→cookie migration); the locale cookie gains the `Domain`.
- The catalogue still filters by the **host** slug and every write is still
  guarded by identity — a caller whose home `tenantSlug` differs from the host is
  never rejected, they just see the host's catalogue (§3 unchanged).
- The cross-host canonical bounce (§3) is a **client-side history replace**
  (`CrossHostRedirect`), not a server redirect, so the back button returns to the
  previous subdomain instead of re-bouncing to the current one.
- **Rollout cost:** the cookie name changes (`__Host-*` → `__Secure-*`), so
  existing sessions are invalidated once on deploy — a single re-sign-in, after
  which switching subdomains is seamless.

### 5. Cross-cutting singletons — disposition

- **Invite/notification email → tenant-aware at v1** (brand name + canonical-host
  link threaded into the existing pure renderer; full palette theming waits for
  03). Removes the "My Course"-branded-invite-to-a-ywampotch-learner leak.
- **Certificate branding → derived, no new field** — a cert's canonical host = its
  course's tenant, so it renders under the right skin already.
- **Resend sender domain → deferred** (v1 sends from the one platform domain).
- **Payments merchant accounts → deferred** to the payments roadmap; the tenant
  record must not preclude a per-tenant merchant config.
- **Routine `OWNER_EMAIL` / authoring → no change** — already per-topic-owner;
  courses carry `tenantSlug`; authoring stays tenant-agnostic.

### 6. Resolution & local dev

- **Next middleware** reads the host header, takes the leftmost label, matches it
  against known tenant slugs; match → that tenant, no match / bare `my-course.app`
  → default. Same code whether domains are explicit or wildcard.
- **Explicit per-tenant domains kept** (as provisioned in 05). Adding a 5th tenant
  = operator task (CNAME + Vercel domain + seed row). Wildcard DNS deferred.
- **Tenant context reaches Convex as a query arg** (`tenantSlug`), resolved by
  middleware and passed by the client. **Spoof-safe by construction:** the slug
  only picks catalogue + skin; every privileged action is guarded server-side by
  identity (`isCallerAdmin`, ownership, Shares), never by the passed slug.
- **Local dev:** `<slug>.localhost:3000` (Chrome/Edge resolve `*.localhost` to
  127.0.0.1 with no hosts-file edit).

## Consequences / follow-ups for implementation

- **Schema migration:** add `tenants` table; add `tenantSlug?` to `topics`
  (index `by_tenant`), `users`, `whitelist`. Backfill: existing rows stay
  default (null) — safe. Seed four tenants + their tenant admins + sys admin.
- **Supersede ADR 0011** (one-Admin invariant → two-tier scoped roles).
- **Ticket 06** grows a tenant-admin-facing surface (was operator-only).
- **Implementation detail to nail at build:** how the host/tenant reaches the
  sign-up callback (client passes slug through sign-up params; spoof-limited by
  the per-tenant allowlist).
- **Deferred / fog:** per-tenant sender domains, per-tenant payment rails,
  open/public self-signup for the marketplace, apex/custom domains, default-site
  catalogue-curation policy.

## The four named tenants (worked example)

`upf`, `ywampotch`, `almighty-warriors`, `yknot` — each a `tenants` row on
`<slug>.my-course.app`, each with a tenant admin, each re-skinned (03) and
feature-gated (04), sharing one dataset filtered by `tenantSlug`.
