# course-publishing/15: Catalogue surface ("Browse courses")

**Status:** ready-for-agent
**Depends on:** 13, 14
**Labels:** ready-for-agent
**Loop:** `/tdd` (test-first for logic) + `/ponytail`

Child of [Course-publishing PRD](PRD.md). Ground truth: [ticket 05](05-tenant-catalogue-surface.md)
(the chosen surface — Variant A, judged with the user; the prototype was deleted), [ticket 07](07-language-scoped-access.md)
(the language control).

## Why

The member-facing browse surface that makes self-enroll meaningful — a member must *see* a course they
don't yet have before they can join it. The design is locked (Variant A "flat grid + filters"); this
issue builds it from [issue 14](14-catalogue-query.md)'s query and [issue 13](13-self-enroll-mutation.md)'s
Join.

## Scope

A new member route — **"Browse courses"** — inside the real authed app chrome (`AppGate`, `bg-paper`),
reached from the dashboard/nav (a "Browse courses" link; a "← My courses" back link in the header;
tenant-name eyebrow + "Browse courses" title).

- **Layout:** one responsive card grid (`sm:grid-cols-2 lg:grid-cols-3`) at **dashboard-parity
  density**, **reusing the existing `CourseCard` shell/tokens**. Above it, a **filter chip row**:
  **All / Free / Premium / My courses** — client-side filter over the loaded list (no extra queries).
- **The card** — reuse `CourseCard`, add the catalogue affordances:
  - title + a single **state badge**: **Free** · **R{price}** · **Joined** · **Purchased** (Owned uses
    the existing owner treatment).
  - 2-line **mission** clamp, **language chips**, and a **progress bar** for joined/owned/purchased only.
  - the primary **affordance pinned at the bottom**:
    - **Free → "Join now"** (accent2/green) — calls [issue 13](13-self-enroll-mutation.md)'s `enroll`
      for the **selected** Edition; on success the card flips to **Joined → "Continue"**.
    - **Priced → "Buy · R{price}"** (gold) — calls existing `startCheckout` for the selected Edition;
      render **disabled** when the query's `buyable` is false (frozen listing on a non-selling tenant).
    - **Joined → "Continue"**, **Owned/Purchased → "Open"** (accent) — navigate into the course.
- **Language pick (ticket 07):** when `translationsOn` (from issue 14) **and** the course has > 1
  Edition, a **compact language selector** (globe icon, native names from `LANGUAGES`, **English
  default/first**) sits **beside** the Join/Buy action; the action targets the **selected** Edition.
  `translationsOn` false ⟹ **no selector**, English-only one-click Join. **No disabled/greyed
  cross-language cards** — every published course is joinable in ≥ English.
- **Empty / fallback:** a centred **"Nothing published yet"** card ("When {tenant} publishes a course,
  it'll appear here…").
- **Landing after Join:** the learner lands on the joined course (Continue into the reader), or the
  card flips to Joined in place — pick the lazy path that reuses existing navigation.

**Deferred (NOT this build, ticket 05):** the language selector localizing the card's own
**title + mission** — the query returns source-language text only. Do not build.

## Tests (write first where logic lives)

- Filter chips partition the loaded list correctly (All / Free / Premium / My courses).
- The affordance maps to state (Free→Join, priced→Buy, joined→Continue, owned/purchased→Open); Buy
  disabled when `buyable` false.
- Language selector renders only when `translationsOn && editions.length > 1`, English preselected;
  Join targets the selected Edition.
- Empty state renders when the query returns nothing.
- (Component-test depth per repo convention — mirror how the dashboard/`CourseCard` are tested.)

## Acceptance criteria

- The route renders the grid + filters + cards in the authed chrome; reuses `CourseCard`.
- Join is one click and reflects immediately; Buy routes to `startCheckout`; Continue/Open navigate.
- The language control and empty state behave per ticket 05/07; no locked cards; title/mission stay
  source-language.

**End of the member-facing build.** [Issue 16](16-enrolled-on-dashboard.md) closes the loop on the
dashboard home.
