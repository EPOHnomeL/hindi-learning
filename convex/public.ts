import { v } from "convex/values";
import { query, type QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { buildPaywall, editionAccessLevel, editionPrice, lessonsToc, livePublishedLangs, paywallValidator, loadEdition, publishedLangs, readLesson, readReference, referencesToc, type EditionAccess } from "./edition";
import { topicBySlug } from "./topicAccess";
import { SOURCE_LANG } from "./sourceLang";
import { teacherQaOn } from "./capture";
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
// in edition.ts, which is a different, request-vs-held resolver).
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

// The SECOND Guest entrance (2026-09-08): the course's own pretty URL,
// `/courses/<slug>`, serving the same Guest reader as `/share/<token>` with no
// bearer token, so a course can be shared on a link that reads like a course.
//
// It opens for exactly one kind of Edition: **published AND priced**. That is the
// shopfront case, where the free Preview (the first Lesson) is the advertisement
// and everything past it is the paygate, so nothing is given away here that the
// paygate was not already giving away on `/share`. A published FREE Edition
// deliberately does NOT open here: free access is worth an account, so the
// sign-in gate stays and the surface asks the visitor to create one. An
// unpublished course is not public at all. Both resolve to null, and the client
// falls back to `SignIn`.
//
// `requested` is the reader's `?lang=` (course-translation), honoured when that
// Edition is published; otherwise the English source Edition, else the lowest
// published code, so a URL carrying no language still lands somewhere real.
async function guestEditionFromSlug(
  ctx: QueryCtx,
  slug: string,
  requested: string | null,
): Promise<{ topic: Doc<"topics">; lang: string } | null> {
  if (!slug) return null;
  const topic = await topicBySlug(ctx, slug);
  if (!topic) return null;
  const live = await livePublishedLangs(ctx, topic._id);
  const lang =
    requested && live.has(requested) ? requested : live.has(SOURCE_LANG) ? SOURCE_LANG : [...live].sort()[0];
  if (!lang) return null;
  // Priced only. The presence of a `listings` row is the single source of truth
  // for "paid" (edition.ts); a free published Edition falls through to sign-in.
  if ((await editionPrice(ctx, topic._id, lang)) === null) return null;
  return { topic, lang };
}

// Where a Guest read came from: the bearer-token link, or the course's own URL.
// One shared arg shape across the three queries below, so both entrances render
// the identical reader and the client only picks which fields it sends.
const guestSource = {
  token: v.optional(v.string()),
  slug: v.optional(v.string()),
  lang: v.optional(v.string()),
};
type GuestSource = { token?: string; slug?: string; lang?: string };

async function guestEdition(ctx: QueryCtx, src: GuestSource) {
  if (src.token) return await guestEditionFromToken(ctx, src.token);
  if (src.slug) return await guestEditionFromSlug(ctx, src.slug, src.lang ?? null);
  return null;
}

// The Guest's Edition plus their access level (paid marketplace, ADR 0016). A
// valid Public link is the Guest's grant: on a FREE Edition it resolves to
// `viewer` (today's anonymous full read); on a PAID Edition it resolves to
// `preview`, so a Guest sees only the free first Lesson + the table of contents.
// The single access resolver (`editionAccessLevel`) decides, exactly as it does
// for the authed reader — this seam only supplies the token-based grant.
async function resolveGuestEdition(
  ctx: QueryCtx,
  src: GuestSource,
): Promise<{ topic: Doc<"topics">; lang: string; level: EditionAccess } | null> {
  const resolved = await guestEdition(ctx, src);
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

// The course's LIVE Editions (course-poster): the languages a stranger can actually
// read today, i.e. a ready Edition that is reachable by a Public link or listed in
// the tenant catalogue (the publish grain, ADR 0024). The poster's footer counts
// and names these, so it says "available in N languages" only for languages that
// are true on the day it prints. Nothing here is new information: the signed-in
// catalogue and the Editions panel already show every one of these facts. Sorted
// by code; the poster model orders them for display.
async function liveLanguages(ctx: QueryCtx, topic: Doc<"topics">): Promise<{ lang: string; native: string }[]> {
  const jobs = await ctx.db.query("translationJobs").withIndex("by_topic", (q) => q.eq("topicId", topic._id)).collect();
  const ready = new Set([SOURCE_LANG, ...jobs.filter((j) => j.status === "ready").map((j) => j.lang)]);
  const links = await ctx.db.query("publicLinks").withIndex("by_topic", (q) => q.eq("topicId", topic._id)).collect();
  const reachable = new Set(links.map((l) => l.lang));
  // Legacy: the pre-translation per-Topic token is the English link.
  if (topic.publicToken) reachable.add(SOURCE_LANG);
  for (const lang of await publishedLangs(ctx, topic._id)) reachable.add(lang);
  return [...ready]
    .filter((lang) => reachable.has(lang))
    .sort((a, b) => a.localeCompare(b))
    .map((lang) => ({ lang, native: langInfo(lang).native }));
}

// Everything a Guest needs to render the course shell + read-only panels, in one
// reactive bundle: the sidebar lists, Resources, and the owner's Progress and
// Q&A (full mirror, ADR 0013). Per-artifact HTML is fetched on demand by
// publicLesson / publicReference. Returns null for an invalid/unknown token.
// ponytail: the row shapes mirror the authed reader queries (content/capture/
// resources); kept as an explicit allowlist here so a Guest can never see a
// field the authed side adds without it being deliberately re-listed.
export const publicCourse = query({
  args: guestSource,
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
      // Teacher Q&A (teacher-qa): whether this course offers a question channel.
      // The Guest's half of the pair with `content.reader.courseHeader`, so the
      // Guest reader branches on the boolean rather than on `questions` being
      // empty. Resolved through `teacherQaOn`, so an unset field arrives as `true`.
      teacherQa: v.boolean(),
      // Present only on a PAID Edition (paid marketplace): the price and which
      // Lesson is the free Preview, so a Guest sees the paygate. On a free
      // Edition it is absent and the Guest reads everything, exactly as today.
      paywall: v.optional(paywallValidator),
      // The course's live Editions (course-poster): the poster's language line.
      // See liveLanguages for what "live" means and why it leaks nothing.
      languages: v.array(v.object({ lang: v.string(), native: v.string() })),
    }),
  ),
  handler: async (ctx, src) => {
    const resolved = await resolveGuestEdition(ctx, src);
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
    // Teacher Q&A off (teacher-qa, CONTEXT.md): the owner's thread is withheld
    // from the PAYLOAD, not hidden in the DOM. This is the reason the setting
    // gates the read path at all, against `assertTenantFlag`'s rule that a flag
    // never does: this bundle is anonymous and public, so a client-side hide
    // would leave the thread readable in devtools. Twin gate in
    // capture.myQuestions; please do not "fix" either back. Rows are never
    // deleted, so switching the setting on restores the thread.
    const qaOn = teacherQaOn(topic);
    const questions = ownerId && qaOn
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
      teacherQa: qaOn,
      paywall,
      languages: await liveLanguages(ctx, topic),
    };
  },
});

// One Lesson's HTML for a Guest. Null for an unknown/wrong token, an unknown key,
// or a superseded Lesson (mirrors the authed getLesson).
export const publicLesson = query({
  args: { ...guestSource, key: v.string() },
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
  handler: async (ctx, { key, ...src }) => {
    const resolved = await resolveGuestEdition(ctx, src);
    if (!resolved) return null;
    // Same shared reader core as the authed getLesson (edition-deepening/04); this
    // adapter only resolves the Guest principal via its Public-link token.
    return await readLesson(ctx, resolved.topic, resolved.lang, resolved.level, key);
  },
});

// One Reference's HTML for a Guest. Null for an unknown/wrong token or key.
export const publicReference = query({
  args: { ...guestSource, key: v.string() },
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
  handler: async (ctx, { key, ...src }) => {
    const resolved = await resolveGuestEdition(ctx, src);
    if (!resolved) return null;
    return await readReference(ctx, resolved.topic, resolved.lang, resolved.level, key);
  },
});
