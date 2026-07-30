---
type: task
blocked_by: [13, 14]
---

# Catalogue surface ("Browse courses")

## Question

The member-facing browse surface that makes self-enroll meaningful — a member must *see* a course they
don't yet have before they can join it. The design is locked (Variant A "flat grid + filters", judged
with the user; the prototype was deleted). Build it from [issue 14](14-catalogue-query.md)'s query and
[issue 13](13-self-enroll-mutation.md)'s Join. Ground truth: [ticket 05](05-tenant-catalogue-surface.md),
[ticket 07](07-language-scoped-access.md).

Scope — a new member route **"Browse courses"** inside the real authed chrome (`AppGate`, `bg-paper`),
reached from the dashboard/nav (a "Browse courses" link; a "← My courses" back link; tenant-name
eyebrow + "Browse courses" title):
- **Layout:** one responsive card grid (`sm:grid-cols-2 lg:grid-cols-3`) at dashboard-parity density,
  **reusing the existing `CourseCard` shell/tokens**; above it a **filter chip row** (All / Free /
  Premium / My courses) — client-side filter over the loaded list.
- **The card:** title + single **state badge** (Free · R{price} · Joined · Purchased; Owned uses the
  existing owner treatment); 2-line mission clamp; language chips; progress bar for
  joined/owned/purchased only; primary **affordance pinned at bottom**: Free → **"Join now"** (calls
  issue-13 `enroll`, flips to Joined→"Continue" on success); Priced → **"Buy · R{price}"**
  (`startCheckout`; render **disabled** when the query's `buyable` is false); Joined → "Continue",
  Owned/Purchased → "Open".
- **Language pick (ticket 07):** when `translationsOn` **and** the course has > 1 Edition, a compact
  language selector (globe, native names, **English default/first**) beside Join/Buy targeting the
  selected Edition; `translationsOn` false ⟹ no selector, English-only Join. **No disabled/greyed
  cross-language cards.**
- **Empty / fallback:** a centred "Nothing published yet" card.
- **Landing after Join:** land on the joined course, or flip the card in place — pick the lazy path.

**Deferred (NOT this build):** the language selector localizing the card's own title + mission (the
query returns source-language text only).

Tests (write first where logic lives): filter chips partition the list correctly; affordance maps to
state (Free→Join, priced→Buy, joined→Continue, owned/purchased→Open), Buy disabled when `buyable`
false; language selector renders only when `translationsOn && editions.length > 1`, English
preselected, Join targets the selected Edition; empty state renders on no results.

## Done when

The route renders the grid + filters + cards in the authed chrome, reusing `CourseCard`; Join is one
click and reflects immediately; Buy routes to `startCheckout`; Continue/Open navigate; the language
control and empty state behave per ticket 05/07; no locked cards; title/mission stay source-language.

## Answer

Shipped, but **as a section, not a route** (build 2026-07-28; decision of record
`docs/adr/0024-publish-at-the-edition-grain.md`). The catalogue landed as an **available-courses
section on the signed-in home** — no new "Browse courses" route, no public catalogue, no landing-page
change. It reads from [issue 14](14-catalogue-query.md)'s host-scoped `catalogue.list`. Because a free
published Edition reads ≡ a Viewer with no join click ([issue 13](13-self-enroll-mutation.md)), the
card carries **one action (Open)**; a priced Edition lands on its existing Preview + paygate, so there
is no second checkout path from the card. **No filter chips and no per-card language selector** shipped.
The symmetric tenant scope and "no locked cards / source-language title+mission" invariants hold.

**End of the member-facing build.** [Issue 16](16-enrolled-on-dashboard.md) was the loop-closer on the
dashboard home.
