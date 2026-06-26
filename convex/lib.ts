import type { QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";

// Shared backend helpers. (Plain module — no Convex functions registered here.)

// Guards the PUBLISH_SECRET-protected mutations the teach CLI / cloud agent call.
export function assertAdmin(secret: string) {
  const expected = process.env.PUBLISH_SECRET;
  if (!expected || secret !== expected) throw new Error("unauthorized");
}

export async function topicBySlug(ctx: QueryCtx, slug: string): Promise<Doc<"topics"> | null> {
  return await ctx.db
    .query("topics")
    .withIndex("by_slug", (q) => q.eq("slug", slug))
    .unique();
}

// A Topic owned by `userId` with this slug, or null. The owner-scoped resolver
// shared by the reader's content and capture queries.
export async function getOwnedTopic(ctx: QueryCtx, userId: Id<"users">, slug: string): Promise<Doc<"topics"> | null> {
  return await ctx.db
    .query("topics")
    .withIndex("by_owner_slug", (q) => q.eq("ownerId", userId).eq("slug", slug))
    .unique();
}

// A Topic this user may *read*: one they own, or one shared with them as a
// Viewer. The read-side sibling of getOwnedTopic — write paths stay owner-only.
// Slug is globally unique today, so we resolve by slug then check access.
export async function getViewableTopic(ctx: QueryCtx, userId: Id<"users">, slug: string): Promise<Doc<"topics"> | null> {
  const topic = await topicBySlug(ctx, slug);
  if (!topic) return null;
  if (topic.ownerId === userId) return topic;
  const share = await ctx.db
    .query("shares")
    .withIndex("by_topic_viewer", (q) => q.eq("topicId", topic._id).eq("viewerId", userId))
    .unique();
  return share ? topic : null;
}

// A Topic's live progress counts for a dashboard/Shared-with-me card: how many
// non-superseded Lessons it has, and how many are completed. Progress is the
// owner's (one owner per Topic), so the counts are owner-relative — a Viewer
// sees where the owner is.
export async function topicLessonCounts(
  ctx: QueryCtx,
  topicId: Id<"topics">,
): Promise<{ lessonCount: number; completedCount: number }> {
  const lessons = (
    await ctx.db.query("lessons").withIndex("by_topic_seq", (q) => q.eq("topicId", topicId)).collect()
  ).filter((l) => !l.supersededBy);
  const progress = await ctx.db
    .query("progress")
    .withIndex("by_topic_lesson", (q) => q.eq("topicId", topicId))
    .collect();
  const done = new Set(progress.filter((p) => p.status === "completed").map((p) => p.lessonKey));
  return { lessonCount: lessons.length, completedCount: lessons.filter((l) => done.has(l.key)).length };
}
