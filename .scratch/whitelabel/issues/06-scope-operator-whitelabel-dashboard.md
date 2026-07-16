# whitelabel/06: Scope the operator whitelabel dashboard

**Status:** done
**Claimed:** 2026-07-16 (session continuing from whitelabel-handoff-04-done-2026-07-16.md)
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
> **Updated by [04](04-scope-per-tenant-feature-flags.md) (2026-07-16):** the flags 06 edits are five
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

---

## Resolution (2026-07-16, grilling + prototype session)

Grilled to shared understanding across 6 decisions, then ran a `/prototype` pass to settle the
one genuinely open layout question. This is the map's last scoping ticket — **the destination is
reached**: whitelabel v1 is now fully specified, ready for PRD + implementation-issue breakdown.

### Findings that framed the questions (codebase reality, verified this session)

- **The only admin surface today** is `/admin` → `AdminPanel.tsx`, gated on `useQuery(api.whitelist.amIAdmin)`,
  rendering `AllowlistManager` — a single-workspace Allowlist portal (ADR 0011). Not tenant-scoped,
  not a general dashboard.
- **`isCallerAdmin`** ([`convex/whitelist.ts:63`](../../../convex/whitelist.ts)) exists but is
  **global-only** today — it checks `whitelist.isAdmin` with no `tenantSlug` parameter. The
  scope-aware two-tier version ADR 0021 describes (sys admin vs. tenant admin) is design-only,
  not implemented anywhere yet.
- **No `tenants` table exists yet** in `convex/schema.ts` — confirmed still true (02/03/04 are all
  decision documents, not a build).
- **No tenant-management CLI exists** — the `pnpm *:prod` scripts are all content-authoring/
  publishing/translation-pipeline tools (`claim`, `publish`, `materialise`, etc.); none touch
  tenants, so "defer to a CLI" was never actually a lower-effort alternative to a UI here.
- `src/app/layout.tsx` has no tenant-context provider yet (03's SSR palette rail is design-only) —
  confirms 03's own finding is still accurate.

### Decisions

1. **Surface inventory — all five in v1.** Tenant list + create, theme editing, flag toggles,
   course→subdomain assignment, user→subdomain assignment. No existing CLI to defer any of these
   to; building "list tenants + edit one" already yields (theme, flags) nearly for free since
   they're just fields on the same `tenants` row, and assignment is two picker UIs against that
   same row.
2. **Where it lives — extend `/admin` with a new "Tenants" tab**, alongside the existing
   Allowlist tab, rather than a separate route. Scope-aware: a **sys admin** sees a tenant picker
   (list + create, cross-tenant reach) plus every tab; a **tenant admin** is locked to their own
   tenant (no picker), matching ADR 0021 §4's two-tier model. This is the first UI to actually
   need `isCallerAdmin`'s scope-aware form — building it is 06's own implementation issue, not a
   dependency to wait on.
3. **Theme editing fidelity — both, JSON import *and* structured fields.** A JSON textarea to
   paste a full 14-token set (matches how a Claude/Figma design handoff actually arrives) plus
   per-token structured fields (labeled swatch/color-picker per named token, light/dark tabs) for
   later fine-tuning, with a live preview pane. Logo/favicon stay simple upload slots (per 03 —
   single raster asset each, no light/dark variants).
4. **Assignment surface — inside the tenant's own tab**, not on the course/user's own settings
   pages. Each tenant view gets an "Assigned courses" and "Assigned members" list with a
   search-and-add picker (by title/email). Tenant-centric, matching how a sys admin or tenant
   admin actually thinks ("what's in my tenant"), not item-centric.
5. **Safety — only tenant removal needs a confirm, and it's a hard block, not a cascade.**
   04 already settled the flag-off case (frozen-not-revoked, no confirm needed); this ticket adds
   no extra guard for flag toggles, course/member unassignment, or tenant-admin demotion beyond a
   plain UI confirm. Tenant removal is the one destructive action: **blocked outright** (button
   disabled + explanation) while any `topics`/`whitelist`/`users` row still references the
   `tenantSlug` — mirrors ADR 0011's "refuses to remove the one Admin row"; no cascade-delete
   pattern exists anywhere else in this codebase, so this stays consistent rather than introducing
   the first one.
6. **Screen-level sketch — ran `/prototype` rather than defer it.** Three structurally different
   layouts for the tenant-detail screen (sub-tabbed detail, stacked scroll, two-column split),
   built as a throwaway variant switcher mounted on the real `/admin` route (real header, real
   styling tokens, mock tenant/course/member data — no Convex wiring), then deleted once the
   winner was picked. **Winner: Variant B — stacked scroll, sidebar tenant list.** Sidebar lists
   the four tenants (tenant admins would see only their own, per decision 2); the selected
   tenant's panel stacks Theme → Flags → Courses → Members → Remove-tenant as sections on one
   scrolling page, no sub-navigation. Chosen over the sub-tabbed layout (nests navigation an extra
   level for no real payoff at four sections) and the two-column split (loses the persistent
   tenant list, which matters more here than screen-width efficiency with only a handful of
   tenants).

### v1 dashboard surface (handed to the PRD)

| Surface | v1? | Lives | Notes |
|---|---|---|---|
| Tenant list + create | ✓ | Sidebar (sys admin only sees create + all tenants) | |
| Theme editing | ✓ | Tenant panel, "Theme" section | JSON import + structured per-token fields + logo/favicon upload |
| Flag toggles | ✓ | Tenant panel, "Flags" section | 5 plain booleans, one toggle row (04) |
| Course→subdomain assignment | ✓ | Tenant panel, "Courses" section | search-and-add picker |
| User→subdomain assignment | ✓ | Tenant panel, "Members" section | search-and-add picker, email-based |
| Tenant removal | ✓ | Tenant panel, bottom | blocked while any course/member still assigned |

### Access model

- Gated by the scope-aware `isCallerAdmin(ctx, tenantSlug?)` (ADR 0021 §4) — not yet built;
  building it is one of 06's own implementation issues, first consumed here.
- **Sys admin** (`isAdmin: true`, no `tenantSlug`): sees every tenant, the tenant picker, and
  create/remove.
- **Tenant admin** (`isAdmin: true`, `tenantSlug` set): sees only their own tenant's panel, no
  picker, no create/remove of other tenants.

### 06's implementation issues (for the eventual PRD breakdown)

1. Schema: add the `tenants` table (`slug`, `displayName`, `theme`, `flags` per 03/04) if not
   already landed by an earlier issue in the PRD ordering.
2. Make `isCallerAdmin` scope-aware per ADR 0021 §4 (`isCallerAdmin(ctx, tenantSlug?)` — global
   check when omitted, tenant-scoped check when given); add `whitelist.tenantSlug?`.
3. New "Tenants" tab in `AdminPanel.tsx`: tenant list/picker (sys admin) or locked single-tenant
   view (tenant admin), tenant create, tenant remove (blocked-while-assigned guard).
4. Theme editor: JSON-import textarea + structured per-token fields, light/dark, live preview,
   logo/favicon upload (reuse the `emblem.ts` rail per 03).
5. Flag toggle row: 5 booleans, wired to a `patch`-style mutation, scope-checked.
6. Course and member assignment pickers (search-and-add / remove), each a thin mutation over the
   `tenantSlug` stamp on `topics`/`whitelist`.
7. Tenant-removal guard: a query/check for "does this tenant have any assigned topics/whitelist/
   users rows" backing the disabled state + explanation text.
