---
type: task
blocked_by: []
---
# A loading boundary on the reader routes, so the skeleton paints on the click

## Question

There is **no `loading.tsx`, `error.tsx` or `not-found.tsx` anywhere in `src/app`**
(checked 2026-09-09). Two consequences, and the second is the expensive one.

**The skeleton arrives late.** `ReaderSkeleton` is rendered from inside `ArtifactView`
(`ArtifactView.tsx:511`), which is a client component on a page that is a server
component awaiting `params`. So a lesson click waits for the RSC response before anything
changes on screen at all, and only then does the skeleton appear. The skeleton is
excellent and it is showing up after the wait it exists to cover.

**Prefetch is doing nothing.** Next only prefetches a dynamic route down to the nearest
loading boundary. There is none, so the sidebar's lesson links (`CourseShell.tsx:326`,
one per lesson, thirty or more on a real course, all in the viewport on desktop) prefetch
nothing useful, and every click pays the full RSC round trip before Convex is even asked.
This is the first of the three serial round trips the scan documents, and it is the one
nobody has looked at, because the other two are visibly covered by a skeleton.

A `loading.tsx` returning the existing `<ReaderSkeleton />` fixes both at once, which is
why this is minutes of work rather than a session. The component already exists and
already mirrors the reader's shape.

Two things to get right rather than guess:

- **Which routes get one.** The lesson route is the hot path. The reference route wants
  `aside={false}`, which `ReaderSkeleton` already takes. The `/share/<token>` guest twins
  are the same shape and the same argument applies to them. The course index route
  redirects immediately and may want nothing.
- **What the boundary does to the persistent sidebar.** `CourseShell` is the layout and
  is deliberately kept mounted across lesson navigation. A loading boundary placed at the
  wrong level would tear it down and re-mount it, which would be a regression, not a fix.
  Place it so only the page swaps, and verify that rather than assuming it.

Worth confirming with a real navigation, not from the docs alone: that the prefetch
actually starts caching the segment once the boundary exists.

## Done when

- Clicking a lesson in the sidebar paints the reader skeleton immediately, before the
  server has responded, at both breakpoints.
- The persistent sidebar does not re-mount on lesson navigation. Verified by watching it,
  not by reading the layout.
- The Answer says which routes got a boundary and which deliberately did not, and states
  whether prefetch is now caching the segment, with how that was checked.
