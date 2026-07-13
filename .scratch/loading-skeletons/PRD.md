# PRD: Loading skeletons for the article reader

Status: done — shipped de9a9d5, b336e62; fix 9c4b1a8 (distinct dashboard vs course skeletons).

## Problem Statement

When a learner opens a lesson or reference, the article body's Convex query is
briefly `undefined` while it loads. During that window the reader shows a bare,
unstyled `Loading…` line in the top-left of an otherwise empty pane. The page
visibly jumps from a single line of grey text to the full two-column reading
layout once content arrives. It reads as a broken or empty page rather than one
that is loading, and it happens on the surface the learner waits on most — the
lesson body itself, in both the signed-in reader and the public `/share` reader.

## Solution

While the article body is loading, show a **skeleton** in the exact shape of the
reader instead of the bare text: a title-bar placeholder, several paragraph-line
placeholders standing in for the article text, and (on desktop) a placeholder for
the question aside column. The skeleton occupies the same layout the real content
will, so when content arrives it fills in place rather than the page jumping. This
signals "content is on its way, laid out like this" instead of "empty page".

## User Stories

1. As a learner opening a lesson, I want the reader to show a laid-out placeholder
   while the lesson loads, so that I understand content is coming and the page
   isn't broken.
2. As a learner opening a reference, I want the same placeholder treatment, so
   that references and lessons feel consistent while loading.
3. As a learner on a slow connection, I want the placeholder to match where the
   real content will appear, so that the page doesn't visibly jump when the
   lesson arrives.
4. As a viewer of a shared lesson, I want the same skeleton in the public
   `/share` reader, so that the shared experience feels as polished as the
   signed-in one.
5. As a learner on desktop, I want the question column to also show a placeholder,
   so that the whole reading layout is represented while loading.
6. As a learner on mobile, I want the placeholder to reflect the single-column
   mobile layout, so that it looks right on my device too.
7. As a learner, I want the skeleton to use the app's existing card/line styling,
   so that it looks native to the product rather than a generic grey box.
8. As a learner, when a lesson genuinely can't be found or fails to load, I want
   to still see the existing explanatory message (not an endless skeleton), so
   that I know something is wrong rather than assuming it's still loading.

## Implementation Decisions

- **Scope is deliberately narrow.** Only the two article-body loading states are
  in scope: the signed-in lesson/reference reader and the public-share lesson
  reader. Every other loading state in the app (dashboard grid, admin list,
  certificate page, editions dialog, gate checks, "generating next lesson", etc.)
  is explicitly left as-is. This was chosen over broader coverage.
- **One shared component.** A single presentational `ArticleSkeleton` component is
  added to the existing shared UI primitives module. Both readers render it. This
  is preferred over inlining separate `animate-pulse` blocks in each file so the
  shape can't drift between the two.
- **Full layout mimic.** Both readers render the identical two-column shell:
  an outer `flex flex-col … md:flex-row`, a main reading column (sticky title bar
  + body + mobile question box), and a desktop-only `hidden md:block md:w-80`
  question aside. `ArticleSkeleton` mirrors that shell: a title-bar-height block,
  ~6–8 varying-width paragraph-line placeholders for the body, and a
  question-box-shaped placeholder in the desktop aside. Chosen over a single big
  block or a body-lines-only version.
- **Reuse existing styling tokens.** The skeleton uses the `animate-pulse`
  `rounded-… border border-line bg-card` convention already established by the
  dashboard card and admin-row placeholders. No new colors, no new tokens.
- **Loading branch only.** `ArticleSkeleton` replaces only the `=== undefined`
  (loading) branch in each reader. The `=== null` not-found and content-load-error
  branches keep their existing plain-text messages unchanged.
- **No accessibility attributes.** The skeleton is purely visual — no `aria-busy`,
  no screen-reader-only label. (Chosen explicitly; the dashboard's `aria-busy` was
  not adopted here.)
- **No layout variants.** Lessons and references share one skeleton (same shell);
  the public and signed-in readers share the same component.

## Testing Decisions

- **No automated test.** `ArticleSkeleton` is static presentational markup with no
  logic, and the loading trigger is the established Convex `query === undefined`
  convention used throughout the app. There is no behavior worth asserting that
  isn't just re-asserting the markup.
- **Prior art / repo convention.** The frontend has no React render-testing harness
  (no `@testing-library/react`, no jsdom); its `_components` tests
  (`markdown.test.ts`, `readerDerive.test.ts`, `lessonSrcDoc.test.ts`) all test
  pure logic functions only. Introducing a render harness solely to assert this
  component's markup was considered and rejected as over-engineering.
- **Verification is visual.** Confirm in the running app that both readers show the
  laid-out skeleton while loading and that content fills in place without a jump;
  confirm the not-found / error messages still appear on `null`.

## Out of Scope

- Skeletons for any surface other than the two article readers (dashboard, admin,
  certificate, editions, dialogs, gate checks, generation status, etc.).
- Spinners, Suspense boundaries, or Next.js `loading.tsx` / `error.tsx` route files.
- Accessibility labeling of the skeleton.
- A general-purpose skeleton primitive library or shadcn adoption.
- Changing the existing `null` not-found / error copy or behavior.

## Further Notes

- The signed-in reader lives in `ArtifactView` (handles both `lesson` and
  `reference` kinds); the public reader is `PublicLessonPane`. Both currently
  return `<p className="text-soft">Loading…</p>` on the `undefined` branch.
- The natural home for the shared component is the existing hand-rolled UI
  primitives module (`ui.tsx`), alongside `IconButton`, `Dialog`, `Menu`, etc.
