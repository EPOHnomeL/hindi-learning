import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";

// Lessons & references. Reader queries are auth-gated; publish mutations are
// called by the teach CLI (`pnpm run publish`) and guarded by PUBLISH_SECRET
// (set with `npx convex env set PUBLISH_SECRET ...`).

const TOPIC_SLUG = "hindi";

function assertAdmin(secret: string) {
  const expected = process.env.PUBLISH_SECRET;
  if (!expected || secret !== expected) throw new Error("unauthorized");
}

async function getTopicId(ctx: { db: any }) {
  const topic = await ctx.db
    .query("topics")
    .withIndex("by_slug", (q: any) => q.eq("slug", TOPIC_SLUG))
    .unique();
  return topic?._id ?? null;
}

// ---- Reader (learner) ------------------------------------------------------

export const listLessons = query({
  args: {},
  handler: async (ctx) => {
    if (!(await getAuthUserId(ctx))) return [];
    const topicId = await getTopicId(ctx);
    if (!topicId) return [];
    const lessons = await ctx.db
      .query("lessons")
      .withIndex("by_topic_seq", (q) => q.eq("topicId", topicId))
      .collect();
    return lessons
      .filter((l) => !l.supersededBy)
      .map((l) => ({ key: l.key, seq: l.seq, title: l.title }));
  },
});

export const getLesson = query({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    if (!(await getAuthUserId(ctx))) return null;
    const topicId = await getTopicId(ctx);
    if (!topicId) return null;
    const lesson = await ctx.db
      .query("lessons")
      .withIndex("by_topic_key", (q) => q.eq("topicId", topicId).eq("key", key))
      .unique();
    if (!lesson || lesson.supersededBy) return null;
    return { key: lesson.key, seq: lesson.seq, title: lesson.title, html: lesson.html };
  },
});

export const listReferences = query({
  args: {},
  handler: async (ctx) => {
    if (!(await getAuthUserId(ctx))) return [];
    const topicId = await getTopicId(ctx);
    if (!topicId) return [];
    const refs = await ctx.db
      .query("references")
      .withIndex("by_topic", (q) => q.eq("topicId", topicId))
      .collect();
    return refs
      .sort((a, b) => a.key.localeCompare(b.key))
      .map((r) => ({ key: r.key, title: r.title }));
  },
});

export const getReference = query({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    if (!(await getAuthUserId(ctx))) return null;
    const topicId = await getTopicId(ctx);
    if (!topicId) return null;
    const ref = await ctx.db
      .query("references")
      .withIndex("by_topic_key", (q) => q.eq("topicId", topicId).eq("key", key))
      .unique();
    return ref ? { key: ref.key, title: ref.title, html: ref.html } : null;
  },
});

// ---- Publish (teach CLI, PUBLISH_SECRET-guarded) ---------------------------

export const ensureTopic = mutation({
  args: { secret: v.string(), title: v.string() },
  handler: async (ctx, { secret, title }) => {
    assertAdmin(secret);
    const existing = await getTopicId(ctx);
    if (existing) return existing;
    return await ctx.db.insert("topics", { slug: TOPIC_SLUG, title });
  },
});

// Lessons are immutable: insert if absent, otherwise no-op. If `supersedes` is
// given, the named prior lesson is retired (its `supersededBy` points here).
export const publishLesson = mutation({
  args: {
    secret: v.string(),
    key: v.string(),
    seq: v.number(),
    title: v.string(),
    html: v.string(),
    supersedes: v.optional(v.string()),
  },
  handler: async (ctx, { secret, key, seq, title, html, supersedes }) => {
    assertAdmin(secret);
    const topicId = await getTopicId(ctx);
    if (!topicId) throw new Error("topic not found — run ensureTopic first");

    const existing = await ctx.db
      .query("lessons")
      .withIndex("by_topic_key", (q) => q.eq("topicId", topicId).eq("key", key))
      .unique();
    if (existing) return { status: "exists" as const };

    await ctx.db.insert("lessons", { topicId, key, seq, title, html });
    if (supersedes) {
      const old = await ctx.db
        .query("lessons")
        .withIndex("by_topic_key", (q) => q.eq("topicId", topicId).eq("key", supersedes))
        .unique();
      if (old) await ctx.db.patch(old._id, { supersededBy: key });
    }
    return { status: "inserted" as const };
  },
});

// References are mutable: upsert, skipping unchanged content (by hash).
export const upsertReference = mutation({
  args: {
    secret: v.string(),
    key: v.string(),
    title: v.string(),
    html: v.string(),
    contentHash: v.string(),
  },
  handler: async (ctx, { secret, key, title, html, contentHash }) => {
    assertAdmin(secret);
    const topicId = await getTopicId(ctx);
    if (!topicId) throw new Error("topic not found — run ensureTopic first");

    const existing = await ctx.db
      .query("references")
      .withIndex("by_topic_key", (q) => q.eq("topicId", topicId).eq("key", key))
      .unique();
    if (existing) {
      if (existing.contentHash === contentHash) return { status: "unchanged" as const };
      await ctx.db.patch(existing._id, { title, html, contentHash });
      return { status: "updated" as const };
    }
    await ctx.db.insert("references", { topicId, key, title, html, contentHash });
    return { status: "inserted" as const };
  },
});
