import { v } from "convex/values";
import { query, type QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { decodeEntities } from "./content";

// The Guest read seam (issue 07 / ADR 0013). Every function here authorizes by
// the Public link token, NOT by getAuthUserId — these serve anonymous Guests.
// Queries only: a Guest has no mutations to call, so write-blocking is structural.
// An invalid/absent token resolves to no Topic and returns null/[], so nothing
// reveals whether a Topic exists.

async function topicByPublicToken(ctx: QueryCtx, token: string): Promise<Doc<"topics"> | null> {
  if (!token) return null;
  return await ctx.db
    .query("topics")
    .withIndex("by_public_token", (q) => q.eq("publicToken", token))
    .unique();
}

// Everything a Guest needs to render the course shell + read-only panels, in one
// reactive bundle: the sidebar lists, Resources, and the owner's Progress and
// Q&A (full mirror, ADR 0013). Per-artifact HTML is fetched on demand by
// publicLesson / publicReference. Returns null for an invalid/unknown token.
// ponytail: the row shapes mirror the authed reader queries (content/capture/
// resources); kept as an explicit allowlist here so a Guest can never see a
// field the authed side adds without it being deliberately re-listed.
export const publicCourse = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const topic = await topicByPublicToken(ctx, token);
    if (!topic) return null;

    const lessons = (
      await ctx.db.query("lessons").withIndex("by_topic_seq", (q) => q.eq("topicId", topic._id)).collect()
    )
      .filter((l) => !l.supersededBy)
      .map((l) => ({ key: l.key, seq: l.seq, title: decodeEntities(l.title) }));

    const references = (
      await ctx.db.query("references").withIndex("by_topic", (q) => q.eq("topicId", topic._id)).collect()
    )
      .sort((a, b) => a.key.localeCompare(b.key))
      .map((r) => ({ key: r.key, title: decodeEntities(r.title) }));

    const resources = await Promise.all(
      (await ctx.db.query("resources").withIndex("by_topic", (q) => q.eq("topicId", topic._id)).collect()).map(
        async (r) => ({
          id: r._id,
          filename: r.filename,
          status: r.status,
          kind: r.kind,
          url: r.kind === "url" ? (r.url ?? null) : r.rawStorageId ? await ctx.storage.getUrl(r.rawStorageId) : null,
        }),
      ),
    );

    // Progress + Questions are the owner's (one owner per Topic), read-only.
    const ownerId = topic.ownerId;
    const progress = ownerId
      ? (
          await ctx.db
            .query("progress")
            .withIndex("by_topic_user_lesson", (q) => q.eq("topicId", topic._id).eq("userId", ownerId))
            .collect()
        ).map((p) => ({ lessonKey: p.lessonKey, status: p.status }))
      : [];
    const questions = ownerId
      ? (
          await ctx.db
            .query("questions")
            .withIndex("by_topic_user", (q) => q.eq("topicId", topic._id).eq("userId", ownerId))
            .collect()
        )
          .sort((a, b) => b._creationTime - a._creationTime)
          .map((q) => ({ id: q._id, lessonKey: q.lessonKey, text: q.text, status: q.status, reply: q.reply ?? null }))
      : [];

    return { title: decodeEntities(topic.title), lessons, references, resources, progress, questions };
  },
});

// One Lesson's HTML for a Guest. Null for an unknown/wrong token, an unknown key,
// or a superseded Lesson (mirrors the authed getLesson).
export const publicLesson = query({
  args: { token: v.string(), key: v.string() },
  handler: async (ctx, { token, key }) => {
    const topic = await topicByPublicToken(ctx, token);
    if (!topic) return null;
    const lesson = await ctx.db
      .query("lessons")
      .withIndex("by_topic_key", (q) => q.eq("topicId", topic._id).eq("key", key))
      .unique();
    if (!lesson || lesson.supersededBy) return null;
    return { key: lesson.key, seq: lesson.seq, title: decodeEntities(lesson.title), html: lesson.html };
  },
});

// One Reference's HTML for a Guest. Null for an unknown/wrong token or key.
export const publicReference = query({
  args: { token: v.string(), key: v.string() },
  handler: async (ctx, { token, key }) => {
    const topic = await topicByPublicToken(ctx, token);
    if (!topic) return null;
    const ref = await ctx.db
      .query("references")
      .withIndex("by_topic_key", (q) => q.eq("topicId", topic._id).eq("key", key))
      .unique();
    return ref ? { key: ref.key, title: decodeEntities(ref.title), html: ref.html } : null;
  },
});
