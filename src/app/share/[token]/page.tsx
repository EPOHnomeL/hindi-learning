import { PublicCourseIndex } from "~/app/_components/PublicReader";

// `/share/[token]` — redirect to the public course's first Lesson. The middleware
// normally does this as a 307 (lib/shareEntry.ts), so this page renders only for a
// dead link, an empty course, or when that lookup failed.
export default async function PublicCoursePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <PublicCourseIndex src={{ token }} />;
}
