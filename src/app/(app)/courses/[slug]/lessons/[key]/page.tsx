import { LessonPane } from "~/app/_components/CoursePanes";

// `/courses/[slug]/lessons/[key]` — one Lesson, identified by its stable `key`.
export default async function LessonPage({ params }: { params: Promise<{ slug: string; key: string }> }) {
  const { slug, key } = await params;
  return <LessonPane slug={slug} lessonKey={key} />;
}
