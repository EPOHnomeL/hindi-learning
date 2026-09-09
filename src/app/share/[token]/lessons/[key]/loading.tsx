import { ReaderSkeleton } from "~/app/_components/ui";

// The Guest reader's lesson loading boundary (perceived-performance ticket 03).
// Same argument as the authed twin under `(app)/courses`: the boundary is what
// makes Next prefetch the route at all, and it paints the skeleton on the click
// rather than after the server has answered.
//
// Worth having on the public side specifically. A `/share/<token>` link is the
// entrance a stranger arrives through, often from a WhatsApp message on a phone
// on mobile data, and it is the one page where a slow first impression costs a
// reader who has no account and no reason to wait.
export default function Loading() {
  return <ReaderSkeleton />;
}
