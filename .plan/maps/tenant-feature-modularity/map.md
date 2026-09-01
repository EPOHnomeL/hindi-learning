# Tenant feature modularity

## Destination

Every feature the operator wants to sell, lend or withhold per brand is a **switch on
`tenants.flags`**: decided, built, and live on prod. Reaching the destination means three
things are true at once:

1. The switch **inventory** is settled and written down: what has a switch, how the switches
   group (selling, then the two voucher rails, then EFT), and which grain owns each feature.
2. An off feature **disappears**. The affordance is gone from the UI and the server still
   refuses as a backstop. Today only `donations` behaves this way; the other five let the
   learner click and then throw *"This feature isn't available on this site."*
3. The **add-a-flag rule** is written where the next feature will find it, so nobody has to
   re-derive it.

## Notes

- **This map carries build tickets, deliberately** (wayfinder's plan-don't-do default is
  overridden here, per the user on 2026-09-01). Tickets 01 to 06 are decisions; 07 to 14 are
  `/tdd` builds `blocked_by` them. A decision ticket resolving means *decided, NOT built*: its
  build ticket is the thing that renders unstarted. Build tickets carry `- [ ]` todo lists
  under **Done when**; tick them as they land.
- **Skills per session:** `/grilling` + `/domain-modeling` for the grilling tickets,
  `/prototype` for [06](tickets/06-the-client-hide-seam.md), `/tdd` + `/ponytail` for every
  build ticket. Four known tenants, so no speculative platform.
- **Scope fixed by the user at charting (2026-09-01)**, requirements rather than open questions:
  - **Tenant grain only.** Per-course switches (`topics.teacherQa`), per-seller grants
    (`sellers.canSell`), and the deployment kill switch (`PAYFAST_MODE`) stay exactly as they
    are. This map states how a tenant flag *composes* with them; it does not retrofit them.
  - **Booleans only.** Valued per-tenant configuration (which app locales a tenant offers, a
    generation cap, a price ceiling) is fog, not this destination.
  - **Off never revokes.** Frozen-not-revoked (whitelabel ticket 04 / ADR 0022) holds: a flip
    stops new grants and touches nothing already granted. Ruled out of scope below.
- **Codebase facts pinned at charting (2026-09-01), verified in the tree. Don't re-derive:**
  - The mechanism is `assertTenantFlag(ctx, tenantSlug, flag)` in `convex/tenantFlags.ts`,
    called inline at **five create-side sites**: `certificates.claimCertificate`,
    `translate.startTranslation`, `shares.setTopicPublic` / `setEditionPublic`,
    `capture.askQuestion`. Read paths never call it. An unknown slug **fails closed**; an
    **undefined** slug (the default site) **passes**, so the apex cannot be switched off.
  - **Six flags exist**, not the five `docs/agents/project-context.md` claims:
    `certificates`, `translations`, `publicLinks`, `qa`, `seeding` (required booleans) and
    `donations` (**optional**, defaults off, with a payee-must-be-a-ready-seller precondition).
  - **Only `donations` hides its UI** (`src/app/donate/page.tsx` `notFound()`,
    `DonateSection.tsx`). No other flag is read anywhere on the client except the admin
    toggles themselves.
  - **`flags` rides `tenants.getTheme`, a PUBLIC query**, surfaced through `useTenant()` in
    `TenantContext.tsx` as a plain reactive `useQuery`, deliberately flash-tolerant unlike the
    SSR-baked palette. Anything hidden by a flag will pop in unless 06 says otherwise.
  - **`tenants.setTenantFlags` is sys-admin-only** (unscoped `isCallerAdmin`), patch-style,
    no confirm dialog.
  - **Selling has no tenant grain at all.** It is gated by the per-seller `canSell` grant plus
    payout details (`isReadySeller`) and the deployment-wide `PAYFAST_MODE`. A **fully-scoped,
    unbuilt** `selling` flag already sits at
    [course-publishing ticket 11](../course-publishing/tickets/11-per-tenant-selling-flag.md), and this
    map absorbs it rather than re-deciding it.
  - **Both voucher rails are ungated** beyond seller-readiness: Bulk Vouchers
    (`convex/vouchers.ts`, `/redeem`, `mintBatch`) and Organisation Vouchers
    (`convex/accessCodes.ts`, `/join`, `mintAccessCode`, nickname and PIN Seats). The product
    names and the code names differ on purpose; see `docs/agents/project-context.md`.
  - **Two contradictory add-a-flag policies are on the books.** Whitelabel ticket 04: a new
    flag is optional and defaults `false`. Course-publishing ticket 02: `selling` is a
    *required* boolean with a widen-migrate-narrow backfill. Ticket 03 settles it.
  - Also currently **unflagged**: the catalogue/publish rail (`convex/catalogue.ts`,
    `publishedEditions`), the manual EFT purchase rail (`convex/eft.ts`), the generation
    Routine, Resources, the emblem, the per-course manage Dashboard tab, the PWA install
    sheet, and the interest form.
- Prod carries the real tenant accounts; dev only the two operator accounts. Data checks go
  through the `PUBLISH_SECRET`-guarded `pnpm *:prod` CLIs.

## Decisions so far

<!-- one line per RESOLVED ticket: gist + link -->

_None yet. The map was charted 2026-09-01._

## Not yet specified

- **Valued per-tenant configuration.** Which app locales a tenant offers (today `LOCALES` in
  `src/i18n/config.ts` is a global five), a per-tenant generation cap over the existing daily
  fire limit, a price ceiling. Booleans cannot express any of them. Ruled out of *this*
  destination by the user, but named here because the first tenant to ask "we only want
  English and Afrikaans" graduates it into its own effort.
- **Named plans or tiers.** A "Basic / Pro" bundle a tenant is assigned, with per-tenant
  overrides, sitting over the raw switches. Only becomes specifiable once the inventory from
  [01](tickets/01-the-tenant-switch-inventory.md) shows how many switches there actually are
  and which ones move together. clears-with: 01
- **Flag-set visibility.** `getTheme` is public, so any browser can read every tenant's flag
  set. Harmless while every flag names a shipped feature; sharp the first time a flag names an
  unreleased one. clears-with: 06
- **Owner-facing switches beyond `teacherQa`.** A course owner turning off a feature their
  tenant has on. Out of this destination's grain, but the shape of 01's grain call will make it
  sharp or moot. clears-with: 01
- **Retrofitting the other three grains.** Reconciling the per-seller `canSell` grant and the
  `PAYFAST_MODE` kill switch with whatever composition rule 01 lands on. Dim until that rule
  exists. clears-with: 01

## Out of scope

- **Off revoking what is already granted** (ruled by the user, 2026-09-01). A flag flip never
  hides a claimed certificate, a translated Edition, a published link or a purchased Edition.
  Frozen-not-revoked stands; changing it would need a superseding ADR and is a different effort.
- **Per-tenant merchant rails.** Each tenant selling under its own PayFast account with its own
  payouts. Already walled off by the whitelabel and course-publishing maps; this effort adds a
  per-tenant *switch* over the one existing platform rail, nothing more.
- **Tenant self-service provisioning.** A tenant creating itself or buying its own feature set.
  Stays out, as the whitelabel map ruled.
- **Redesigning any of the gated features.** This map decides whether a feature is on and makes
  it disappear cleanly when it is off. It does not touch how the feature works when it is on.
