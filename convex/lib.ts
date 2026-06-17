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
