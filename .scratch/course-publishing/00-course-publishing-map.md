# course-publishing/00: Course publishing, tenant catalogue & free self-enroll — map

**Status:** in progress — tickets 01, 02 resolved 2026-07-18; frontier open (03, 04, 07 takeable).
**Labels:** wayfinder:map

## Destination

A locked **spec** (PRD + implementation issues, ready to hand to a `/tdd` build) for a model where:

- a course owner can **publish** a course — listing it in its tenant's **catalogue** and marking it
  *free* or *priced* (the price affordance appears only when the tenant's new `selling` flag is on;
  money still flows on the single existing platform PayFast rail);
- tenant **members browse their catalogue and join** — free courses via a brand-new one-click
  **self-enroll** (a new free-access grant; none exists today), paid courses via the existing
  PayFast purchase;
- the existing anonymous **public link** (bearer-token, no account) stays unchanged, alongside.

The map is done when every decision below is resolved and ticket 06 has captured the PRD + issues —
i.e. nothing left to decide before someone builds it. This is a **planning** map: produce the spec,
not the feature.

## Notes

- **Tracker:** local markdown (this directory). Blocking via `**Depends on:**` lines listing the
  ticket numbers that must close first; a ticket is **claimed** by adding `**Claimed:** <who/session>`
  under its Status before working it. Refer to tickets by **name**, not bare number.
- **Skills per session:** `/grilling` + `/domain-modeling` for the grilling tickets, `/prototype`
  for the catalogue ticket, `/ponytail` posture throughout (four known tenants — no speculative
  platform), `convex:convex-expert` to sanity-check any `convex/` data-model shape. `/tdd` is for the
  *implementation* issues ticket 06 produces, not for this map.
- **Codebase facts pinned at charting (2026-07-18) — treat as ground truth, don't re-derive:**
  - There is **no "enroll" concept today.** Read access to a course resolves from exactly four
    grants: **ownership**; a **`shares`** row (owner grants a person one Edition `(topic, lang)`);
    an **`entitlements`** row (paid via PayFast, or admin-granted, per `(topic, lang)`); a
    **`publicLinks`** token (anonymous, no account, per Edition — English maps to the legacy
    `topics.publicToken`).
  - The **paid marketplace already exists** (ADR 0016, `convex/market.ts`): `listings` (a price per
    Edition — its presence makes the Edition paid), `entitlements`, the verified PayFast ITN
    (`fulfillPurchase`), Sellers (`isReadySeller` = can-sell grant + payout bank details), and
    `sellingEnabled()` — a **deployment-wide** env gate (PayFast vars + `PAYFAST_MODE`), one merchant
    account for the whole platform.
  - **Pricing/public-links are per-Edition `(topic, lang)`**, not per-course.
  - **Tenant feature flags** (whitelabel issue 04): flat required booleans on the `tenants` row;
    "Marketplace/payments" was reserved as a **future** flag row (name reserved, no enforcement). A
    flag added later defaults `false` (opt-in per tenant).
  - `topics.tenantSlug` is a **visibility filter** (default site lists all; a subdomain lists its
    own). Members are connected to the default site only, or exactly one subdomain.
- **Constraints pinned by the user (2026-07-18) — requirements, not open questions:**
  - The driving pain is **learner-driven discovery** (members browse a catalogue and pick what to
    start), *not* operator onboarding-friction.
  - The anonymous public link **persists alongside** publish (it is not replaced).
  - "Selling enabled for that tenant" = a **per-tenant flag only**; the money stays on the single
    existing platform rail. Per-tenant merchant rails are out of scope (see below).
  - Member-initiated **un-enroll is out of scope** (see below).

## Decisions so far

<!-- one line per closed ticket: gist + link -->

- [Model free self-enroll](01-model-self-enroll-grant.md) — self-enroll is a **new fifth access
  grant**: a dedicated **`enrollments`** table (row `{ userId, topicId, lang }`, per-Edition), *not*
  a reused free-entitlement or self-share (both would mislabel the join under "Purchases" /
  "Shared with me"). The resolver gains one branch → a distinct **`enrolled`** level (≡ viewer for
  access). The grant is **permanent/grandfathered**: pricing a formerly-free Edition keeps existing
  enrollees in, stops only new free joins. Created only for a currently-free **published** Edition;
  private/unpublished stays grant-only. Captured as
  [ADR 0023 draft](adr-0023-draft-self-enroll-access-primitive.md). Surfaced the language axis →
  split three ways (see [ticket 07](07-language-scoped-access.md) + fog below).

- [Per-tenant `selling` flag](02-per-tenant-selling-flag.md) — a **sixth required `tenants.flags`
  boolean, `selling`**, defaulting **`false`** everywhere (migration backfills the four existing rows;
  seed path defaults false). Gates `assertTenantFlag(…, "selling")` at **both** `setEditionPrice` and
  `startCheckout`, composing with (not replacing) the deployment-wide `sellingEnabled()`. Flag-off is
  frozen-not-revoked: listing persists, existing buyers keep access, the Edition becomes unbuyable,
  and `clearEditionPrice` stays **un-gated** so an owner can always drop a stuck price to free.
  Default-site selling (undefined slug → flag implicitly on) is deferred to
  [ticket 04](04-default-site-vs-tenant-scope.md).

## Not yet specified

<!-- in-scope fog, too dim to ticket sharply yet -->

- **Full app-UI (chrome) translation** ("the entire app translation going forward") — localizing the
  interface itself, and running the **app UI in one language while enrolling in another** (app-language
  and content-language as two independent settings). No i18n exists in the app today (English-only).
  Large and only loosely coupled to publishing — **a candidate for its own wayfinder effort/map**,
  not this one (user decision 2026-07-18, the three-way language split). The *content-language* half
  is in-scope here as [ticket 07](07-language-scoped-access.md); this fog item is the *app-UI* half.

- **New-course-published notifications** — telling a tenant's members when a course lands in their
  catalogue. Dim until the catalogue/publish model exists.
- **Per-course opt-out of the catalogue** — a course that is published/priced but deliberately hidden
  from the browse surface (link-only). Interacts with the "default-site catalogue policy revisit"
  fog carried on the whitelabel map. Revisit after the publish model lands.
- **Enrolment expiry / time-boxed access** — whether a self-enroll grant can lapse. No requirement
  for it yet; parked.

## Out of scope

- **Member-initiated un-enroll** (ruled out 2026-07-18) — self-enroll is one-way for v1; a member
  leaving a course, progress deletion, and re-enroll are a later effort, not this destination.
- **Per-tenant merchant rails** — each tenant selling under its own PayFast/Paystack account and
  payouts. This is the separately-gated payments roadmap, already walled off by the whitelabel map;
  this map only adds a per-tenant *flag* over the one existing platform rail.
- **Replacing/removing the anonymous public link** — it persists unchanged (user chose to keep both
  the link and the new catalogue/enroll path).
