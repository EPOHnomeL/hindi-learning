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

  if (lessons === undefined) return <CourseStatus variant="loading" />;
  if (lessons.length === 0)
    return <CourseStatus variant={header?.role === "viewer" ? "empty-viewer" : "preparing"} />;
  return <CourseStatus variant="opening" />;
}

// The full-pane state shown before any Lesson exists. An owner's freshly-seeded
// course lands here while the Routine drafts Lesson 1 — so instead of a bare line
// of text in a big empty pane, "preparing" fills it with a live, reassuring
// indicator (lessons are a live query, so the pane redirects itself the moment
// the first one lands). A Viewer of a shared course with no lessons gets a calm
// "nothing yet" instead.
function CourseStatus({ variant }: { variant: "loading" | "opening" | "preparing" | "empty-viewer" }) {
  if (variant === "loading" || variant === "opening") {
    return (
      <div className="flex h-full min-h-[60vh] items-center justify-center p-8">
        <p className="text-sm text-soft">{variant === "loading" ? "Loading…" : "Opening…"}</p>
      </div>
    );
  }

  if (variant === "empty-viewer") {
    return (
      <div className="flex h-full min-h-[60vh] flex-col items-center justify-center gap-3 p-8 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-hi text-3xl" aria-hidden>
          📚
        </span>
        <h2 className="text-lg font-semibold text-accent">No lessons yet</h2>
        <p className="max-w-sm text-sm text-soft">This course doesn’t have any published lessons yet. Check back soon.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-[60vh] flex-col items-center justify-center gap-6 p-8 text-center">
      <div className="relative flex h-20 w-20 items-center justify-center">
        <span className="absolute inset-0 animate-ping rounded-full bg-gold/20" />
        <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-hi text-3xl shadow-sm" aria-hidden>
          ✍️
        </span>
      </div>
      <div className="flex max-w-md flex-col items-center gap-2">
        <h2 className="text-xl font-semibold tracking-tight text-accent">Preparing your first lesson</h2>
        <p className="text-sm leading-relaxed text-soft">
          Your teacher is reading through your resources and drafting Lesson&nbsp;1. This usually takes about a minute — it’ll
          appear here automatically.
        </p>
      </div>
      <div className="flex items-center gap-1.5" aria-hidden>
        <span className="h-2 w-2 animate-bounce rounded-full bg-accent2/70 [animation-delay:0ms]" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-accent2/70 [animation-delay:150ms]" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-accent2/70 [animation-delay:300ms]" />
      </div>
    </div>
  );
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
