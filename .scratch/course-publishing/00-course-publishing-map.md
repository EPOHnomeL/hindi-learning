# course-publishing/00: Course publishing, tenant catalogue & free self-enroll — map

**Status:** **destination reached** (2026-07-19) — all decision tickets (01–05, 07, 08) closed and
ticket 06 resolved. The spec is captured in **[PRD.md](PRD.md)** + eight implementation issues
(`09`–`16` in this directory), ready to hand to a `/tdd` build. Planning is complete; the next step is
a separate build effort against the PRD.
**Labels:** wayfinder:map
**Built 2026-07-28** (GitHub #114–#118) — and the build **amended the spec**: publishing is a
per-Edition `publishedEditions` row, not a `topics.status` value; a free published Edition reads ≡ a
Viewer with no join click (so nothing writes `enrollments`); the catalogue is a section on the
signed-in home, not a route. Decision of record:
[ADR 0024](../../docs/adr/0024-publish-at-the-edition-grain.md). The ticket-03 line below and the
PRD carry in-place amendment notes; **issue 11 (the per-tenant `selling` flag) is still unbuilt.**

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

- [Default-site vs tenant scope](04-default-site-vs-tenant-scope.md) — the default site **is** in
  scope (discovery pain is strongest on the flagship), but every catalogue is **scoped symmetrically**:
  subdomain *X* lists `tenantSlug = X`, the default site lists **only `tenantSlug`-absent** courses —
  **never** a tenant's (UPF/AW/Y-Knot). A learner wanting a tenant course signs up on that subdomain;
  no cross-tenant firehose on any member surface. Resolves **one facet** of the whitelabel map's parked
  *"default-site lists all courses"* fog (tightens it for the new member catalogue); per-course opt-out
  and default-site curation stay parked there, and platform-admin cross-tenant visibility is unchanged.
  **`selling` on the default site = implicitly on** (option A): absent `tenantSlug` **satisfies** the
  per-tenant flag gate and defers to the deployment-wide `sellingEnabled()` — no phantom tenant row
  (`assertTenantFlag` treats `tenantSlug == null` as pass).

- [Define the "publish" action](03-define-publish-action.md) — **`published` is a course lifecycle
  *status***, not an orthogonal flag: `status` becomes `seeded | active | completed | published`.
  `completed` = content-done + generation-frozen editing/proofing phase (editors, internal shares);
  `published` = **owner-only**, reachable only from `completed`, lists the course in its tenant
  catalogue (`unpublish → completed`, `reopen → active`). Publish is **orthogonal to price** (a
  status flip; free/priced stays per-Edition `listings`). Publish = catalogue **visibility only, not
  an acquisition gate**: self-enroll needs `published`, but **buy works via direct link regardless**
  (unlisted-but-buyable); public link + listings sit beside publish, unchanged. Surfaced
  [ticket 08 — Tenant-domain link generation](08-tenant-domain-links.md) (blocks the PRD) and parked
  the learner-progress %/estimate pain out of scope (below).

- [Tenant-domain link generation](08-tenant-domain-links.md) — a tenant course's server-built links
  land on its **own subdomain**, derived by **convention** `<slug>.<base>` where `base` = `SITE_URL`'s
  host minus a leading `www` (no new env, no `tenants` host column — custom domains stay ADR-0022 fog).
  `appUrl` gains an optional `tenantSlug`; the **open-redirect guard** now validates against that
  single **server-resolved** origin (slug is a topic column, never client input → trusted set implicit,
  no allow-list). **In scope:** checkout `return_url`/`cancel_url` + invite deep-links, routed through
  the **one** `appUrl` helper — **retiring redundant `APP_BASE_URL` onto `SITE_URL`**. **Unchanged:**
  ITN `notify_url` (stays `CONVEX_SITE_URL`, reachability a non-issue), and **public/share links**
  (already tenant-correct — built client-side off `window.location.origin`). Research + build notes in
  the [ticket](08-tenant-domain-links.md); PRD-blocker for [ticket 06](06-prd-and-issue-breakdown.md) cleared.

- [Language-scoped access](07-language-scoped-access.md) — **rescoped mid-grilling; premise obsolete.**
  Content-translation is **already live** (the `translations` table, `convex/translate.ts`, the
  reader's per-Edition switcher; access is already per-Edition), so the chartered
  content-language-**access** layer solved a non-problem. **Dropped:** no `users.contentLang` field, no
  access rule, no **disabled/greyed cross-language cards**, no switching/grandfather logic (all Q1–Q6
  discarded). **What survived** — the thin enroll-language question ticket 01 left: catalogue self-enroll
  uses a **per-card language pick, default English**; **Join enrolls the selected Edition** (one
  `enrollments` row); re-Join for another language (idempotent, per-Edition, grandfathered — ticket 01
  unchanged, **no new data model**); every published course joinable in ≥ English (**no locked cards**);
  the language control is **gated by the tenant `translations` flag** (off ⟹ English-only Join). **No
  `/prototype`** — the card affordance (language selector beside **Join**, native names from
  `LANGUAGES`) is **spec'd in words for [ticket 05](05-tenant-catalogue-surface.md)**. **Unblocks
  ticket 05.** Spun off the **chrome / app-UI i18n** effort (see below) as the user's actual priority.

- [The catalogue surface](05-tenant-catalogue-surface.md) — `/prototype` judged with the user; winner
  **Variant A "flat grid + filters"** (throwaway route built, judged, deleted). Spec for ticket 06: a
  new member **"Browse courses"** route in the authed chrome; a **filter chip row** (All / Free /
  Premium / My courses) over **one responsive card grid** at dashboard-parity density. Each card =
  title + **state badge** (Free · price · Joined · Purchased), 2-line mission, language chips,
  progress bar (joined/owned only), and a bottom **affordance**: **Join now** (free → ticket-01
  enroll grant) · **Buy·price** (priced → `startCheckout`) · **Continue/Open** (held). The **ticket-07
  language selector** sits beside Join/Buy when the tenant `translations` flag is on and the course
  has > 1 Edition (English default; acquires the selected Edition; **no disabled cards**). Empty state
  = "Nothing published yet." **Deferred (not this build):** the language pick should also localize the
  card's **title + mission**, not just the target Edition.

- [PRD + implementation issues](06-prd-and-issue-breakdown.md) — the convergence ticket. Synthesized
  all eight decisions into **[PRD.md](PRD.md)** and eight dependency-ordered, `/tdd`-sized
  implementation issues (`09`–`16`): the `enrollments` grant + `enrolled` resolver branch (09), the
  `topics.status → published` lifecycle (10), the `tenants.flags.selling` flag + widen-migrate-narrow
  (11), tenant-domain links via `appUrl(path, tenantSlug?)` (12), the self-enroll mutation (13), the
  catalogue query (14), the "Browse courses" surface (15), and enrolled-on-dashboard (16, safe to
  defer). No re-decisions; the collapsed ticket-07 content-language layer is kept out. **Map complete.**

## Not yet specified

<!-- in-scope fog, too dim to ticket sharply yet -->

- **Full app-UI (chrome) translation** ("the entire app translation going forward") — localizing the
  interface itself (buttons, menus, nav, the reader frame). No i18n exists in the app today (English-only).
  Large and only loosely coupled to publishing — **its own wayfinder effort/map**, not this one (user
  decision 2026-07-18, the three-way language split). **PROMOTED 2026-07-19:** resolving
  [ticket 07](07-language-scoped-access.md) surfaced that the *content-language* half was obsolete
  (content translation already live) and that **chrome i18n is the user's actual current priority** —
  to be stood up as a **new wayfinder effort with its own map**, separate from this course-publishing map.

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
- **Learner-progress percentage & lesson-estimate accuracy** (surfaced resolving
  [ticket 03](03-define-publish-action.md), ruled out 2026-07-18) — the moving-denominator churn
  ("15/16 → 16/17") and a wildly-off time estimate (~20 → 85). Publishing structurally cures the
  moving-denominator half (published ⟹ frozen lesson count; members only enroll from the catalogue).
  The remaining estimate-accuracy + in-progress %-display concerns are learner-facing and orthogonal
  to publish/catalogue/self-enroll → a **separate effort** (existing `lesson-estimate` /
  `course-completion` scratch dirs), not this destination.
