import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { getOwnedTopic, normaliseEmail, topicLessonCounts } from "./lib";

// Sharing: an owner grants another existing User read-only access to a Topic
// (a Share). The Viewer then sees it in "Shared with me" and reads it through
// the owner-or-Viewer resolver (getViewableTopic). Writes stay owner-only.

// Share a Topic with a person, named by email. Owner-only. If the recipient has
// an account, they get a read-only Share now ("shared"); if not, the invite is
// held as a pending Share ("pending") and claimed when they sign up (see
// `claimPendingShares`). Both paths are idempotent. Sign-up stays Admin-gated by
// the Allowlist (ADR 0011) — inviting an email does not itself open sign-up.
export const shareTopic = mutation({
  args: { topicSlug: v.string(), email: v.string() },
  returns: v.union(v.literal("shared"), v.literal("pending")),
  handler: async (ctx, { topicSlug, email }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("unauthenticated");
    const topic = await getOwnedTopic(ctx, userId, topicSlug);
    if (!topic) throw new Error("topic not found");
    const addr = normaliseEmail(email);
    const viewer = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", addr))
      .unique();
    if (viewer) {
      const already = await ctx.db
        .query("shares")
        .withIndex("by_topic_viewer", (q) => q.eq("topicId", topic._id).eq("viewerId", viewer._id))
        .unique();
      if (!already) await ctx.db.insert("shares", { topicId: topic._id, viewerId: viewer._id });
      return "shared";
    }
    // No account yet — hold the invite until they sign up.
    const existing = await ctx.db
      .query("pendingShares")
      .withIndex("by_topic_email", (q) => q.eq("topicId", topic._id).eq("email", addr))
      .unique();
    if (!existing) await ctx.db.insert("pendingShares", { topicId: topic._id, email: addr });
    return "pending";
  },
});

// A 256-bit URL-safe token (hex). The credential a Public link carries — long
// enough that guessing is infeasible (ADR 0013), so no rate-limiting needed.
function mintPublicToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

// Turn a Topic's Public link on or off (owner-only). `isPublic: true` always
// mints a *fresh* token — so this serves both "make public" and "regenerate"
// (the old link dies at once); `false` clears it, truly revoking access. Returns
// the new token, or null when made private. (ADR 0013: one token per Topic.)
export const setTopicPublic = mutation({
  args: { topicSlug: v.string(), isPublic: v.boolean() },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, { topicSlug, isPublic }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("unauthenticated");
    const topic = await getOwnedTopic(ctx, userId, topicSlug);
    if (!topic) throw new Error("topic not found");
    const publicToken = isPublic ? mintPublicToken() : undefined;
    await ctx.db.patch(topic._id, { publicToken });
    return publicToken ?? null;
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
