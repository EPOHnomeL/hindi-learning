import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { getOwnedTopic, topicLessonCounts } from "./lib";

// Sharing: an owner grants another existing User read-only access to a Topic
// (a Share). The Viewer then sees it in "Shared with me" and reads it through
// the owner-or-Viewer resolver (getViewableTopic). Writes stay owner-only.

// Share a Topic with another User, named by their account email. Owner-only;
// the recipient account must already exist. (Self/duplicate/no-account edge
// cases are issue 06; this is the happy path.)
export const shareTopic = mutation({
  args: { topicSlug: v.string(), email: v.string() },
  returns: v.null(),
  handler: async (ctx, { topicSlug, email }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("unauthenticated");
    const topic = await getOwnedTopic(ctx, userId, topicSlug);
    if (!topic) throw new Error("topic not found");
    const viewer = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email))
      .unique();
    if (!viewer) throw new Error(`no account for ${email}`);
    await ctx.db.insert("shares", { topicId: topic._id, viewerId: viewer._id });
  },
});

// The Topics shared *with* the caller — the "Shared with me" feed. Each card
// carries the owner's email (attribution) and the same live counts as the
// owner's dashboard, so it renders like a CourseCard. Read-only; no writes.
export const listSharedTopics = query({
  args: {},
  returns: v.array(
    v.object({
      slug: v.string(),
      title: v.string(),
      ownerEmail: v.union(v.string(), v.null()),
      mission: v.union(v.string(), v.null()),
      lessonCount: v.number(),
      completedCount: v.number(),
    }),
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const shares = await ctx.db
      .query("shares")
      .withIndex("by_viewer", (q) => q.eq("viewerId", userId))
      .collect();
    const cards = await Promise.all(
      shares.map(async (s) => {
        const topic = await ctx.db.get(s.topicId);
        if (!topic) return null;
        const owner = topic.ownerId ? await ctx.db.get(topic.ownerId) : null;
        const counts = await topicLessonCounts(ctx, topic._id);
        return {
          slug: topic.slug,
          title: topic.title,
          ownerEmail: owner?.email ?? null,
          mission: topic.mission ?? null,
          ...counts,
        };
      }),
    );
    return cards.filter((c): c is NonNullable<typeof c> => c !== null);
  },
});
