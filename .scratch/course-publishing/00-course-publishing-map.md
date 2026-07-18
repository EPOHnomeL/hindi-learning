# course-publishing/00: Course publishing, tenant catalogue & free self-enroll — map

**Status:** charting — frontier open (tickets 01–06 created 2026-07-18).
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

## Not yet specified

<!-- in-scope fog, too dim to ticket sharply yet -->

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
