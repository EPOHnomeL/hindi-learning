# URL-addressable navigation via the App Router

The app moves from a single client-state-driven page (everything rendered at
`/`, view chosen by `useState`) to **real App Router routes**, so courses and
lessons have shareable, deep-linkable URLs with working browser history. The
goal is URL-addressability — *not* a Server-Component data-fetching rewrite:
data stays on live client `useQuery` subscriptions, and routes become thin
client components that read their identifiers from the URL instead of state.

## Context

Navigation was entirely local React state: `Dashboard` toggled `CourseGrid` ↔
`Reader` via `openSlug`, and `Reader` picked a lesson via `selected`. Nothing
touched the URL — no deep links, no back button, and a **Share** could only drop
a Viewer on a bare dashboard. We also want anonymous read-only **link shares**
(deferred — `.scratch/topic-sharing/issues/07`), which need an unauthenticated
URL to point at.

## Decision

- **Nested route segments mirror the domain hierarchy:** `/` (dashboard) →
  `/courses/[slug]` → `/courses/[slug]/lessons/[key]` and
  `/courses/[slug]/references/[key]`. The `/courses` prefix keeps the top-level
  namespace open (`/settings`, `/admin`, …).
- **`key`, not `seq`, identifies a lesson/reference in the URL.** `key` is
  unique-per-topic, immutable, already the schema/client primary identifier, and
  survives supersession; `seq` is display ordering only and references have none.
- **Auth gate is client-side, in a shared `(app)` route-group layout** —
  `AuthLoading`/`Unauthenticated`(`<SignIn>` inline)/`Authenticated`. An
  unauthenticated deep link renders sign-in *at that URL* and lands there after
  login, with no redirect plumbing. The Convex Auth middleware stays session-sync
  only; it does not block.
- **An ungated public route lives outside `(app)`** (reserved as
  `/share/[token]`) so anonymous link shares need no auth-gate carve-out. The
  middleware-redirect-to-`/signin` alternative was rejected — it would require
  explicit route-matcher exemptions for that public path.
- **The course sidebar is a `layout.tsx`** that stays mounted across lesson
  navigation; the artifact pane is the `page`. A small **course-scoped context
  provider** in that layout owns the cross-cutting `seen` set (notification dots
  read it; the lesson page calls `markSeen` on open) and fetches the per-course
  queries once.
- **`/courses/[slug]` redirects to the first lesson** (preserving today's
  auto-select), so the URL always names what's on screen. *Which* lesson it lands
  on stays "first" — resume-where-you-left-off is out of scope.
- **Unknown or inaccessible course, and unknown lesson key, both `notFound()`** —
  one 404 for "doesn't exist" and "you can't see it" alike, so private courses
  don't leak existence. No silent fallback to the first lesson.
- **`<Link>` for navigation; `useRouter().push`/`replace` only post-action** —
  `push` to the new course after `seedTopic`, `replace('/')` after sign-out.

## Considered Options

- **`seq` in the URL** (`/courses/hindi/lessons/3`) — prettier and shorter, but
  ambiguous under supersession and unavailable for references; rejected for
  stability and scheme consistency.
- **Middleware server-redirect to a `/signin` route** — the traditional gate, but
  adds a redirect round-trip and a `redirect` param, and fights the public-share
  requirement; rejected in favour of the in-layout client gate.
- **Query params instead of nested segments** (`?lesson=…`) and **render-in-place
  instead of redirect** at the course index — both rejected as less "App Router
  proper" and weaker for deep-linking.

## Consequences

- Card panels (edit/share/new-course) and the mobile drawer stay local `useState`
  — transient UI, no URL.
- The ungated public route group is the seam the anonymous link-share feature
  (issue 07) builds on; it needs token-authorized read functions, since the
  auth-scoped reader queries can't serve an unauthenticated caller.
- `Reader` is split into the course layout + lesson page; its `seen`/notification
  logic moves into the course-scoped context.
