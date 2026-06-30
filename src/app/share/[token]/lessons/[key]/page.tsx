import { PublicLessonPane } from "~/app/_components/PublicReader";

// `/share/[token]/lessons/[key]` — one Lesson in the Guest reader.
export default async function PublicLessonPage({ params }: { params: Promise<{ token: string; key: string }> }) {
  const { token, key } = await params;
  return <PublicLessonPane token={token} lessonKey={key} />;
}
