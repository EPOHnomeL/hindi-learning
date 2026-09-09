import { ReaderSkeleton } from "~/app/_components/ui";

// The loading boundary for one Reference (perceived-performance ticket 03); see
// the lesson twin beside it for why these files exist at all.
//
// `aside={false}` because a Reference has no desktop question column, which is
// the distinction `ReaderSkeleton` already takes a prop for. Reserving space for
// an aside that never arrives would be a layout shift introduced by the very
// thing meant to prevent one.
export default function Loading() {
  return <ReaderSkeleton aside={false} />;
}
