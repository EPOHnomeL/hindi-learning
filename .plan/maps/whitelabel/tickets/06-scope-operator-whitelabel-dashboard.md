---
type: grilling
blocked_by: [02, 03, 04]
---
# Scope the operator + tenant-admin whitelabel dashboard

## Question

The platform operator wants a dashboard to run the whitelabel system — superseding the
"flag/theme UI deferred, operator edits DB" position 03/04 took before the map was charted. What
does v1 manage, and where does it live? (Updated by 02: the model is now two-tier, so this is
operator **and tenant-admin**-facing, role-scoped; by 03: theme editing = palette fields/JSON +
logo + favicon, landing pages explicitly OUT; by 04: flags = five flat booleans, a plain toggle
row, flag-off is frozen-not-revoked so no extra confirm.) Answer:

- **Surface inventory:** tenant list + create; per-tenant theme editing; flag toggles; course →
  subdomain assignment; user → subdomain assignment. Which are v1 vs "still fine in the DB"?
- **Where it lives:** a new operator area gated by the platform-Admin role (interacting with
  per-tenant admins) vs extending the operator CLIs. Assume UI; scope the minimum.
- **Theme editing fidelity:** raw token JSON with live preview vs structured fields.
- **Safety:** prod data is live — what needs confirmation/undo (e.g. flag off with existing grants)?
- Likely wants a `/prototype` pass once the surface list is agreed.

## Done when

A deliverable is produced: the v1 dashboard surface list, its access model, and a rough
screen-level sketch — enough for the PRD.

## Answer

Resolved 2026-07-16 (grilling + prototype), 6 decisions. The map's last scoping ticket —
destination reached; whitelabel v1 fully specified.

**Findings:** the only admin surface today is `/admin` → `AdminPanel.tsx` (gated on
`whitelist.amIAdmin`, renders `AllowlistManager`, not tenant-scoped); `isCallerAdmin`
(`convex/whitelist.ts:63`) is global-only; no `tenants` table exists yet; no tenant-management CLI
exists (the `pnpm *:prod` scripts are all content tools — so "defer to a CLI" was never a
lower-effort alternative); `layout.tsx` has no tenant-context provider yet.

**Decisions:**
1. **Surface inventory — all five in v1** (tenant list+create, theme, flags, course assignment,
   user assignment). No CLI to defer to; theme+flags are nearly free (fields on the same row),
   assignment is two pickers against the same row.
2. **Where it lives — extend `/admin` with a new "Tenants" tab**, alongside Allowlist, not a
   separate route. Scope-aware: sys admin sees a tenant picker (list + create, cross-tenant) + every
   tab; tenant admin locked to their own tenant (no picker). First UI to need the scope-aware
   `isCallerAdmin` — building it is 06's own implementation issue.
3. **Theme editing fidelity — both, JSON import *and* structured fields.** A JSON textarea for a
   full 14-token set (how a design handoff arrives) + per-token structured fields (swatch/picker,
   light/dark tabs) + a live preview pane. Logo/favicon are simple upload slots.
4. **Assignment surface — inside the tenant's own tab** ("Assigned courses"/"Assigned members" with
   a search-and-add picker), tenant-centric, not on the item's own settings pages.
5. **Safety — only tenant removal needs a confirm, and it's a hard block, not a cascade.** 04
   settled flag-off (frozen-not-revoked). Tenant removal is the one destructive action: **blocked
   outright** (button disabled + explanation) while any `topics`/`whitelist`/`users` row references
   the `tenantSlug` — mirrors ADR 0011's refuse-to-remove-the-one-Admin; no cascade-delete exists
   anywhere else, stays consistent.
6. **Screen-level sketch — ran `/prototype`** over three tenant-detail layouts (sub-tabbed detail,
   stacked scroll, two-column split), mounted on the real `/admin` route with mock data, then
   deleted. **Winner: Variant B — stacked scroll, sidebar tenant list.** Selected tenant's panel
   stacks Theme → Flags → Courses → Members → Remove-tenant on one scrolling page, no sub-navigation.

**v1 dashboard surface (handed to the PRD):** tenant list + create (sidebar, sys-admin-only create);
Theme (JSON + structured fields + logo/favicon upload); Flags (5 booleans, one toggle row); Course
assignment (search-and-add); Member assignment (search-and-add, email-based); Tenant removal
(blocked while any course/member assigned).

**Access model:** gated by scope-aware `isCallerAdmin(ctx, tenantSlug?)` (ADR 0021 §4 — not yet
built, first consumed here). Sys admin sees every tenant + create/remove; tenant admin sees only
their own tenant's panel, no picker.
