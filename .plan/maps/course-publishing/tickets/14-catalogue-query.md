---
type: task
blocked_by: [09, 10, 11, 13]
---

# Catalogue query

## Question

The server read behind "Browse courses": the list of published courses a member may see, each with the
per-card state the surface ([issue 15](15-catalogue-surface.md)) renders. The surface is client-side
filtering over this one query. Ground truth: [ticket 04](04-default-site-vs-tenant-scope.md) (scope),
[ticket 05](05-tenant-catalogue-surface.md) (card contents), [ticket 07](07-language-scoped-access.md)
(language pick).

Scope — a query `catalogue.list` (new `convex/catalogue.ts`) for the signed-in member:
- **Scope (symmetric, ticket 04):** resolve the viewer's tenant. Take the tenant slug **from the
  request** (the same host→slug arg the app already threads to Convex — a subdomain member's slug, or
  absent for a default-site member), **not** from `users.tenantSlug`. List `topic.tenantSlug === <slug>`
  via `by_tenant`; for the default site (slug absent) list **`tenantSlug`-absent** topics only. Never
  cross-tenant.
- **Filter to published:** only `status === "published"` topics.
- **Per card:** `title` + `mission` (**source-language only** — no per-language localization; that's
  the deferred ticket-05 follow-up); `slug`; **State** for the badge/affordance computed from the
  caller's grants (`owned` · `purchased` · `joined` · else per-Edition `free` vs `priced` with
  `amount`/`currency`); **Editions** as `{ lang, name, native, rtl }` from `convex/languages.ts`
  `LANGUAGES`, English first; **Progress** (completed/total) only for held courses; **`buyable`** — the
  tenant `selling` flag (issue 11) composed with `sellingEnabled()`, a boolean (don't re-implement the
  gate); **`translationsOn`** — the tenant `translations` flag, returned once at top level.
- **Reuse:** model the card shape on `market.myPurchases` (`market.ts:120`) / `shares.listSharedTopics`.

Tests (write first): a subdomain member sees only that slug's published courses; a default-site member
only `tenantSlug`-absent published; neither sees the other's or a non-published course; state
resolves right (mixed course returns both a price and its free Editions); progress present for held,
absent otherwise; `buyable` false when `selling` off (price still shown); `translationsOn` reflects
the flag; Editions English-first with native names.

## Done when

Typecheck / codegen clean; reads are indexed (`by_tenant`, `by_topic_*`) — no full scans; all scope +
state + progress tests pass.

## Answer

Shipped (build 2026-07-28; `docs/adr/0024-publish-at-the-edition-grain.md`) — **`catalogue.list`
landed, and this ticket's Scope design is the one that stands.** It initially shipped scoping on
`users.tenantSlug` (exactly what this ticket warned against). That was **broken in production**:
nothing writes `users.tenantSlug` (`auth.ts` inserts `{ email }` alone), so every real member browsing
`<slug>.my-course.app` saw an empty catalogue; the tests missed it because they seeded `users` rows
*with* a `tenantSlug` — a shape production can't produce. **Reverted 2026-07-28** back to this ticket's
design: the slug comes from the **host**, threaded as a `catalogue.list` argument via
`useTenantSlug()`, same symmetry (subdomain → own slug; default site → untenanted only). ADR 0024 §6
carries the amendment. *(The surrounding surface landed as a section on the signed-in home rather than
a "Browse courses" route — see [issue 15](15-catalogue-surface.md).)*

**Unblocks:** 15.
