# course-publishing/05: The catalogue surface

**Status:** done (2026-07-19, `/prototype` — variant judged with the user)
**Resolved:** session 92134b96 (2026-07-19)
**Depends on:** 03, 04, 07
**Labels:** wayfinder:prototype

Child of [Course publishing map](00-course-publishing-map.md).

## Question

The member-facing browse surface — the thing that makes self-enroll meaningful (a member must *see* a
course they don't yet have access to before they can join it). Blocked by
[ticket 03](03-define-publish-action.md) (what "published" means → what the catalogue lists) and
[ticket 04](04-default-site-vs-tenant-scope.md) (whether it exists on the default site too). Use
`/prototype` to raise fidelity on the layout/behaviour question, then decide:

1. **Where it lives** — a new member-facing route/tab? How a member reaches it (nav, home).
2. **What it lists** — published courses carrying the member's `tenantSlug` (per ticket 04's scope
   decision); free vs priced affordances (join now vs. price + buy); how already-enrolled / owned /
   purchased courses appear (hidden? marked "joined"?). **Cross-language courses show *disabled***
   per [ticket 07](07-language-scoped-access.md) when the tenant `translations` flag is on.
3. **The join affordance** — the one-click self-enroll for free courses (writing the ticket-01
   grant) and the buy affordance for priced ones (existing `startCheckout`), and where the learner
   lands after joining.
4. **Empty / fallback states** — a tenant with nothing published yet.

Per `/prototype` conventions: mount throwaway variants on the real route with mock data, judge, then
delete. Link the prototype as an asset. Resolve, comment, close, add a Decisions-so-far line to the
map.

## Resolution (2026-07-19)

Built a throwaway `/prototype` (three structurally-different variants on a real auth-gated route,
`?variant=A|B|C` + `?empty=1`, mock data) and judged with the user. **Ticket 07 resolved mid-session**
and dropped its disabled-card premise, so the prototype rendered the *fully-resolved* model — no stubs.

**Winner: Variant A — "Flat grid + filters."** The user: *"A is awesome."* The prototype (route
`src/app/(app)/catalogue-prototype/` + `PrototypeSwitcher.tsx`) has been **deleted** per `/prototype`
convention; the chosen design is captured here as the durable asset for the PRD to build from.

### The chosen surface — what ticket 06 should spec

1. **Where it lives** — a new member-facing catalogue route, reached from the dashboard/nav
   ("Browse courses"). Renders inside the real authed app chrome (`bg-paper`, `AppGate`). Header:
   tenant name eyebrow + "Browse courses" + a "← My courses" back link.
2. **Layout** — **one responsive card grid** (`sm:grid-cols-2 lg:grid-cols-3`) at **dashboard-parity
   density** (reuse the existing `CourseCard` shell/tokens), above it a **filter chip row**:
   **All / Free / Premium / My courses** (client-side filter over the loaded list).
3. **The card** — title + a single **state badge** (Free · price · **Joined** · **Purchased**), a
   2-line mission clamp, **language chips**, a **progress bar for joined/owned only**, and the primary
   **affordance pinned at the bottom**:
   - **Free → "Join now"** (accent2/green) = one-click self-enroll, writes the ticket-01 `enrollments`
     grant for the selected Edition.
   - **Priced → "Buy · R{price}"** (gold) = existing `startCheckout` (ADR 0016) for the selected Edition.
   - **Joined → "Continue"**, **Owned → "Open"** (accent) → into the course.
4. **Language pick (ticket 07)** — when the tenant `translations` flag is **on** and the course has
   **> 1 Edition**, a **compact language selector** (globe icon, native names, **English default**) sits
   **beside** the Join/Buy action; the action acquires the **selected** Edition. Flag **off** ⟹ no
   selector, English-only one-click Join. **No disabled/greyed cross-language cards** (07 killed that) —
   every published course is joinable in ≥ English.
5. **Empty / fallback** — a centred "Nothing published yet" card ("When {tenant} publishes a course,
   it'll appear here…").

### Future enhancement (explicitly deferred — NOT this build; user, 2026-07-19)

Changing the per-card **language selector should also localize the card's own title + mission** into
the selected language (not just which Edition Join/Buy targets). Deferred: needs translated
title/mission surfaced per Edition; the catalogue query returns only the source-language title/mission
today. Fold into the chrome/app-UI i18n effort or a follow-up — **do not build now.**

> **Absorbed (2026-07-19):** this deferred item now lives in the chrome-i18n effort as
> [`app-language-i18n/06` — Catalogue localisation spec](../app-language-i18n/issues/06-catalogue-localisation-spec.md)
> (child of the [Chrome i18n map](../app-language-i18n/issues/00-app-language-i18n-map.md)). Tracked there, not here.
