# PRD: URL-addressable navigation (App Router routing)

Status: ready-for-agent

> Vocabulary follows [`CONTEXT.md`](../../CONTEXT.md) — **Topic** (a "course" in
> user-facing language), **Lesson**, **Reference**, **Frontier**, **Share**,
> **Viewer**. The foundational choices are recorded in
> [ADR 0012](../../docs/adr/0012-app-router-url-addressable-navigation.md); this
> PRD is the spec for building them.

## Problem Statement

The whole app lives at one URL. A learner can't link to a Lesson, can't bookmark
a course, and the browser back button does nothing useful — selecting a Lesson
or opening a course only flips local React state (`Dashboard` toggles the course
grid against the Reader via `openSlug`; the Reader picks a Lesson via
`selected`). Nothing reaches the address bar. This bites hardest on **Share**: an
owner shares a Topic, but the Viewer lands on a bare dashboard with no way to be
pointed at the actual course — and there's no URL at all to hang an anonymous,
read-only link share on.

## Solution

Give the navigational views **real URLs** using the Next.js App Router, so the
address bar always names what's on screen and browser history works:

- `/` — the dashboard (the owner's course grid + "Shared with me").
- `/courses/[slug]` — a course; redirects to its first Lesson.
- `/courses/[slug]/lessons/[key]` — a specific Lesson.
- `/courses/[slug]/references/[key]` — a specific Reference.

A learner can deep-link and bookmark any Lesson, use back/forward to move between
the dashboard, a course, and its Lessons, and a Viewer can be sent straight to a
shared course. The URL — not React state — becomes the source of truth for what's
displayed. Data stays on live Convex `useQuery` subscriptions, so the read-only
and reactive behaviour is unchanged; only *where the current selection lives*
moves, from `useState` to the URL.

This also reserves an **ungated public route** (`/share/[token]`) outside the
authenticated area, the seam the future anonymous link-share feature
(`.scratch/topic-sharing/issues/07`) will fill — but that route ships here only
as a shell; its token-authorized data path is out of scope.

## User Stories

### Deep links & history
1. As a learner, I want each Lesson to have its own URL, so that I can bookmark or share a direct link to it.
2. As a learner, I want each Reference to have its own URL, so that I can return to a cheat-sheet directly.
3. As a learner, I want each course to have its own URL, so that I can bookmark a course I'm working through.
4. As a learner, I want the back button to take me from a Lesson back to the dashboard, so that browser navigation behaves as I expect.
5. As a learner, I want forward/back to move between Lessons I've visited, so that history reflects my path.
6. As a learner, I want opening a Lesson to update the address bar, so that the URL always names what I'm looking at.
7. As a learner, I want to reload the page on a Lesson and stay on that Lesson, so that a refresh doesn't dump me back to the start.

### Course → Lesson navigation
8. As a learner, I want opening a course to take me to its first Lesson automatically, so that I never land on a blank pane.
9. As a learner, I want the course sidebar (Lessons, References, Resources) to stay put as I move between Lessons, so that navigation feels instant and nothing flickers.
10. As a learner, I want selecting a Lesson from the sidebar to change only the reading pane, so that the chrome doesn't reload.
11. As a learner, I want "Back to courses" to return me to the dashboard, so that I can switch courses.
12. As a learner on mobile, I want selecting a Lesson from the drawer to navigate and close the drawer, so that the flow matches today's behaviour.
13. As a learner, I want the "completed" ticks and the teacher's-reply notification dots in the sidebar to stay correct as I navigate, so that the nav still reflects my Progress and unread Replies.
14. As a learner, I want opening a Lesson with an unseen Reply to clear its notification dot, so that the dot behaviour survives the move to routing.

### Sharing & deep-link entry
15. As an owner, I want to send a Viewer the URL of a shared course, so that they open straight into it instead of a bare dashboard.
16. As a Viewer, I want a shared-course URL to open the same read-only Reader, so that I get the experience the Share already grants me.
17. As an admin, I want an ungated public route to exist at a reserved path, so that anonymous read-only link shares can later be served there without reworking the auth gate.

### Auth at the URL
18. As a signed-out learner, I want opening any deep link to show me sign-in at that URL, so that after signing in I land exactly where the link pointed — no redirect detour.
19. As a learner, I want signing in from a deep link to drop me on that Lesson, so that shared links "just work."
20. As a learner, I want signing out from anywhere to return me to the dashboard root (showing sign-in), so that I'm never stranded on a deep URL I can no longer read.
21. As a learner, I want "back" after signing out **not** to return me to the page I was reading, so that sign-out is clean.

### Creating & not-found
22. As a learner, I want creating a new course to take me straight into it, so that I can immediately add Resources — matching today's flow.
23. As a learner, I want a URL for a course that doesn't exist (or that I can't access) to show a "not found" page, so that bad or stale links fail clearly.
24. As a learner, I want a URL for a Lesson key that isn't in the course to show "not found," so that a removed or mistyped Lesson link doesn't silently send me elsewhere.
25. As a learner, I want a private course I'm not allowed to see to look identical to one that doesn't exist, so that the app never reveals which private courses exist.
26. As a learner, I want a Lesson URL to show a loading state while data is in flight (not a flash of "not found"), so that slow loads don't look like errors.

## Implementation Decisions

- **Route tree mirrors the domain hierarchy** (ADR 0012): `/` (dashboard) →
  `/courses/[slug]` → `/courses/[slug]/lessons/[key]` and
  `/courses/[slug]/references/[key]`. The `/courses` prefix keeps the top-level
  namespace open for later routes (`/settings`, `/admin`).
- **`key` identifies a Lesson/Reference in the URL**, never `seq`. `key` is
  unique-per-Topic, immutable, already the schema and client primary identifier,
  and survives supersession; `seq` stays a display-only ordinal (the "3." prefix
  in the nav). References have no `seq`.
- **Two route groups.** An authenticated `(app)` group holds `/` and
  `/courses/**`, wrapped by a single layout that gates with the existing
  `AuthLoading` / `Unauthenticated` (rendering `<SignIn>` inline) / `Authenticated`
  trio — so an unauthenticated deep link renders sign-in *at that URL* and
  re-renders into the content after login, with no redirect plumbing. A separate
  **ungated** route (`/share/[token]`) lives outside `(app)` as a shell only.
  The Convex Auth middleware is unchanged (session-sync; it does not block).
- **The course sidebar becomes `layout.tsx`** for `/courses/[slug]`, staying
  mounted across Lesson navigation; the artifact pane becomes the `page`. The
  course layout fetches the per-course queries (Lessons, References, Progress,
  Questions, the Topic row) **once**.
- **A course-scoped context provider** in that layout owns the cross-cutting
  `seen` set (localStorage-backed answered-Question ids): the sidebar reads it to
  show notification dots, and the Lesson page calls a `markSeen(lessonKey)` from
  context on open. This keeps `seen` single-sourced and reactive across the
  layout/page boundary.
- **`/courses/[slug]` redirects to its first Lesson** (preserving today's
  auto-select of `lessons[0]`), so the URL always names what's shown. *Which*
  Lesson it lands on stays "first" — resume-at-Frontier/last-opened is out of
  scope.
- **Not-found is uniform.** An unknown or inaccessible course slug, and an unknown
  Lesson/Reference key, both render Next's `not-found` — one 404 for "doesn't
  exist" and "you can't see it" alike, so private Topics don't leak existence. No
  silent fallback to the first Lesson. Because reads come from client `useQuery`
  (which is `undefined` while loading), a route shows its loading state while
  `undefined` and only triggers not-found once the query resolves empty.
- **Navigation uses `<Link>`; programmatic routing is reserved for post-action
  transitions.** Sidebar items, "Open course," and "Back to courses" are `<Link>`s
  (prefetch is cheap — it loads the shared route chunk, not Convex data). After
  `seedTopic` resolves, `router.push('/courses/[slug]')`; after `signOut`,
  `router.replace('/')` (replace, so back doesn't return to the authed page).
- **Transient UI stays local `useState`** — the card edit/share/new-course panels
  and the mobile drawer get no URL.
- **`Reader` is dismantled** into the course layout + Lesson/Reference pages + the
  course-scoped context; `Dashboard`'s `openSlug` toggle and the Reader's
  `selected` toggle are removed in favour of the URL.

## Testing Decisions

- **No new test seam.** This work adds no Convex function behaviour — it reuses
  the existing owner-or-Viewer reader queries unchanged — and the repo tests at
  the Convex function seam (`convex/content.test.ts`, exercised via `convexTest`
  with `withIdentity`). Routing is frontend structure, which the repo does not
  unit-test.
- **Consistent with repo precedent**, the topic-sharing PRD established that UI
  behaviour is **verified manually** and the correctness that matters is enforced
  server-side. The same applies: deep-linking, back/forward, redirect-to-first-
  Lesson, not-found, sign-in-at-URL, and the notification-dot behaviour are
  checked by hand.
- **Pure helpers, if any, follow `lessonSrcDoc.test.ts`.** If default-Lesson
  resolution or a not-found predicate is extracted as a pure function, it gets a
  small co-located unit test in that style. Don't manufacture a seam where there
  isn't one — most of this is React/router glue that isn't worth isolating.
- **A good test asserts external behaviour, not internals.** The load-bearing
  access guarantee (a non-Viewer reads nothing) is already covered by the
  owner-or-Viewer tests from topic-sharing and is untouched here.

## Out of Scope

- **The anonymous link-share data path** — token model, token-authorized read
  functions, the public read-only view's contents. This PRD ships only the
  ungated `/share/[token]` route *shell*; the feature is
  `.scratch/topic-sharing/issues/07` and needs its own grilling.
- **A Server-Component / `preloadQuery` data-fetching rewrite.** Data stays on
  client `useQuery`; "proper App Router" here means URL-addressability, not RSC.
- **Resume-where-you-left-off.** The course index lands on the first Lesson, not
  the Frontier or last-opened — a separate UX change.
- **Routing the card panels** (edit, share, new-course) or the mobile drawer —
  they stay local state.
- **New top-level routes** (`/settings`, `/admin`) — the `/courses` prefix merely
  leaves room for them.
- **Middleware-based auth redirects / a dedicated `/signin` route** — rejected in
  ADR 0012 in favour of the in-layout client gate.

## Further Notes

- The change is structural but contained: a re-layout of `src/app` into route
  segments, the `Reader`→layout+page split, and swapping two `useState` toggles
  for URL reads. No schema change, no new Convex function, no new dependency.
- Live Convex queries mean the reactive behaviour (Progress ticks, reply dots,
  Viewer's auto-updating read-only view) carries over for free once the queries
  move into the course layout.
- The ungated public route is deliberately stood up now (even empty) so the
  link-share feature later slots in without revisiting the auth-gate architecture.
