import { v } from "convex/values";
import { query, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { decodeEntities } from "./content";
import { pickContentBody, SOURCE_LANG } from "./lib";
import { langInfo } from "./languages";

// The Guest read seam (issue 07 / ADR 0013). Every function here authorizes by
// the Public link token, NOT by getAuthUserId — these serve anonymous Guests.
// Queries only: a Guest has no mutations to call, so write-blocking is structural.
// An invalid/absent token resolves to no Edition and returns null/[], so nothing
// reveals whether a Topic exists.
//
// A token identifies ONE Edition (course-translation): a per-language
// `publicLinks` row, or the legacy per-Topic `topics.publicToken` (English). The
// Guest is fixed to that Edition — content is served in its language, falling
// back to the English source per item.

async function resolveEdition(ctx: QueryCtx, token: string): Promise<{ topic: Doc<"topics">; lang: string } | null> {
  if (!token) return null;
  const link = await ctx.db
    .query("publicLinks")
    .withIndex("by_token", (q) => q.eq("token", token))
    .unique();
  if (link) {
    const topic = await ctx.db.get(link.topicId);
    return topic ? { topic, lang: link.lang } : null;
  }
  const topic = await ctx.db
    .query("topics")
    .withIndex("by_public_token", (q) => q.eq("publicToken", token))
    .unique();
  return topic ? { topic, lang: SOURCE_LANG } : null;
}

// One Edition's translated rows, keyed `${kind}:${key}` (empty for English).
async function editionMap(
  ctx: QueryCtx,
  topicId: Id<"topics">,
  lang: string,
): Promise<Map<string, Doc<"translations">>> {
  if (lang === SOURCE_LANG) return new Map();
  const rows = await ctx.db
    .query("translations")
    .withIndex("by_topic_lang", (q) => q.eq("topicId", topicId).eq("lang", lang))
    .collect();
  return new Map(rows.map((r) => [`${r.kind}:${r.key}`, r]));
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
  // Explicit output allowlist — this is anonymous, public-internet-facing, so a
  // Guest can never receive a field unless it's listed here.
  returns: v.union(
    v.null(),
    v.object({
      title: v.string(),
      // The Edition this token serves + its text direction (course-translation).
      lang: v.string(),
      dir: v.union(v.literal("ltr"), v.literal("rtl")),
      lessons: v.array(v.object({ key: v.string(), seq: v.number(), title: v.string() })),
      references: v.array(v.object({ key: v.string(), title: v.string() })),
      resources: v.array(
        v.object({
          id: v.id("resources"),
          filename: v.string(),
          status: v.union(v.literal("raw"), v.literal("processing"), v.literal("ready")),
          kind: v.union(v.literal("file"), v.literal("url")),
          url: v.union(v.string(), v.null()),
        }),
      ),
      progress: v.array(
        v.object({ lessonKey: v.string(), status: v.union(v.literal("opened"), v.literal("completed")) }),
      ),
      questions: v.array(
        v.object({
          id: v.id("questions"),
          lessonKey: v.string(),
          text: v.string(),
          status: v.union(v.literal("open"), v.literal("answered")),
          reply: v.union(v.string(), v.null()),
        }),
      ),
    }),
  ),
  handler: async (ctx, { token }) => {
    const resolved = await resolveEdition(ctx, token);
    if (!resolved) return null;
    const { topic, lang } = resolved;
    const tmap = await editionMap(ctx, topic._id, lang);

    const lessons = (
      await ctx.db.query("lessons").withIndex("by_topic_seq", (q) => q.eq("topicId", topic._id)).collect()
    )
      .filter((l) => !l.supersededBy)
      .map((l) => ({ key: l.key, seq: l.seq, title: decodeEntities(tmap.get(`lesson:${l.key}`)?.title ?? l.title) }));

    const references = (
      await ctx.db.query("references").withIndex("by_topic", (q) => q.eq("topicId", topic._id)).collect()
    )
      .sort((a, b) => a.key.localeCompare(b.key))
      .map((r) => ({ key: r.key, title: decodeEntities(tmap.get(`reference:${r.key}`)?.title ?? r.title) }));

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
          .map((q) => {
            const t = tmap.get(`question:${q._id}`);
            return {
              id: q._id,
              lessonKey: q.lessonKey,
              text: t?.text ?? q.text,
              status: q.status,
              reply: (q.reply ? (t?.reply ?? q.reply) : null) ?? null,
            };
          })
      : [];

    const title = decodeEntities(tmap.get("title:")?.text ?? topic.title);
    return {
      title,
      lang,
      dir: langInfo(lang).rtl ? ("rtl" as const) : ("ltr" as const),
      lessons,
      references,
      resources,
      progress,
      questions,
    };
  },
});

// One Lesson's HTML for a Guest. Null for an unknown/wrong token, an unknown key,
// or a superseded Lesson (mirrors the authed getLesson).
export const publicLesson = query({
  args: { token: v.string(), key: v.string() },
  // `contentUrl` (content blob) or inline `html` during the migration — exactly
  // one is present (see .scratch/html-blob-storage). After the narrow step this
  // becomes a required `contentUrl`.
  returns: v.union(
    v.null(),
    v.object({
      key: v.string(),
      seq: v.number(),
      title: v.string(),
      contentUrl: v.optional(v.string()),
      html: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, { token, key }) => {
    const resolved = await resolveEdition(ctx, token);
    if (!resolved) return null;
    const { topic, lang } = resolved;
    const lesson = await ctx.db
      .query("lessons")
      .withIndex("by_topic_key", (q) => q.eq("topicId", topic._id).eq("key", key))
      .unique();
    if (!lesson || lesson.supersededBy) return null;
    const t =
      lang === SOURCE_LANG
        ? null
        : await ctx.db
            .query("translations")
            .withIndex("by_topic_lang_kind_key", (q) =>
              q.eq("topicId", topic._id).eq("lang", lang).eq("kind", "lesson").eq("key", key),
            )
            .unique();
    return {
      key: lesson.key,
      seq: lesson.seq,
      title: decodeEntities(t?.title ?? lesson.title),
      ...pickContentBody(t, lesson),
    };
  },
});

// One Reference's HTML for a Guest. Null for an unknown/wrong token or key.
export const publicReference = query({
  args: { token: v.string(), key: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      key: v.string(),
      title: v.string(),
      contentUrl: v.optional(v.string()),
      html: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, { token, key }) => {
    const resolved = await resolveEdition(ctx, token);
    if (!resolved) return null;
    const { topic, lang } = resolved;
    const ref = await ctx.db
      .query("references")
      .withIndex("by_topic_key", (q) => q.eq("topicId", topic._id).eq("key", key))
      .unique();
    if (!ref) return null;
    const t =
      lang === SOURCE_LANG
        ? null
        : await ctx.db
            .query("translations")
            .withIndex("by_topic_lang_kind_key", (q) =>
              q.eq("topicId", topic._id).eq("lang", lang).eq("kind", "reference").eq("key", key),
            )
            .unique();
    return { key: ref.key, title: decodeEntities(t?.title ?? ref.title), ...pickContentBody(t, ref) };
  },
});
