import { v } from "convex/values";
import { query, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { decodeEntities } from "./content";
import { editionAccessLevel, editionPrice, previewLessonKey, SOURCE_LANG, type EditionAccess } from "./lib";
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

// The Guest's Edition plus their access level (paid marketplace, ADR 0016). A
// valid Public link is the Guest's grant: on a FREE Edition it resolves to
// `viewer` (today's anonymous full read); on a PAID Edition it resolves to
// `preview`, so a Guest sees only the free first Lesson + the table of contents.
// The single access resolver (`editionAccessLevel`) decides, exactly as it does
// for the authed reader — this seam only supplies the token-based grant.
async function resolveGuestEdition(
  ctx: QueryCtx,
  token: string,
): Promise<{ topic: Doc<"topics">; lang: string; level: EditionAccess } | null> {
  const resolved = await resolveEdition(ctx, token);
  if (!resolved) return null;
  const level = await editionAccessLevel(ctx, resolved.topic, resolved.lang, null, true);
  return { ...resolved, level };
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
      // Present only on a PAID Edition (paid marketplace): the price and which
      // Lesson is the free Preview, so a Guest sees the paygate. On a free
      // Edition it is absent and the Guest reads everything, exactly as today.
      paywall: v.optional(
        v.object({ amount: v.number(), currency: v.string(), previewKey: v.union(v.string(), v.null()) }),
      ),
    }),
  ),
  handler: async (ctx, { token }) => {
    const resolved = await resolveGuestEdition(ctx, token);
    if (!resolved) return null;
    const { topic, lang, level } = resolved;
    // On a paid Edition a Guest is `preview`: the table of contents (Lesson &
    // Reference titles) still renders so the paygate has structure, but the paid
    // material — Resources, the owner's Progress, and Q&A — is withheld, and the
    // per-Lesson bodies are locked in publicLesson. A free Edition is `viewer`
    // and unchanged.
    const preview = level === "preview";
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
    let paywall: { amount: number; currency: string; previewKey: string | null } | undefined;
    if (preview) {
      const price = await editionPrice(ctx, topic._id, lang);
      if (price) {
        paywall = { amount: price.amount, currency: price.currency, previewKey: await previewLessonKey(ctx, topic._id) };
      }
    }
    return {
      title,
      lang,
      dir: langInfo(lang).rtl ? ("rtl" as const) : ("ltr" as const),
      lessons,
      references,
      // Paid material is withheld from a Guest until they buy; the TOC above stays.
      resources: preview ? [] : resources,
      progress: preview ? [] : progress,
      questions: preview ? [] : questions,
      paywall,
    };
  },
});

// One Lesson's HTML for a Guest. Null for an unknown/wrong token, an unknown key,
// or a superseded Lesson (mirrors the authed getLesson).
export const publicLesson = query({
  args: { token: v.string(), key: v.string() },
  returns: v.union(
    v.null(),
    v.object({ key: v.string(), seq: v.number(), title: v.string(), html: v.string(), locked: v.boolean() }),
  ),
  handler: async (ctx, { token, key }) => {
    const resolved = await resolveGuestEdition(ctx, token);
    if (!resolved) return null;
    const { topic, lang, level } = resolved;
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
    const title = decodeEntities(t?.title ?? lesson.title);
    // Paygate: on a paid Edition (`preview`) only the Preview Lesson's body is
    // served; every other Lesson is a locked marker (never a bare null 404).
    if (level === "preview" && key !== (await previewLessonKey(ctx, topic._id))) {
      return { key: lesson.key, seq: lesson.seq, title, html: "", locked: true };
    }
    return { key: lesson.key, seq: lesson.seq, title, html: t?.html ?? lesson.html, locked: false };
  },
});

// One Reference's HTML for a Guest. Null for an unknown/wrong token or key.
export const publicReference = query({
  args: { token: v.string(), key: v.string() },
  returns: v.union(
    v.null(),
    v.object({ key: v.string(), title: v.string(), html: v.string(), locked: v.boolean() }),
  ),
  handler: async (ctx, { token, key }) => {
    const resolved = await resolveGuestEdition(ctx, token);
    if (!resolved) return null;
    const { topic, lang, level } = resolved;
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
    const title = decodeEntities(t?.title ?? ref.title);
    // References sit entirely past the Preview — locked for a `preview` Guest.
    if (level === "preview") return { key: ref.key, title, html: "", locked: true };
    return { key: ref.key, title, html: t?.html ?? ref.html, locked: false };
  },
});
