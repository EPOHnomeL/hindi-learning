"use client";

import { useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { api } from "../../../convex/_generated/api";
import { ArtifactView } from "./ArtifactView";
import { useCourse } from "./CourseShell";
import { firstLessonKey } from "./readerDerive";

// The course index (`/courses/[slug]`): redirect to the first Lesson so the URL
// always names what's shown (ADR 0012). `replace`, not `push`, so "back" from the
// lesson goes to the dashboard rather than bouncing through here again.
export function CourseIndex({ slug }: { slug: string }) {
  const lessons = useQuery(api.content.listLessons, { topicSlug: slug });
  const router = useRouter();
  const first = lessons ? firstLessonKey(lessons) : null;

  useEffect(() => {
    if (first) router.replace(`/courses/${slug}/lessons/${first}`);
  }, [first, slug, router]);

  if (lessons === undefined) return <p className="p-4 text-soft">Loading…</p>;
  if (lessons.length === 0) return <p className="p-4 text-soft">No lessons published yet.</p>;
  return <p className="p-4 text-soft">Opening…</p>;
}

// A single Lesson. Reads `frontierKey` from the course context for the
// "generate next lesson" affordance, and marks its replies seen on open.
export function LessonPane({ slug, lessonKey }: { slug: string; lessonKey: string }) {
  const { markSeen, frontierKey } = useCourse();
  useEffect(() => {
    markSeen(lessonKey);
  }, [lessonKey, markSeen]);
  return <ArtifactView kind="lesson" artifactKey={lessonKey} topicSlug={slug} isFrontier={frontierKey === lessonKey} />;
}

// A single Reference. Never the Frontier, nothing to mark seen.
export function ReferencePane({ slug, refKey }: { slug: string; refKey: string }) {
  return <ArtifactView kind="reference" artifactKey={refKey} topicSlug={slug} isFrontier={false} />;
}
