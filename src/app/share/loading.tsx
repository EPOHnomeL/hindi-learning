import { CourseSkeleton } from "~/app/_components/ui";

// Arriving at a shared course from outside it (perceived-performance ticket 03),
// which for the Guest reader means a cold open of the link itself.
//
// At `share/`, above `[token]`, for the same reason its authed counterpart sits
// above `[slug]`: `share/[token]/layout.tsx` is an async server component, and a
// boundary inside `[token]` renders within that layout and cannot cover its
// wait. The sidebar has not mounted yet here either, so this draws the rail too.
export default function Loading() {
  return <CourseSkeleton />;
}
