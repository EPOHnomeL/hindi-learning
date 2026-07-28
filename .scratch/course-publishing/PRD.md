# Course publishing, tenant catalogue & free self-enroll — PRD

> **AMENDED 2026-07-28 at build time — read this first.** Four of the five moving parts below shipped
> differently. The decision of record is
> [ADR 0024](../../docs/adr/0024-publish-at-the-edition-grain.md); this PRD's reasoning is still worth
> reading, but where the two disagree the ADR (and the code) win.
>
> | This PRD says | What shipped |
> |---|---|
> | `topics.status` gains `published` (§Data model, §Feature area 2) | A per-Edition **`publishedEditions`** row `{ topicId, lang, published }`. `topics.status` untouched; no Routine-gate change; no `setEditionPrice` gate widening (publishing is off the status axis, so the friction that motivated it doesn't exist) |
> | `enroll` mutation writes an `enrollments` row on a one-click Join (§Feature area 5, issue 13) | **No join click and no row.** A *free published* Edition reads ≡ a Viewer for any signed-in account, granted live in `grantsFor`. `enrollments` (ADR 0023) stays in place and is still honoured — nothing writes it |
> | A "Browse courses" **route** with filter chips, per-card language pick, Join/Buy affordances (§Feature area 4, issues 14–15) | An **available-courses section on the signed-in home**. No new route, no public catalogue, no landing-page change. One card action (Open); a priced Edition lands on its existing Preview + paygate, so no second checkout path. No filter chips, no per-card language selector |
> | Tenant scope resolved from the request host (issue 14) | **Issue 14 was right; the deviation was reverted 2026-07-28.** Scope resolves from the host after all (`useTenantSlug()` → a `catalogue.list` argument), same symmetry (subdomain → own slug; default site → untenanted only). The "one less thing threaded" version — the signed-in member's own `tenantSlug` — shipped broken: **nothing writes `users.tenantSlug`**, so every real member's catalogue was empty. See ADR 0024 §6's amendment |
>
> **Unchanged and still true:** owner-only publish; symmetric tenant scope, never cross-tenant; the
> anonymous public link persists beside all of it; publish is orthogonal to price and is not an
> acquisition gate (`startCheckout` stays un-gated on publish); title/mission stay source-language.
> **Not built and still open:** the per-tenant `selling` flag (issue 11) — independent of this build.
> (Issue 12's tenant-domain links shipped separately: `appUrl(path, tenantSlug?)`, `convex/payfast.ts`.)

**Status:** superseded in part by [ADR 0024](../../docs/adr/0024-publish-at-the-edition-grain.md); see
the amendment above
**Source:** [Course-publishing map](00-course-publishing-map.md) — eight decision tickets
(01–05, 07, 08), all `done`. This PRD **synthesizes** their resolutions into one build plan; it does
not re-decide anything. Where a section restates a decision, the ticket/ADR is the source of truth —
read it before touching that area's code.
**Posture:** `/ponytail` throughout — four known tenants, one deployment, one Convex backend, one
shared dataset. No speculative platform machinery. Each implementation issue is built `/tdd`
(test-first).

## Summary

Let a course owner **publish** a completed course into its tenant's **catalogue**, and let tenant
members **browse that catalogue and join** — free courses via a brand-new one-click **self-enroll**
(a fifth access grant; none exists today), priced courses via the existing PayFast purchase. The
anonymous **public link** persists unchanged, beside all of it.

Five moving parts, each already scoped by a closed ticket:

1. **`enrollments`** — a new fifth access grant (ticket 01 / [ADR 0023 draft](adr-0023-draft-self-enroll-access-primitive.md)).
2. **`topics.status` → `published`** — publish is a course lifecycle status, not a flag (ticket 03).
3. **`tenants.flags.selling`** — a per-tenant gate over the one platform PayFast rail (ticket 02),
   default-site-implicitly-on (ticket 04).
4. **The "Browse courses" catalogue** — a member surface, symmetric by tenant scope (tickets 04, 05),
   with a per-card language pick on Join (ticket 07).
5. **Tenant-domain links** — server-built checkout/invite links land on the owning tenant's subdomain
   (ticket 08).

## Goals

1. An owner can publish a `completed` course (owner-only) → it appears in its tenant's catalogue;
   `unpublish` returns it to `completed`.
2. A member browses their tenant's catalogue and **joins a free published course in one click**,
   writing a permanent, grandfathered `enrollments` grant that reads exactly like a Viewer.
3. A member **buys** a priced published course via the existing `startCheckout`, gated per-tenant by
   the new `selling` flag composed with the deployment-wide `sellingEnabled()`.
4. Every published course is joinable in **≥ English** (no locked/disabled cards); when the tenant
   `translations` flag is on and the course has > 1 Edition, the learner picks which language Edition
   Join/Buy targets.
5. Catalogues are **scoped symmetrically**: a subdomain lists its own `tenantSlug`; the default site
   lists only `tenantSlug`-absent courses — never a tenant's.
6. Server-built checkout return/cancel and invite deep-links for a tenant course land on that
   tenant's subdomain.
7. None of this regresses today's behaviour for `my-course.app`, for `tenantSlug`-absent content, or
   for the existing owner/Share/entitlement/public-link read paths.

## Non-goals (carried from the map's Out-of-scope + deferred fog)

- **Member-initiated un-enroll** — self-enroll is one-way for v1 (no leave/re-enroll/progress delete).
- **Per-tenant merchant rails** — the money stays on the single platform PayFast account; `selling`
  is a per-tenant *flag*, not a per-tenant merchant.
- **Replacing/removing the anonymous public link** — it persists unchanged, beside publish.
- **Learner-progress % & lesson-estimate accuracy** — separate effort (`lesson-estimate` /
  `course-completion` scratch dirs). Publishing structurally cures only the *moving-denominator* half.
- **Card title/mission localization** — selecting a card language localizes only *which Edition*
  Join/Buy targets, **not** the card's own title + mission text. The catalogue query returns
  source-language title/mission today; translating them per-Edition is a **deferred follow-up**
  (fold into the chrome/app-UI i18n effort — do not build now; ticket 05).
- **Custom / apex per-tenant domains** — stay ADR-0022 fog; origin is convention `<slug>.<base>` only.
- **Chrome / app-UI i18n** — its own wayfinder effort (promoted 2026-07-19), not this map.
- **Content-language *access* layer** — killed with ticket 07 (see the trap note below). No
  `users.contentLang`, no access rule, no disabled cross-language cards, no switch/grandfather logic.

## Trap — do not let the collapsed ticket 07 leak in

Ticket 07 was **rescoped mid-grilling**; its original premise is obsolete because content translation
already ships (`translations` table, `convex/translate.ts`, the reader's per-Edition switcher). What
survives is **only** a per-card language pick (default English) on the catalogue, gated by the tenant
`translations` flag. There is **NO** `users.contentLang`, **NO** access-rule scoping, **NO**
disabled/greyed cross-language cards, **NO** switching/grandfather logic anywhere in this build.

## Data model

Ground-truth shapes are in `convex/schema.ts` / `convex/lib.ts` today; the deltas below are the whole
change surface. **Read [ADR 0023 draft](adr-0023-draft-self-enroll-access-primitive.md)** for the
enrollment rationale (it graduates to `docs/adr/0023-*.md` at build start, per issue 09).

### New table — `enrollments` (ticket 01 / ADR 0023)

```ts
// convex/schema.ts — new table
enrollments: defineTable({
  userId: v.id("users"),
  topicId: v.id("topics"),
  lang: v.string(),          // the joined Edition's BCP-47 code; "en" = source
})
  .index("by_user", ["userId"])           // "my enrolled courses"
  .index("by_topic", ["topicId"])         // cascade on topic delete
  .index("by_topic_user", ["topicId", "userId"]),  // the resolver's hold check
```

Per-**Edition** `{ userId, topicId, lang }`, matching every other grant's grain. Siblings of the
`entitlements` indexes. A row is written only for a currently-**free**, **published** Edition;
idempotent per `(user, topic, lang)`; **permanent / grandfathered** (a later price keeps existing
enrollees in — the resolver's enrollment check wins regardless of current price).

### Extended — `topics.status` (ticket 03)

```ts
// was: v.optional(v.union("seeded", "active", "completed"))
status: v.optional(v.union(
  v.literal("seeded"), v.literal("active"), v.literal("completed"), v.literal("published"),
)),
```

State machine: `active ──finish──▶ completed ──publish──▶ published`, with `unpublish` (→ `completed`)
and `reopen` (`completed` → `active`). **Adding a union member is a backward-compatible widening — no
data backfill** (existing rows already hold a valid value or `undefined`). *(Corrects the handoff's
loose "migration for existing rows" — only the `selling` flag below needs a real migration.)*

### Extended — `tenants.flags.selling` (ticket 02, default-site rule ticket 04)

```ts
// convex/schema.ts tenantFlagsValidator — a sixth REQUIRED boolean
selling: v.boolean(),   // default false everywhere; opt-in per tenant
```

This is a **required** field added to an object validator that four existing `tenants` rows don't
carry → a real migration: **widen** (`v.optional(v.boolean())`) → **backfill** all rows to `false` →
**narrow** to required, and set `seedTenant` / `scripts/seed-tenants.ts` fixtures to `selling: false`.
`assertTenantFlag` **already** treats `tenantSlug === undefined` as pass (`convex/lib.ts:143`), so
ticket 04's "default-site implicitly on" rule needs no change to that helper — a default-site course
falls straight through to the deployment-wide `sellingEnabled()`.

### No change — `appUrl` signature only (ticket 08)

`appUrl` gains an optional `tenantSlug` param (`convex/payfast.ts:232`). **No schema change**, no new
`tenants` column, no new env var.

### No `users` change

The content-language field died with ticket 07.

## Feature areas

### 1. The `enrolled` access grant (ticket 01 / ADR 0023)

`editionAccessLevel` (`convex/lib.ts:354`) gains one branch returning a distinct **`enrolled`** level,
parallel to `entitled`, treated ≡ `viewer` for access but kept distinct for the "Joined" badge and a
"my enrolled courses" query. `EditionAccess` (`lib.ts:325`) extends to include `"enrolled"`; every
consumer's returns-validator union widens (notably `content.courseHeader.role`, `content.ts:625`).
`heldLangs` (`lib.ts:245`) and `getViewableTopic` (`lib.ts:170`) union in enrolled languages so an
enrollee reads their Edition, tracks their own progress, and earns a certificate exactly like a
Viewer. The paid and shared read paths are untouched — enrollment is purely additive.

### 2. Publish lifecycle (ticket 03)

`publishCourse` / `unpublishCourse` — **owner-only** mutations flipping `completed ↔ published`
(siblings of `endCourse` / `reopenCourse`, `convex/content.ts:584`). Publish is a **pure status flip,
orthogonal to price**: a free course = `published` + zero listings; a priced/mixed course =
`published` + ≥1 `listings` row. The Routine's authoring gate (which today refuses `completed`,
`routine.ts`) must **also refuse `published`** (content stays frozen). Publish is **catalogue
visibility only, not an acquisition gate**: self-enroll requires `published`, but **`startCheckout`
stays un-gated on publish** (a priced Edition is buyable via direct link whether or not it's listed).
`courseHeader.status` union widens to include `published`.

> **Implementation call to make in issue 10:** `setEditionPrice` today requires `status === "completed"`
> (`market.ts:57`). Ticket 03's sequence is "price while `completed`, then publish", but that would
> strand an owner who wants to add a price to an already-published mixed course (forcing an
> unpublish→price→republish dance). The lazy, decision-consistent choice: **widen that gate to accept
> `completed | published`** (both are content-frozen). Flag it in the issue; don't silently narrow.

### 3. Per-tenant `selling` flag (ticket 02 / 04)

`selling` gates both money mutations at the boundary, composed with (not replacing) `sellingEnabled()`:
`assertTenantFlag(ctx, topic.tenantSlug, "selling")` inside **`setEditionPrice`** (`market.ts:39`) and
**`startCheckout`** (`market.ts:386`). Flag-off is **frozen, not revoked**: the `listings` row
persists, existing entitlements keep access, the Edition becomes unbuyable, and `clearEditionPrice`
(`market.ts:83`) stays **un-gated** so an owner can always drop a stuck price to free. Default-site
courses (absent `tenantSlug`) satisfy the gate and defer to `sellingEnabled()` (ticket 04, option A).

### 4. The catalogue surface (tickets 04, 05, 07)

A member-facing **"Browse courses"** route in the authed chrome. Server query (`convex/catalogue.ts`,
new) lists **published** topics carrying the viewer's own tenant scope — **symmetric**: a subdomain
member sees `tenantSlug === <their slug>`; a default-site member sees `tenantSlug` **absent** only —
**never** a cross-tenant firehose. Each card returns: title + source-language 2-line mission, a single
**state badge** (Free · price · **Joined** · **Purchased** · Owned), **language chips**, a **progress
bar** (joined/owned only), and the primary **affordance**: **Join now** (free → the ticket-01 enroll
mutation) · **Buy · R{price}** (priced → `startCheckout`) · **Continue/Open** (held). A **filter chip
row** (All / Free / Premium / My courses) filters the loaded list client-side. Layout: one responsive
grid (`sm:grid-cols-2 lg:grid-cols-3`) at dashboard-parity density, reusing the existing `CourseCard`
shell. Empty state: a centred "Nothing published yet." card.

**Language pick (ticket 07):** when the tenant `translations` flag is **on** and the course has > 1
Edition, a compact language selector (globe, native names from `convex/languages.ts` `LANGUAGES`,
**English default/first**) sits **beside** Join/Buy; the action acquires the **selected** Edition.
Flag **off** ⟹ no selector, English-only one-click Join. **No disabled/greyed cross-language cards.**

### 5. Self-enroll mutation (ticket 01 / 03 / 07)

`enroll` (or `catalogue.join`) writes one `enrollments` row `{ userId, topicId, lang }`, idempotent
per `(user, topic, lang)`. Creation-side guards: the topic is **`published`**, the chosen Edition is
**free** (`editionPrice === null`), the Edition is one the course actually holds (source or a ready
translation), and — when the caller picked a non-English language — the tenant `translations` flag is
on. Re-Join in another language is just another idempotent call → an additive per-Edition grant.

### 6. Tenant-domain link generation (ticket 08)

Extend the pure `appUrl(path, tenantSlug?)` (`payfast.ts:232`): derive origin `https://<slug>.<base>`
where `base` = `SITE_URL`'s host minus a leading `www` (a ~2-line pure derive inside `appUrl` — do
**not** import Next's `canonicalRedirect` across the runtime boundary). Run the existing same-origin
open-redirect guard against **that** resolved origin; because `tenantSlug` is a trusted topic column
(never client input), the trusted set is implicitly `{ SITE_URL } ∪ { <slug>.<base> × 4 }` — no
allow-list. Route **`startCheckout`'s `return_url`/`cancel_url`** (`market.ts:432-433`) and
**`scheduleInvite`'s deep-links** (`shares.ts:16-41`) through it, passing `topic.tenantSlug`. **Retire
`APP_BASE_URL` onto `SITE_URL`** (`convex/env.ts`, `shares.ts:21`, provisioning). Unchanged: `notify_url`
stays `CONVEX_SITE_URL`; public/share links stay client-side on `window.location.origin`; a
`localhost` `SITE_URL` keeps its value verbatim (no dev-subdomain machinery).

> **Migration gotcha (issue 12):** after consolidation, invite links flow through `appUrl`, which
> **throws when `SITE_URL` is unset**. Tests exercising `scheduleInvite` that today rely on
> `APP_BASE_URL` being absent (→ relative links) must provision `SITE_URL`.

## Acceptance criteria (v1 done when…)

- An owner can publish a `completed` course and unpublish it; a `seeded`/`active` course can't be
  published; a non-owner can't publish. The Routine never authors a `published` course.
- A member sees only their tenant's published courses in "Browse courses" (subdomain → own slug;
  default site → slug-absent); never another tenant's.
- Joining a free published course is one click, writes exactly one `enrollments` row (idempotent on
  repeat), and the learner immediately reads the joined Edition with their own progress — verified via
  a direct resolver/mutation call, not just the UI.
- Pricing a formerly-free Edition leaves already-enrolled learners with full access; only new free
  joins stop.
- With the tenant `selling` flag **off**, `setEditionPrice` and `startCheckout` both throw for that
  tenant's courses while `clearEditionPrice` still works and existing entitlements keep access;
  default-site courses sell whenever `sellingEnabled()` is true regardless of any flag.
- With the tenant `translations` flag **on** and a multi-Edition course, the catalogue card shows a
  language selector (English default) and Join/Buy acquires the selected Edition; with it **off**, no
  selector and English-only Join. Every published course is joinable in ≥ English (no locked cards).
- A tenant course's checkout return/cancel and invite links resolve on `<slug>.<base>`; a default-site
  course's stay on `SITE_URL`; the open-redirect guard still discards off-origin return paths.
- None of the above changes behaviour for `my-course.app` or for `tenantSlug`-absent content, and the
  existing owner/Share/entitlement/public-link read paths are untouched.

## Implementation issues

Local issues in this directory, continuing the map's numbering (mirrors how the whitelabel map put its
implementation issues in the same dir after its decision tickets). Built `/tdd` + `/ponytail`. Rough
dependency order (issues within a phase may parallelize):

| # | Issue | Depends on |
|---|---|---|
| 09 | [Enrollments table & the `enrolled` grant](09-enrollments-and-enrolled-grant.md) | — |
| 10 | [Publish lifecycle (`topics.status`)](10-publish-lifecycle.md) | — |
| 11 | [Per-tenant `selling` flag](11-per-tenant-selling-flag.md) | — |
| 12 | [Tenant-domain link generation](12-tenant-domain-links.md) | — |
| 13 | [Self-enroll mutation](13-self-enroll-mutation.md) | 09, 10 |
| 14 | [Catalogue query](14-catalogue-query.md) | 09, 10, 11, 13 |
| 15 | [Catalogue surface ("Browse courses")](15-catalogue-surface.md) | 13, 14 |
| 16 | [Surface enrolled courses on the dashboard](16-enrolled-on-dashboard.md) | 09 |

Issues 09–12 are independent foundations (schema + server primitives) and can be built in parallel.
13 composes the enroll grant with the publish gate; 14 reads all four primitives into the catalogue
query; 15 is the UI. **16 is the one safe-to-defer issue** — ADR 0023 calls the "my enrolled courses"
query *future*, and the catalogue's own "My courses" filter already makes a joined course reachable;
16 only closes the loop so a joined course also appears on the dashboard home like a shared/purchased
one.
