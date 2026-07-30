---
type: prototype
blocked_by: [03, 04, 07]
---

# The catalogue surface

## Question

The member-facing browse surface — the thing that makes self-enroll meaningful (a member must *see* a
course they don't yet have access to before they can join it). Blocked by
[ticket 03](03-define-publish-action.md) (what "published" means → what the catalogue lists) and
[ticket 04](04-default-site-vs-tenant-scope.md) (whether it exists on the default site too). Use
`/prototype` to raise fidelity on the layout/behaviour question, then decide:

1. **Where it lives** — a new member-facing route/tab? How a member reaches it.
2. **What it lists** — published courses carrying the member's `tenantSlug` (ticket 04's scope); free
   vs priced affordances; how already-enrolled / owned / purchased courses appear (hidden? marked
   "joined"?). Cross-language handling per [ticket 07](07-language-scoped-access.md).
3. **The join affordance** — the one-click self-enroll for free courses (ticket-01 grant) and the buy
   affordance for priced ones (existing `startCheckout`), and where the learner lands after joining.
4. **Empty / fallback states** — a tenant with nothing published yet.

Per `/prototype` conventions: mount throwaway variants on the real route with mock data, judge, then
delete.

## Done when

A concrete surface design (layout, card contents, affordances, language control, empty state) is
chosen with the user via `/prototype`, captured as the durable asset for ticket 06 to spec, and the
throwaway prototype deleted.

## Answer

Resolved 2026-07-19. Built a throwaway `/prototype` (three structurally-different variants on a real
auth-gated route, `?variant=A|B|C` + `?empty=1`, mock data) and judged with the user. Ticket 07
resolved mid-session and dropped its disabled-card premise, so the prototype rendered the
fully-resolved model — no stubs.

**Winner: Variant A — "Flat grid + filters."** (*"A is awesome."*) The prototype route was deleted per
`/prototype` convention; the chosen design is the durable asset here.

The surface ticket 06 should spec:

1. **Where** — a new member-facing catalogue route reached from the dashboard/nav ("Browse courses"),
   inside the real authed chrome (`bg-paper`, `AppGate`); header = tenant-name eyebrow + "Browse
   courses" + "← My courses" back link.
2. **Layout** — **one responsive card grid** (`sm:grid-cols-2 lg:grid-cols-3`) at dashboard-parity
   density (reuse `CourseCard`), above it a **filter chip row**: All / Free / Premium / My courses
   (client-side filter).
3. **The card** — title + single **state badge** (Free · price · **Joined** · **Purchased**), a
   2-line mission clamp, **language chips**, a **progress bar for joined/owned only**, and the primary
   **affordance pinned at bottom**: Free → **"Join now"** (one-click ticket-01 enroll); Priced →
   **"Buy · R{price}"** (`startCheckout`); Joined → **"Continue"**, Owned → **"Open"**.
4. **Language pick (ticket 07)** — when the tenant `translations` flag is **on** and the course has
   **> 1 Edition**, a compact language selector (globe, native names, **English default**) beside
   Join/Buy; the action acquires the selected Edition. Flag off ⟹ no selector, English-only Join. **No
   disabled/greyed cross-language cards** — every published course joinable in ≥ English.
5. **Empty / fallback** — a centred "Nothing published yet" card.

**Future enhancement (explicitly deferred — NOT this build):** the per-card language selector should
also localize the card's own **title + mission** (not just the target Edition). Needs translated
title/mission surfaced per Edition; the query returns only source-language text today. Fold into the
chrome/app-UI i18n effort. *(Later absorbed into the Chrome i18n map as `app-language-i18n/06`; a
subsequent ticket-06 pass on 2026-07-20 specced this deferral as built — a card's title/mission ride
the app-language with the per-card selector overriding both text and Join/Buy target, English source
fallback.)*
