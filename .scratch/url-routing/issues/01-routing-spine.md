# 01 — Routing spine: URL-addressable dashboard → course → Lesson (tracer bullet)

Status: ready-for-agent

Vocabulary: [`CONTEXT.md`](../../../CONTEXT.md) (**Topic**/course, **Lesson**, **Reference**, **Frontier**, **Share**, **Viewer**). Spec: [`../PRD.md`](../PRD.md). Decisions: [ADR 0012](../../../docs/adr/0012-app-router-url-addressable-navigation.md).

## What to build

The complete happy path of URL-addressable navigation, end-to-end. Replace the
single-page, `useState`-driven app with real App Router routes so the address bar
is the source of truth for what's on screen, and browser history works.

- An authenticated `(app)` route group whose layout gates with the existing
  `AuthLoading` / `Unauthenticated` (`<SignIn>` inline) / `Authenticated` trio, so
  an unauthenticated deep link renders sign-in *at that URL* and re-renders into
  the content after login — no redirects, no `/signin` route. The Convex Auth
  middleware is left as-is (session-sync only).
- `/` renders the dashboard (the owner's course grid + "Shared with me").
- `/courses/[slug]` redirects to that Topic's first Lesson (`lessons[0]`),
  preserving today's auto-select; the URL always names what's shown.
- `/courses/[slug]/lessons/[key]` and `/courses/[slug]/references/[key]` render a
  single Lesson/Reference. `key` (not `seq`) is the URL identifier.
- The course **sidebar is a `layout.tsx`** that stays mounted across Lesson
  navigation and fetches the per-course queries (Lessons, References, Progress,
  Questions, the Topic row) once. The artifact pane is the `page`.
- A **course-scoped context provider** in that layout owns the `seen` set
  (localStorage-backed answered-Question ids): the sidebar reads it for the
  reply-notification dots, and the Lesson page calls `markSeen(lessonKey)` on
  open. Completion ticks and dots stay reactive across navigation.
- Navigation uses `<Link>` (sidebar items, "Open course," "Back to courses").
  Programmatic routing only post-action: `router.push('/courses/[slug]')` after
  `seedTopic` resolves; `router.replace('/')` after `signOut`.
- Dismantle the old toggles: remove `Dashboard`'s `openSlug` and the `Reader`'s
  `selected` state; `Reader` is split into the course layout + Lesson/Reference
  pages + the context. Card edit/share/new-course panels and the mobile drawer
  stay local `useState`.

## Acceptance criteria

- [ ] Visiting `/courses/[slug]/lessons/[key]` directly renders that Lesson; a reload stays on it.
- [ ] `/courses/[slug]` redirects to the first Lesson; the URL then names that Lesson.
- [ ] References render at their own URL with the same chrome.
- [ ] Selecting a Lesson/Reference in the sidebar navigates via `<Link>` and swaps only the reading pane — the sidebar does not remount or re-query.
- [ ] Back/forward moves between dashboard, course, and visited Lessons as expected; on mobile, selecting from the drawer navigates and closes the drawer.
- [ ] Completion ticks and reply-notification dots remain correct as you navigate; opening a Lesson with an unseen Reply clears its dot.
- [ ] A signed-out visit to any deep link shows `<SignIn>` at that URL; after signing in, the same Lesson renders (no redirect detour).
- [ ] Creating a new course navigates into `/courses/[slug]`; signing out lands on `/`, and "back" does not return to the authed page.
- [ ] `openSlug` and `selected` `useState` toggles are gone; the URL is the only selection source.

## Blocked by

- None — can start immediately.

## Notes

- No schema change, no new Convex function — reuses the existing owner-or-Viewer
  reader queries unchanged. Frontend structure only; verified manually per repo
  precedent (the topic-sharing PRD established no frontend tests).
- Structure the `(app)` group so an **ungated sibling route is possible** without
  touching the gate — the anonymous link-share feature
  (`.scratch/topic-sharing/issues/07`) will add `/share/[token]` outside `(app)`
  later. Do not build that route here.
- Not-found / inaccessible-URL handling is **02**.
