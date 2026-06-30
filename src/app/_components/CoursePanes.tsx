"use client";

import { useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { api } from "../../../convex/_generated/api";
import { ArtifactView } from "./ArtifactView";
import { useCourse } from "./CourseShell";
import { firstLessonKey, frontierKey } from "./readerDerive";

// The course index (`/courses/[slug]`): redirect to a Lesson so the URL always
// names what's shown (ADR 0012). An owner resumes at the newest lesson (the
// Frontier); a Viewer of a shared course always starts at lesson 1. `replace`,
// not `push`, so "back" from the lesson goes to the dashboard rather than
// bouncing through here again.
export function CourseIndex({ slug }: { slug: string }) {
  const lessons = useQuery(api.content.listLessons, { topicSlug: slug });
  const header = useQuery(api.content.courseHeader, { topicSlug: slug });
  const router = useRouter();

  // Wait for both the lessons and the caller's role before choosing a target,
  // so an owner never flashes through lesson 1 before the role resolves.
  const target =
    lessons === undefined || header === undefined
      ? null
      : header?.role === "owner"
        ? frontierKey(lessons)
        : firstLessonKey(lessons);

  useEffect(() => {
    if (target) router.replace(`/courses/${slug}/lessons/${target}`);
  }, [target, slug, router]);

  if (lessons === undefined) return <p className="p-4 text-soft">Loading…</p>;
  if (lessons.length === 0) return <p className="p-4 text-soft">No lessons published yet.</p>;
  return <p className="p-4 text-soft">Opening…</p>;
}

// A single Lesson. Reads `frontierKey` from the course context for the
// "generate next lesson" affordance, and marks its replies seen on open.
export function LessonPane({ slug, lessonKey }: { slug: string; lessonKey: string }) {
  const { markSeen, frontierKey, canWrite } = useCourse();
  useEffect(() => {
    markSeen(lessonKey);
  }, [lessonKey, markSeen]);
  return (
    <ArtifactView
      kind="lesson"
      artifactKey={lessonKey}
      topicSlug={slug}
      isFrontier={frontierKey === lessonKey}
      readOnly={!canWrite}
    />
  );
}

// A single Reference. Never the Frontier, nothing to mark seen.
export function ReferencePane({ slug, refKey }: { slug: string; refKey: string }) {
  const { canWrite } = useCourse();
  return <ArtifactView kind="reference" artifactKey={refKey} topicSlug={slug} isFrontier={false} readOnly={!canWrite} />;
}
