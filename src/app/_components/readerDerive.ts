// Pure derivations behind the Reader's sidebar and the course-index redirect.
// Extracted from the old monolithic Reader so the course layout, the sidebar,
// and the `/courses/[slug]` redirect can share one tested source of truth
// (ADR 0012). No React, no DOM — runs in the edge-runtime test environment.

type LessonLite = { key: string; seq: number; title: string };
type ProgressLite = { lessonKey: string; status: "opened" | "completed" };
type QuestionLite = { id: string; lessonKey: string; reply: string | null };

// The course-index redirect target: the first lesson. `listLessons` is
// seq-ascending and already drops superseded lessons, so the head is the start.
export function firstLessonKey(lessons: readonly LessonLite[]): string | null {
  return lessons[0]?.key ?? null;
}

// The Frontier: the highest-seq (last) lesson — the learner's leading edge.
// `isFrontier` styling and the "fire the next lesson" offer hang off this.
export function frontierKey(lessons: readonly LessonLite[]): string | null {
  return lessons[lessons.length - 1]?.key ?? null;
}

// The lessonKeys the learner has completed, for the sidebar's ✓ ticks. "opened"
// is progress without completion, so it does not count as done.
export function completedKeys(progress: readonly ProgressLite[]): Set<string> {
  return new Set(progress.filter((p) => p.status === "completed").map((p) => p.lessonKey));
}

// Lessons carrying a teacher Reply the learner hasn't seen yet → a sidebar dot.
// `seen` is the set of answered-Question ids already viewed (per-device).
export function unseenReplyKeys(
  questions: readonly QuestionLite[],
  seen: ReadonlySet<string>,
): Set<string> {
  const keys = new Set<string>();
  for (const q of questions) if (q.reply && !seen.has(q.id)) keys.add(q.lessonKey);
  return keys;
}

// Resolve an internal link clicked inside an artifact to the path the app should
// route to. Lessons author cross-links as the owner's `/courses/<slug>/…` routes
// (AUTHORING.md §5). A signed-in owner/viewer routes there directly; but a Guest
// on the public reader (`/share/<token>/…`) can't open `/courses/…`, so rewrite
// a `/courses/<slug>/(lessons|references)/<key>` target into the share context,
// preserving the artifact kind + key. Non-artifact or already-share paths pass
// through unchanged.
export function internalNavTarget(targetPath: string, currentPath: string): string {
  const share = currentPath.match(/^\/share\/([^/]+)/);
  if (!share) return targetPath;
  const m = targetPath.match(/^\/courses\/[^/]+\/(lessons|references)\/(.+)$/);
  return m ? `/share/${share[1]}/${m[1]}/${m[2]}` : targetPath;
}

// Opening a lesson counts as seeing its teacher Replies. Returns the next `seen`
// set with that lesson's replied-Question ids added — or the *same* reference
// when there's nothing new, so a React state setter can skip a re-render.
export function seenAfterOpening(
  questions: readonly QuestionLite[],
  lessonKey: string,
  seen: ReadonlySet<string>,
): Set<string> {
  const ids = questions.filter((q) => q.lessonKey === lessonKey && q.reply).map((q) => q.id);
  if (ids.every((id) => seen.has(id))) return seen as Set<string>;
  const next = new Set(seen);
  for (const id of ids) next.add(id);
  return next;
}
