import { PublicCourseIndex } from "~/app/_components/PublicReader";

// `/share/[token]` — redirect to the public course's first Lesson.
export default async function PublicCoursePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <PublicCourseIndex token={token} />;
}
