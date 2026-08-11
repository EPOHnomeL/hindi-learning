import { v } from "convex/values";
import { query, type QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { buildPaywall, editionAccessLevel, lessonsToc, paywallValidator, loadEdition, readLesson, readReference, referencesToc, SOURCE_LANG, type EditionAccess } from "./lib";
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

// The Guest's token → Edition lookup: a Public link fixes exactly one Edition
// (there is no selection ladder Guest-side — cf. the authed `resolveEdition` seam
// in lib.ts, which is a different, request-vs-held resolver).
async function guestEditionFromToken(ctx: QueryCtx, token: string): Promise<{ topic: Doc<"topics">; lang: string } | null> {
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
  const resolved = await guestEditionFromToken(ctx, token);
  if (!resolved) return null;
  const level = await editionAccessLevel(ctx, resolved.topic, resolved.lang, null, true);
  return { ...resolved, level };
}

// The language of the Edition a Public link serves — the Guest's chrome-language
// hint (app-language-i18n). A shared link is for ONE Edition, so its language is
// the best guess at the language the Guest reads; the middleware asks for it on a
// cookieless `/share/<token>` request so the chrome paints in that language on
// first paint. Deliberately the cheapest read in this file (token → Edition, no
// content, no access resolution) so that guess never pays for the whole bundle,
// and it leaks nothing a Guest holding the token can't already see. Null for an
// unknown/revoked token — same "reveals nothing" contract as the rest of the seam.
export const publicEditionLang = query({
  args: { token: v.string() },
  returns: v.union(v.null(), v.string()),
  handler: async (ctx, { token }) => (await guestEditionFromToken(ctx, token))?.lang ?? null,
});

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
      // The Topic slug — not secret (it's the course identifier), exposed so a
      // Guest on a paid Edition can start checkout (paid marketplace, ADR 0016).
      slug: v.string(),
      // The Edition this token serves + its text direction (course-translation).
      lang: v.string(),
      dir: v.union(v.literal("ltr"), v.literal("rtl")),
      // The served Edition's mission (translated, English fallback), null when the
      // course has none — the welcome panel's "what is this course for" line
      // (welcome/01). Deliberately served on a paid Edition too: like the title and
      // the table of contents, the mission is what makes the paygate legible, not
      // paid material.
      mission: v.union(v.string(), v.null()),
      // The course's tenant subdomain label, null for a default-site course
      // (welcome/01). Not secret — it is the public host every canonical link to
      // this course already carries — and needed because `/share/<token>` has no
      // canonical-host bounce: a Guest can be reading a tenanted course on the
      // apex, where "/" is the wrong front door.
      tenantSlug: v.union(v.string(), v.null()),
      // `locked` is the server's paygate verdict per item (architecture-deepening
      // /03) — the Guest's nav reads it rather than re-deriving it from `paywall`.
      lessons: v.array(v.object({ key: v.string(), seq: v.number(), title: v.string(), locked: v.boolean() })),
      references: v.array(v.object({ key: v.string(), title: v.string(), locked: v.boolean() })),
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
      paywall: v.optional(paywallValidator),
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
    // One Edition reader for both profiles: `map()` (memoised, backs the TOC lists)
    // and the single-item `mission()` point-read.
    const ed = loadEdition(ctx, topic, lang);
    // The Guest bundle is a full mirror: course title, both TOCs and the Q&A.
    const m = await ed.map(["title", "lesson", "reference", "question"]);

    // The table of contents uses the shared TOC projections (edition-deepening/04);
    // the resources/progress/questions full-mirror below stays Guest-only, behind
    // the explicit output allowlist (anonymous, public-internet-facing).
    const lessons = await lessonsToc(ctx, topic, m, level);
    const references = await referencesToc(ctx, topic, m, level);

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
            const { text, reply } = m.question(q);
            return { id: q._id, lessonKey: q.lessonKey, text, status: q.status, reply };
          })
      : [];

    const title = m.title(topic);
    const paywall = preview ? await buildPaywall(ctx, topic._id, lang) : undefined;
    return {
      title,
      slug: topic.slug,
      lang,
      dir: langInfo(lang).rtl ? ("rtl" as const) : ("ltr" as const),
      // The welcome panel's orientation (welcome/01) — see the validator above for
      // why both are served even on a paid Edition.
      mission: await ed.mission(),
      tenantSlug: topic.tenantSlug ?? null,
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
  // A locked marker (paid Edition, past the Preview) OR the body: `contentUrl`
  // (content blob) or inline `html` during the migration — exactly one body form
  // is present (see .scratch/html-blob-storage).
  returns: v.union(
    v.null(),
    v.object({
      key: v.string(),
      seq: v.number(),
      title: v.string(),
      locked: v.boolean(),
      contentUrl: v.optional(v.string()),
      html: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, { token, key }) => {
    const resolved = await resolveGuestEdition(ctx, token);
    if (!resolved) return null;
    // Same shared reader core as the authed getLesson (edition-deepening/04); this
    // adapter only resolves the Guest principal via its Public-link token.
    return await readLesson(ctx, resolved.topic, resolved.lang, resolved.level, key);
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
      locked: v.boolean(),
      contentUrl: v.optional(v.string()),
      html: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, { token, key }) => {
    const resolved = await resolveGuestEdition(ctx, token);
    if (!resolved) return null;
    return await readReference(ctx, resolved.topic, resolved.lang, resolved.level, key);
  },
});
