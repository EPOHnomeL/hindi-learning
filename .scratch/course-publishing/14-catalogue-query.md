# course-publishing/14: Catalogue query

**Status:** ready-for-agent
**Depends on:** 09, 10, 11, 13
**Labels:** ready-for-agent
**Loop:** `/tdd` (test-first) + `/ponytail`

Child of [Course-publishing PRD](PRD.md). Ground truth: [ticket 04](04-default-site-vs-tenant-scope.md)
(scope), [ticket 05](05-tenant-catalogue-surface.md) (card contents), [ticket 07](07-language-scoped-access.md)
(language pick).

## Why

The server read behind "Browse courses": the list of published courses a member may see, each with the
per-card state the surface ([issue 15](15-catalogue-surface.md)) renders. The surface is client-side
filtering over this one query.

## Scope

A query — `catalogue.list` (new `convex/catalogue.ts`) — for the signed-in member:

- **Scope (symmetric, ticket 04):** resolve the viewer's tenant. Take the tenant slug **from the
  request** (the same host→slug arg the app already threads to Convex for skin/flags — a **subdomain**
  member's slug, or **absent** for a default-site member), not from the viewer's own `users.tenantSlug`.
  Skin follows the host. List topics where `topic.tenantSlug === <slug>` via the `by_tenant` index;
  for the default site (`slug` absent) list **`tenantSlug`-absent** topics only. **Never** cross-tenant.
- **Filter to published:** only `status === "published"` topics (drop the rest in the query).
- **Per card**, return:
  - `title` + `mission` — **source-language only** (do NOT localize per the picked language; that's
    the deferred follow-up, ticket 05). 2-line clamp is the client's job.
  - `slug` (for deep-links / affordance targets).
  - **State** for the badge/affordance, computed from the caller's grants across the course's Editions:
    `owned` (caller is owner) · `purchased` (holds an entitlement) · `joined` (holds an enrollment) ·
    else the acquisition state per Edition: **free** vs **priced** (with `amount`/`currency` from
    `listings`). A mixed course exposes both a price and free Editions — return enough for the card to
    show the primary badge (ticket 05's precedence: held states win, else Free/price).
  - **Editions** — the languages the course offers (source + ready translations), as
    `{ lang, name, native, rtl }` from `convex/languages.ts` `LANGUAGES`, English first — feeds the
    language chips **and** the language selector.
  - **Progress** — completed/total lesson counts **only for joined/owned/purchased** courses (reuse
    `topicLessonCounts` / the dashboard's progress logic); omit for not-yet-held courses.
  - **`buyable`** — whether the priced affordance should be live: the tenant `selling` flag (issue 11)
    composed with `sellingEnabled()`. A frozen listing on a `selling: false` tenant shows the price but
    a non-live Buy (the card can render it disabled rather than let `startCheckout` throw). Keep it a
    boolean; don't re-implement the gate.
  - **`translationsOn`** — the tenant `translations` flag, so the client knows whether to render the
    per-card language selector (ticket 07). One read; can be returned once at the top level, not per card.
- **Reuse, don't reinvent:** model the card shape on the existing dashboard/`myPurchases`
  (`market.ts:120`) and `shares.listSharedTopics` queries — same `langs`/progress shape — so
  [issue 15](15-catalogue-surface.md) can reuse the `CourseCard` shell.

## Tests (write first)

- A subdomain member sees only that slug's published courses; a default-site member sees only
  `tenantSlug`-absent published courses; neither sees the other's or a non-published course.
- State: owned/purchased/joined/free/priced each resolve to the right badge input; a mixed course
  returns both a price and its free Editions.
- Progress present for held courses, absent otherwise.
- `buyable` false when the tenant `selling` flag is off (price still shown); `translationsOn` reflects
  the flag.
- Editions list English-first with native names.

## Acceptance criteria

- Typecheck / codegen clean; reads are indexed (`by_tenant`, `by_topic_*`) — no full scans.
- All scope + state + progress tests pass.

**Unblocks:** 15.

## Comments

**2026-07-28 — the Scope warning above was overridden in the build, then restored.** `catalogue.list`
shipped scoping on `users.tenantSlug`, exactly what this ticket said not to do. It was empty in
production for every member (nothing writes that field — `auth.ts` inserts `{ email }` alone), so a
tenant member browsing `<slug>.my-course.app` saw no catalogue at all. Now back to this ticket's
design: the slug comes from the host, threaded as a `catalogue.list` argument via `useTenantSlug()`.
The tests missed it because they seeded `users` rows *with* a `tenantSlug` — a shape production can't
produce. ADR 0024 §6 carries the amendment.
