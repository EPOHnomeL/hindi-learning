import { CourseSkeleton } from "~/app/_components/ui";

// The loading boundary for arriving at a course from outside it, typically a
// card on the dashboard (perceived-performance ticket 03).
//
// It sits at `courses/`, ABOVE `[slug]`, and the level is the whole point.
// `courses/[slug]/layout.tsx` is an async server component: it awaits `params`,
// reads `headers()` and runs a `fetchQuery` for the cross-host canonical
// redirect. A boundary placed inside `[slug]` renders within that layout and so
// cannot cover the layout's own wait. This one can, because there is no
// `courses/layout.tsx`, which puts it directly inside `AppGate`.
//
// `CourseSkeleton` rather than `ReaderSkeleton` for the same reason: the
// sidebar has not mounted yet at this point, so the placeholder has to draw the
// rail as well as the reader. Its own comment says it is for exactly this case.
//
// This does NOT fire on lesson-to-lesson navigation: `[slug]` is unchanged
// there, the layout is preserved, and the nearer boundary at the `[key]` leaf
// is the one that catches.
export default function Loading() {
  return <CourseSkeleton />;
}
