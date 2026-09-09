import { ReaderSkeleton } from "~/app/_components/ui";

// The loading boundary for one Lesson (perceived-performance ticket 03).
//
// **This file is not only a skeleton; it is what makes prefetch work.** Next
// prefetches a dynamic route only as far as its nearest loading boundary, and
// until 2026-09-09 this app had none at all, anywhere. So CourseShell's sidebar
// links (one per Lesson, thirty or more on a real course, all in the viewport on
// desktop) prefetched nothing usable and every click paid a full RSC round trip
// before Convex was even asked for the body.
//
// It also moves the skeleton earlier. `ArtifactView` renders `ReaderSkeleton`
// itself while its own queries resolve, but it is a client component on a page
// that awaits `params`, so nothing changed on screen until the server had
// already answered. The same skeleton now paints on the click.
//
// Deliberately at the `[key]` leaf, not higher: the boundary belongs INSIDE
// `courses/[slug]/layout.tsx` so the persistent sidebar is never torn down and
// re-mounted by a lesson-to-lesson navigation, which is the one thing that
// layout exists to guarantee.
export default function Loading() {
  return <ReaderSkeleton />;
}
