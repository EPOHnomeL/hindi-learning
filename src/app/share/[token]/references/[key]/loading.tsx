import { ReaderSkeleton } from "~/app/_components/ui";

// The Guest reader's reference loading boundary (perceived-performance ticket
// 03). `aside={false}`: a Reference has no desktop question column, exactly as
// on the authed side.
export default function Loading() {
  return <ReaderSkeleton aside={false} />;
}
