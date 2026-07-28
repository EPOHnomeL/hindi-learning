import type { QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

// Per-reader Lesson progress counts. (Plain module — no Convex functions
// registered here.) Split out of `lib.ts` by architecture-deepening/02: the
// dashboard/card counts read `lessons` + `progress` and know nothing about
// Editions, grants or the paygate.

// A Topic's live progress counts for a dashboard/Shared-with-me card: how many
// non-superseded Lessons it has, and how many `userId` has completed. Progress is
// per-reader, so the counts are the caller's own — an owner sees their own
// progress; a Viewer sees theirs (fresh on a shared Topic), not the owner's.
export async function topicLessonCounts(
  ctx: QueryCtx,
  topicId: Id<"topics">,
  userId: Id<"users">,
): Promise<{ lessonCount: number; completedCount: number }> {
  const lessons = (
    await ctx.db.query("lessons").withIndex("by_topic_seq", (q) => q.eq("topicId", topicId)).collect()
  ).filter((l) => !l.supersededBy);
  const progress = await ctx.db
    .query("progress")
    .withIndex("by_topic_user_lesson", (q) => q.eq("topicId", topicId).eq("userId", userId))
    .collect();
  const done = new Set(progress.filter((p) => p.status === "completed").map((p) => p.lessonKey));
  return { lessonCount: lessons.length, completedCount: lessons.filter((l) => done.has(l.key)).length };
}
