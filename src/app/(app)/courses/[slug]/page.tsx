import { CourseIndex } from "~/app/_components/CoursePanes";

// `/courses/[slug]` — redirects to the course's first Lesson.
export default async function CoursePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <CourseIndex slug={slug} />;
}
