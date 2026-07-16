import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { action, internalMutation, internalQuery, mutation, query, type ActionCtx, type QueryCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { assertAdmin, buildPaywall, getEditableTopic, getOwnedTopic, heldLangs, lessonLocked, pickContentBody, resolveReaderEdition, SOURCE_LANG, topicBySlug, topicLessonCounts } from "./lib";
import { langInfo } from "./languages";
import { itemHash, quizStructureMatches } from "./translate";
import { assertEmblemImage, normaliseGlyph } from "./emblem";
import { isCallerAdmin, isEmailAdmitted } from "./whitelist";

// A learner may seed at most one new course per this window — an anti-abuse / cost
// cap that mirrors the routine's per-user on-demand cap. Rolling 24h window.
const DAY_MS = 24 * 60 * 60 * 1000;

// Lessons & references. Reader queries are auth-gated and owner-scoped: a Topic
// is resolved by (owner = signed-in user, slug), so one learner never sees
// another's content. Publish mutations are called by the teach CLI
// (`pnpm run publish`) and guarded by PUBLISH_SECRET; they resolve the owner
// from `ownerEmail` (the operator has no auth identity) and thread the resulting
// topicId through.

// Titles are authored upstream from generated HTML and can arrive entity-encoded
// (e.g. "Maps &amp; List"). Decode the handful of named/numeric entities that
// show up in plain-text titles so the UI never renders a raw "&amp;".
// ponytail: covers the common entities; extend the map if a new one appears.
export function decodeEntities(s: string): string {
  return s.replace(/&(amp|lt|gt|quot|#39|apos);/g, (_, e) =>
    ({ amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", apos: "'" })[e as string] ?? _,
  );
}

// ---- Editions (course translation) ----------------------------------------

// One translated item for an Edition, or null (source language, or not yet
// translated — the caller then falls back to the English source row).
async function trOne(
  ctx: QueryCtx,
  topicId: Id<"topics">,
  lang: string,
  kind: "lesson" | "reference" | "mission" | "title" | "question",
  key: string,
): Promise<Doc<"translations"> | null> {
  if (lang === SOURCE_LANG) return null;
  return await ctx.db
    .query("translations")
    .withIndex("by_topic_lang_kind_key", (q) =>
      q.eq("topicId", topicId).eq("lang", lang).eq("kind", kind).eq("key", key),
    )
    .unique();
}

// All of one Edition's translated rows for a Topic, keyed `${kind}:${key}` — a
// single read for list queries. Empty for the source language.
async function editionMap(ctx: QueryCtx, topicId: Id<"topics">, lang: string): Promise<Map<string, Doc<"translations">>> {
  if (lang === SOURCE_LANG) return new Map();
  const rows = await ctx.db
    .query("translations")
    .withIndex("by_topic_lang", (q) => q.eq("topicId", topicId).eq("lang", lang))
    .collect();
  return new Map(rows.map((r) => [`${r.kind}:${r.key}`, r]));
}

// The Editions the caller may switch between on a Topic (owner: source + every
// ready translation; Viewer: their granted languages), with display metadata.
async function switcherEditions(ctx: QueryCtx, topic: Doc<"topics">, userId: Id<"users">) {
  const held = await heldLangs(ctx, topic, userId);
  return [...held].sort().map((l) => {
    const i = langInfo(l);
    return {
      lang: l,
      name: l === SOURCE_LANG ? "English" : i.name,
      native: l === SOURCE_LANG ? "English" : i.native,
      rtl: l === SOURCE_LANG ? false : !!i.rtl,
    };
  });
}

// ---- Reader (learner) ------------------------------------------------------

// The signed-in user's Topics, ordered by `seq` (unsequenced last), then age.
export const listTopics = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const topics = await ctx.db
      .query("topics")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .collect();
    return topics
      .sort((a, b) => (a.seq ?? Infinity) - (b.seq ?? Infinity) || a._creationTime - b._creationTime)
      .map((t) => ({ slug: t.slug, title: t.title, seq: t.seq, status: t.status ?? "active", mission: t.mission ?? null }));
  },
});

// The home dashboard: the signed-in user's Topics as cards, each with its live
// lesson count + how many they've completed (for a progress indicator).
export const dashboard = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const topics = await ctx.db
      .query("topics")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .collect();
    const cards = await Promise.all(
      topics.map(async (t) => {
        const counts = await topicLessonCounts(ctx, t._id, userId);
        // The soft `~N lessons` estimate (PRD: Estimated lesson count). Owner-only
        // by construction — this query only returns the caller's OWN topics, so it
        // never reaches a Viewer's shared card (listSharedTopics). Shown only while
        // the course is being built (hidden while `seeded` / `completed`) and
        // clamped up to the published count so it never reads below the real total.
        const estimatedLessons =
          t.estimatedLessons !== undefined && t.status !== "seeded" && t.status !== "completed"
            ? Math.max(t.estimatedLessons, counts.lessonCount)
            : null;
        // Ready translation Editions, for the card's language chips (grouping the
        // course's languages together in one place, per the design).
        const jobs = await ctx.db
          .query("translationJobs")
          .withIndex("by_topic", (q) => q.eq("topicId", t._id))
          .collect();
        const editions = jobs
          .filter((j) => j.status === "ready")
          .map((j) => j.lang)
          .sort();
        return {
          slug: t.slug,
          title: t.title,
          status: t.status ?? "active",
          mission: t.mission ?? null,
          // The owner's own Public link token (null when private) — drives the
          // "Public" badge and the SharePanel's link controls. Owner-only query,
          // so this is never exposed to anyone but the owner.
          publicToken: t.publicToken ?? null,
          estimatedLessons,
          editions,
          seq: t.seq,
          creationTime: t._creationTime,
          ...counts,
        };
      }),
    );
    return cards.sort((a, b) => (a.seq ?? Infinity) - (b.seq ?? Infinity) || a.creationTime - b.creationTime);
  },
});

// Start a Topic from the dashboard: title + free-text "why" (the Seed). The
// Routine turns the Seed into a Mission + first Lesson on its next run; no LLM
// runs here (ADR 0001). Slugs are globally unique (the routine path resolves by
// slug), so identical titles get -2/-3 suffixes.
export const seedTopic = mutation({
  // `provider` (ADR 0014) is chosen at creation; omit for the Claude default so
  // an absent value on the row reads as `claude` (schema + fire branch agree).
  args: {
    title: v.string(),
    why: v.string(),
    provider: v.optional(v.union(v.literal("claude"), v.literal("openrouter"))),
  },
  handler: async (ctx, { title, why, provider }): Promise<{ slug: string }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("unauthenticated");
    // Course creation is Allowlist-gated (ADR 0021): sign-up is open, so the
    // Allowlist is what stands between anyone-with-an-account and Claude
    // generation spend. The Admin's own row admits them like any member.
    const user = await ctx.db.get(userId);
    if (!user?.email || !(await isEmailAdmitted(ctx, user.email))) {
      throw new Error("Course creation is limited to Allowlisted emails.");
    }
    // One new course per user per day (issue 08 — bounds Claude usage). The Admin
    // is exempt (they drive the app and aren't the runaway-usage risk this guards
    // against, mirroring the routine's on-demand bypass). Checked against the
    // user's most recent Topic, so their first course is never blocked.
    if (!(await isCallerAdmin(ctx))) {
      const newest = await ctx.db
        .query("topics")
        .withIndex("by_owner", (q) => q.eq("ownerId", userId))
        .order("desc")
        .first();
      if (newest && Date.now() - newest._creationTime < DAY_MS) {
        throw new Error("You can create one new course per day. Please try again tomorrow.");
      }
    }
    const base = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "topic";
    let slug = base;
    for (let n = 2; await topicBySlug(ctx, slug); n++) slug = `${base}-${n}`;
    // Store `provider` only when explicitly OpenRouter — the Claude default stays
    // absent, so existing courses and a defaulted create are indistinguishable.
    await ctx.db.insert("topics", {
      slug,
      title,
      ownerId: userId,
      seed: why,
      status: "seeded",
      ...(provider === "openrouter" ? { provider } : {}),
    });
    return { slug };
  },
});

// The learner curating their own "why" — editing the Mission text (not authoring
// a Lesson, so it doesn't break "no authoring in the web", ADR 0001). The edit
// round-trips into MISSION.md at the next materialise.
export const editMission = mutation({
  args: { topicSlug: v.string(), mission: v.string() },
  handler: async (ctx, { topicSlug, mission }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("unauthenticated");
    const topic = await getOwnedTopic(ctx, userId, topicSlug);
    if (!topic) throw new Error("topic not found");
    await ctx.db.patch(topic._id, { mission });
  },
});

// Rename a Topic's display title. The slug is immutable (the routine + publish
// paths resolve by it), so only `title` changes.
export const renameTopic = mutation({
  args: { topicSlug: v.string(), title: v.string() },
  handler: async (ctx, { topicSlug, title }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("unauthenticated");
    const topic = await getOwnedTopic(ctx, userId, topicSlug);
    if (!topic) throw new Error("topic not found");
    const trimmed = title.trim();
    if (!trimmed) throw new Error("title required");
    await ctx.db.patch(topic._id, { title: trimmed });
  },
});

// ---- Owner prose edit (course-content-editing 01) --------------------------

// Mint an upload URL for the owner reader's in-place edit: the client PUTs the
// edited Lesson body straight to storage and passes the resulting storageId to
// `editLesson`, so the HTML never rides through a Convex function (mirrors the
// teach CLI's `generateContentUploadUrl`, but owner-guarded instead of
// secret-guarded). Owner-scoped to the Topic being edited so only its owner can
// mint an upload URL — the blob still does nothing until `editLesson` accepts it.
export const generateEditUploadUrl = mutation({
  args: { topicSlug: v.string() },
  returns: v.string(),
  handler: async (ctx, { topicSlug }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("unauthenticated");
    const topic = await getOwnedTopic(ctx, userId, topicSlug);
    if (!topic) throw new Error("topic not found");
    return await ctx.storage.generateUploadUrl();
  },
});

// The current content blob of an owned, non-superseded source Lesson — for the
// quiz-structure guard, which needs the OLD body's markup. Owner-guarded; throws
// (rather than returning null) so `editLesson` surfaces the reason. Blob bytes
// aren't readable in a query, so only the storageId is returned; the action reads
// the bytes itself.
export const lessonEditTarget = internalQuery({
  args: { topicSlug: v.string(), key: v.string() },
  returns: v.object({ storageId: v.union(v.id("_storage"), v.null()) }),
  handler: async (ctx, { topicSlug, key }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("unauthenticated");
    // Owner OR an Editor of the English (source) edition (ADR 0020).
    const topic = await getEditableTopic(ctx, userId, topicSlug);
    if (!topic) throw new Error("topic not found");
    const lesson = await ctx.db
      .query("lessons")
      .withIndex("by_topic_key", (q) => q.eq("topicId", topic._id).eq("key", key))
      .unique();
    if (!lesson || lesson.supersededBy) throw new Error("lesson not found");
    return { storageId: lesson.htmlStorageId ?? null };
  },
});

// Swap an owned source Lesson's body blob and delete the superseded one (no
// orphan — PRD story 18). Owner-guarded again here: `editLesson` is the only
// caller, but the guard doesn't depend on it. The quiz-structure check has
// already run in the action (it needs the blob bytes); this just applies the swap.
export const applyLessonEdit = internalMutation({
  args: { topicSlug: v.string(), key: v.string(), storageId: v.id("_storage") },
  returns: v.null(),
  handler: async (ctx, { topicSlug, key, storageId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("unauthenticated");
    // Owner OR an Editor of the English (source) edition (ADR 0020).
    const topic = await getEditableTopic(ctx, userId, topicSlug);
    if (!topic) throw new Error("topic not found");
    const lesson = await ctx.db
      .query("lessons")
      .withIndex("by_topic_key", (q) => q.eq("topicId", topic._id).eq("key", key))
      .unique();
    if (!lesson || lesson.supersededBy) throw new Error("lesson not found");
    const old = lesson.htmlStorageId;
    await ctx.db.patch(lesson._id, { htmlStorageId: storageId });
    if (old && old !== storageId) await ctx.storage.delete(old);
    return null;
  },
});

async function blobText(ctx: ActionCtx, id: Id<"_storage">): Promise<string | null> {
  const blob = await ctx.storage.get(id);
  return blob ? await blob.text() : null;
}

// Owner corrects a source Lesson's body in place (amends ADR 0003): the client
// uploads the edited HTML (generateEditUploadUrl) and passes its storageId here.
// A Lesson stays structurally immutable — a save that changes the quiz's marker
// counts (data-correct/data-answer/data-k) is refused (`quizStructureMatches`),
// since scoring is positional. The guard needs both bodies' bytes, and
// `ctx.storage.get` is action-only, so the comparison lives here; the DB swap is
// delegated to `applyLessonEdit`. Owner-only: `lessonEditTarget` rejects anyone
// who isn't the Topic owner before any blob is touched. A refused edit's uploaded
// blob is deleted so a rejected save leaves no orphan.
export const editLesson = action({
  args: { topicSlug: v.string(), key: v.string(), storageId: v.id("_storage") },
  returns: v.null(),
  handler: async (ctx, { topicSlug, key, storageId }): Promise<null> => {
    const target = await ctx.runQuery(internal.content.lessonEditTarget, { topicSlug, key });
    // Read the edited body up front. The swap must NEVER proceed on an unreadable
    // upload (a bogus/consumed storageId): that would patch the lesson to a dead
    // blob and then delete the good previous body — silent, unrecoverable loss.
    const newHtml = await blobText(ctx, storageId);
    if (newHtml === null) throw new Error("The edited lesson couldn't be read back. Please try saving again.");
    // A lesson with a current body must keep its quiz-marker counts unchanged
    // (scoring is positional). If the current body can't be read, the edit can't
    // be verified against it — refuse rather than accept a possibly-structural
    // change. (A lesson with no stored body yet has nothing to preserve.)
    if (target.storageId) {
      const oldHtml = await blobText(ctx, target.storageId);
      if (oldHtml === null || !quizStructureMatches(oldHtml, newHtml)) {
        await ctx.storage.delete(storageId);
        throw new Error(
          oldHtml === null
            ? "Couldn't check this edit against the current lesson. Please refresh and try again."
            : "This edit changes the lesson's quiz structure, so it can't be saved. Reword the text without adding or removing quiz options or answers.",
        );
      }
    }
    // Guard passed. If the swap itself fails (e.g. the lesson was superseded in the
    // window since lessonEditTarget resolved), delete the upload so it doesn't orphan.
    try {
      await ctx.runMutation(internal.content.applyLessonEdit, { topicSlug, key, storageId });
    } catch (e) {
      await ctx.storage.delete(storageId);
      throw e;
    }
    return null;
  },
});

// Owner deletes one of their Lessons outright (e.g. a bad lesson a runaway
// fire-and-pray loop produced). Unlike `editLesson`'s in-place swap, this removes
// the row and cascades everything keyed to it so nothing dangles or skews:
//   - the content blob (no orphaned storage);
//   - its learning record (else the next authoring run's ZPD context references a
//     lesson that no longer exists);
//   - any predecessor this lesson retired (`supersededBy === key`) is un-hidden,
//     so deleting a replacement restores the original rather than losing both;
//   - the learner's progress / quiz responses / questions / translations for the
//     key (keeps completion counts honest and drops now-orphaned rows + blobs).
// Owner-guarded like the other content edits. Deleting the highest-seq (Frontier)
// lesson simply moves the Frontier back, so the course can regenerate from there.
export const deleteLesson = mutation({
  args: { topicSlug: v.string(), key: v.string() },
  returns: v.null(),
  handler: async (ctx, { topicSlug, key }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("unauthenticated");
    const topic = await getOwnedTopic(ctx, userId, topicSlug);
    if (!topic) throw new Error("topic not found");
    const lesson = await ctx.db
      .query("lessons")
      .withIndex("by_topic_key", (q) => q.eq("topicId", topic._id).eq("key", key))
      .unique();
    if (!lesson) throw new Error("lesson not found");

    // Un-hide any lesson this one superseded, so its predecessor isn't stranded.
    const predecessor = (
      await ctx.db.query("lessons").withIndex("by_topic_seq", (q) => q.eq("topicId", topic._id)).collect()
    ).find((l) => l.supersededBy === key);
    if (predecessor) await ctx.db.patch(predecessor._id, { supersededBy: undefined });

    // The lesson row + its body blob.
    if (lesson.htmlStorageId) await ctx.storage.delete(lesson.htmlStorageId);
    await ctx.db.delete(lesson._id);

    // Its learning record (append-only history keyed by the same key).
    const record = await ctx.db
      .query("learningRecords")
      .withIndex("by_topic_key", (q) => q.eq("topicId", topic._id).eq("key", key))
      .unique();
    if (record) await ctx.db.delete(record._id);

    // Learner capture keyed to this lesson (across every user of the Topic).
    const progress = (
      await ctx.db.query("progress").withIndex("by_topic_user_lesson", (q) => q.eq("topicId", topic._id)).collect()
    ).filter((p) => p.lessonKey === key);
    for (const p of progress) await ctx.db.delete(p._id);

    const responses = (
      await ctx.db.query("responses").withIndex("by_topic", (q) => q.eq("topicId", topic._id)).collect()
    ).filter((r) => r.lessonKey === key);
    for (const r of responses) await ctx.db.delete(r._id);

    const questions = (
      await ctx.db.query("questions").withIndex("by_topic_user", (q) => q.eq("topicId", topic._id)).collect()
    ).filter((qn) => qn.lessonKey === key);
    for (const qn of questions) await ctx.db.delete(qn._id);

    // Translated Editions of this lesson (any language), plus their body blobs.
    const translations = (
      await ctx.db.query("translations").withIndex("by_topic_lang", (q) => q.eq("topicId", topic._id)).collect()
    ).filter((t) => t.kind === "lesson" && t.key === key);
    for (const t of translations) {
      if (t.htmlStorageId) await ctx.storage.delete(t.htmlStorageId);
      await ctx.db.delete(t._id);
    }
    return null;
  },
});

// Owner corrects a Reference's body in place (course-content-editing 02).
// References are mutable by design (ADR 0003), so — unlike a Lesson — there is NO
// quiz-structure guard: any prose edit is accepted. That means no blob bytes need
// reading, so this is a plain owner-guarded mutation, not an action. `contentHash`
// is left untouched: it hashes the *source* (the teach CLI's skip-unchanged key),
// so keeping it means a later re-publish from an unchanged source won't clobber
// this manual edit — only a genuine source change overwrites it (current-wins).
// The prior blob is deleted (no orphan). The storageId is checked for existence
// first (a mutation can't read bytes, but `db.system.get` confirms the blob is
// real) so a bogus/consumed upload can't swap in a dead id and destroy the body.
export const editReference = mutation({
  args: { topicSlug: v.string(), key: v.string(), storageId: v.id("_storage") },
  returns: v.null(),
  handler: async (ctx, { topicSlug, key, storageId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("unauthenticated");
    // Owner OR an Editor of the English (source) edition — References are
    // English-source-only, so a translated-edition Editor never reaches here.
    const topic = await getEditableTopic(ctx, userId, topicSlug);
    if (!topic) throw new Error("topic not found");
    const ref = await ctx.db
      .query("references")
      .withIndex("by_topic_key", (q) => q.eq("topicId", topic._id).eq("key", key))
      .unique();
    if (!ref) throw new Error("reference not found");
    if (!(await ctx.db.system.get(storageId))) {
      throw new Error("The edited reference couldn't be read back. Please try saving again.");
    }
    const old = ref.htmlStorageId;
    await ctx.db.patch(ref._id, { htmlStorageId: storageId });
    if (old && old !== storageId) await ctx.storage.delete(old);
    return null;
  },
});

// ---- Owner prose edit of a translated Edition (course-content-editing 03) ----

// The source Lesson's blob for the quiz guard on an owned Topic's translated
// Lesson. Owner-guarded; throws on a non-owner, an unknown Lesson, or the source
// language (not an Edition). The apply mutation re-reads the translated row itself
// (to delete its old blob), so only the source is needed here.
export const translatedLessonEditTarget = internalQuery({
  args: { topicSlug: v.string(), key: v.string(), lang: v.string() },
  returns: v.object({ sourceStorageId: v.union(v.id("_storage"), v.null()) }),
  handler: async (ctx, { topicSlug, key, lang }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("unauthenticated");
    if (lang === SOURCE_LANG) throw new Error("not a translated edition");
    // Owner OR an Editor of THIS translated edition (ADR 0020) — an editor-Share
    // for lang X never authorises an edit to lang Y.
    const topic = await getEditableTopic(ctx, userId, topicSlug, lang);
    if (!topic) throw new Error("topic not found");
    const lesson = await ctx.db
      .query("lessons")
      .withIndex("by_topic_key", (q) => q.eq("topicId", topic._id).eq("key", key))
      .unique();
    if (!lesson || lesson.supersededBy) throw new Error("lesson not found");
    return { sourceStorageId: lesson.htmlStorageId ?? null };
  },
});

// Patch (or create) the translated Lesson row's body blob and delete the prior
// one. The source Lesson and every other Edition are untouched. `sourceHash` is
// stamped from the current source (the same key `publishTranslation` uses), so a
// later re-translate of an unchanged source skips this item and keeps the manual
// edit. When no row exists yet, insert one (correcting an untranslated term).
export const applyTranslatedLessonEdit = internalMutation({
  args: { topicSlug: v.string(), key: v.string(), lang: v.string(), storageId: v.id("_storage") },
  returns: v.null(),
  handler: async (ctx, { topicSlug, key, lang, storageId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("unauthenticated");
    if (lang === SOURCE_LANG) throw new Error("not a translated edition");
    // Owner OR an Editor of THIS translated edition (ADR 0020).
    const topic = await getEditableTopic(ctx, userId, topicSlug, lang);
    if (!topic) throw new Error("topic not found");
    const lesson = await ctx.db
      .query("lessons")
      .withIndex("by_topic_key", (q) => q.eq("topicId", topic._id).eq("key", key))
      .unique();
    if (!lesson || lesson.supersededBy) throw new Error("lesson not found");
    const sourceHash = itemHash("lesson", lesson);
    const row = await ctx.db
      .query("translations")
      .withIndex("by_topic_lang_kind_key", (q) => q.eq("topicId", topic._id).eq("lang", lang).eq("kind", "lesson").eq("key", key))
      .unique();
    if (row) {
      const old = row.htmlStorageId;
      // Clear any inline `html` (older translations stored the body inline) so the
      // row is blob-only going forward.
      await ctx.db.patch(row._id, { htmlStorageId: storageId, html: undefined, sourceHash });
      if (old && old !== storageId) await ctx.storage.delete(old);
    } else {
      // First edit of this item in this Edition (it was showing the English
      // fallback). No translated title — the reader falls back to the source title.
      await ctx.db.insert("translations", { topicId: topic._id, lang, kind: "lesson", key, htmlStorageId: storageId, sourceHash });
    }
    return null;
  },
});

// Owner corrects a translated Edition's Lesson body in place. Like `editLesson`
// but the guard compares the edit against the SOURCE Lesson's markers (positional
// scoring is shared across Editions, so a translation must keep the source's
// data-correct/data-answer/data-k counts — the same rule `publishTranslation`
// enforces). Owner-only (a Viewer of the Edition is rejected by `getOwnedTopic`),
// source untouched, live on the next tick. A rejected/failed save's upload is
// deleted so it can't orphan.
export const editTranslatedLesson = action({
  args: { topicSlug: v.string(), key: v.string(), lang: v.string(), storageId: v.id("_storage") },
  returns: v.null(),
  handler: async (ctx, { topicSlug, key, lang, storageId }): Promise<null> => {
    const target = await ctx.runQuery(internal.content.translatedLessonEditTarget, { topicSlug, key, lang });
    const newHtml = await blobText(ctx, storageId);
    if (newHtml === null) throw new Error("The edited lesson couldn't be read back. Please try saving again.");
    if (target.sourceStorageId) {
      const srcHtml = await blobText(ctx, target.sourceStorageId);
      if (srcHtml === null || !quizStructureMatches(srcHtml, newHtml)) {
        await ctx.storage.delete(storageId);
        throw new Error(
          srcHtml === null
            ? "Couldn't check this edit against the source lesson. Please refresh and try again."
            : "This edit changes the lesson's quiz structure, so it can't be saved. Reword the text without adding or removing quiz options or answers.",
        );
      }
    }
    try {
      await ctx.runMutation(internal.content.applyTranslatedLessonEdit, { topicSlug, key, lang, storageId });
    } catch (e) {
      await ctx.storage.delete(storageId);
      throw e;
    }
    return null;
  },
});

// Owner-driven Completion (ADR 0015): the owner concludes their own course — the
// escape hatch for open-ended missions the teach skill won't auto-terminate.
// Owner-only (a Viewer is refused by the owner gate, PRD story 9); once
// `completed`, the Routine's gate stops authoring. `reopenCourse` is the inverse,
// returning a completed course to `active` so authoring resumes — it never
// touches an earned Certificate (slice 2).
export const endCourse = mutation({
  args: { topicSlug: v.string() },
  handler: async (ctx, { topicSlug }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("unauthenticated");
    const topic = await getOwnedTopic(ctx, userId, topicSlug);
    if (!topic) throw new Error("topic not found");
    // A seeded course hasn't started — there's nothing to complete, and marking it
    // `completed` would strand it: the Routine's bootstrap fires only for `seeded`
    // (routine.ts), so a reopen (→ active) could never draft its first Lesson.
    // Keeping "completed ⟹ was active" also makes `reopenCourse` → active correct.
    if (topic.status === "seeded") throw new Error("course hasn't started");
    await ctx.db.patch(topic._id, { status: "completed" });
  },
});

export const reopenCourse = mutation({
  args: { topicSlug: v.string() },
  handler: async (ctx, { topicSlug }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("unauthenticated");
    const topic = await getOwnedTopic(ctx, userId, topicSlug);
    if (!topic) throw new Error("topic not found");
    await ctx.db.patch(topic._id, { status: "active" });
  },
});

// The reader's per-course header: the Topic's title plus the caller's access
// level ("owner" vs read-only "viewer"). Resolves through the owner-or-Viewer
// gate, so a Viewer gets the title (their owner-only `listTopics` never carries
// the shared Topic) and the UI learns whether to show write controls. `null`
// when signed-out or with no access — the route then renders not-found.
export const courseHeader = query({
  args: { topicSlug: v.string(), lang: v.optional(v.string()) },
  returns: v.union(
    v.null(),
    v.object({
      title: v.string(),
      // The caller's access level to the served Edition (paid marketplace). An
      // `entitled` buyer reads exactly like a `viewer`; a `preview` caller sees
      // only the free first Lesson of a paid Edition (the rest is locked).
      role: v.union(v.literal("owner"), v.literal("viewer"), v.literal("entitled"), v.literal("preview")),
      // Whether the caller may make the in-place prose edits on the SERVED
      // Edition (ADR 0020): the owner, or an Editor of this `lang`. The reader
      // gates its hover-pencil on this, NOT on `role` — a Viewer of one Edition
      // may be an Editor of another, so edit rights are per-Edition, not per-role.
      canEdit: v.boolean(),
      // The reader reads `status` to switch affordances: `completed` (ADR 0015)
      // hides "Generate next lesson" and shows the owner's Reopen control.
      status: v.union(v.literal("seeded"), v.literal("active"), v.literal("completed")),
      // The Edition actually being served (honours `lang` only if the caller
      // holds it), its text direction, and the Editions they can switch to.
      lang: v.string(),
      dir: v.union(v.literal("ltr"), v.literal("rtl")),
      editions: v.array(
        v.object({ lang: v.string(), name: v.string(), native: v.string(), rtl: v.boolean() }),
      ),
      // The served Edition's mission (translated, English fallback) — pre-fills
      // the edition title/mission edit dialog. Null when the course has none.
      mission: v.union(v.string(), v.null()),
      // Present only for a `preview` caller: the paid Edition's price and which
      // Lesson is the free Preview, so the reader can render the paygate.
      paywall: v.optional(
        v.object({ amount: v.number(), currency: v.string(), previewKey: v.union(v.string(), v.null()) }),
      ),
    }),
  ),
  handler: async (ctx, { topicSlug, lang }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const topic = await topicBySlug(ctx, topicSlug);
    if (!topic) return null;
    const { lang: effLang, level } = await resolveReaderEdition(ctx, topic, userId, lang ?? null);
    // `level` is now narrowed to the four access roles (the returns validator's
    // union) — the "none" case is not-found above, so `role` is just `level`.
    if (level === "none") return null;
    const role = level;
    // Per-Edition edit capability (ADR 0020), same logic as the edit mutations'
    // guard: owner, or an Editor of the served lang.
    const canEdit = (await getEditableTopic(ctx, userId, topicSlug, effLang)) !== null;
    const t = await trOne(ctx, topic._id, effLang, "title", "");
    const m = topic.mission ? await trOne(ctx, topic._id, effLang, "mission", "") : null;
    const editions = await switcherEditions(ctx, topic, userId);
    const paywall = level === "preview" ? await buildPaywall(ctx, topic._id, effLang) : undefined;
    return {
      title: decodeEntities(t?.text ?? topic.title),
      mission: topic.mission ? decodeEntities(m?.text ?? topic.mission) : null,
      role,
      canEdit,
      status: topic.status ?? "active",
      lang: effLang,
      dir: langInfo(effLang).rtl ? ("rtl" as const) : ("ltr" as const),
      editions,
      paywall,
    };
  },
});

export const listLessons = query({
  args: { topicSlug: v.string(), lang: v.optional(v.string()) },
  handler: async (ctx, { topicSlug, lang }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const topic = await topicBySlug(ctx, topicSlug);
    if (!topic) return [];
    // The table of contents is served in full even to a `preview` caller (only
    // the Lesson *bodies* past the Preview are locked, in getLesson); `none` is
    // not-found (a free Edition the caller holds no grant to).
    const { lang: effLang, level } = await resolveReaderEdition(ctx, topic, userId, lang ?? null);
    if (level === "none") return [];
    const lessons = (
      await ctx.db.query("lessons").withIndex("by_topic_seq", (q) => q.eq("topicId", topic._id)).collect()
    ).filter((l) => !l.supersededBy);
    const tmap = await editionMap(ctx, topic._id, effLang);
    return lessons.map((l) => ({
      key: l.key,
      seq: l.seq,
      title: decodeEntities(tmap.get(`lesson:${l.key}`)?.title ?? l.title),
    }));
  },
});

export const getLesson = query({
  args: { topicSlug: v.string(), key: v.string(), lang: v.optional(v.string()) },
  handler: async (ctx, { topicSlug, key, lang }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const topic = await topicBySlug(ctx, topicSlug);
    if (!topic) return null;
    const { lang: effLang, level } = await resolveReaderEdition(ctx, topic, userId, lang ?? null);
    if (level === "none") return null;
    const lesson = await ctx.db
      .query("lessons")
      .withIndex("by_topic_key", (q) => q.eq("topicId", topic._id).eq("key", key))
      .unique();
    if (!lesson || lesson.supersededBy) return null;
    const t = await trOne(ctx, topic._id, effLang, "lesson", key);
    const title = decodeEntities(t?.title ?? lesson.title);
    // Paygate: on a paid Edition the caller doesn't hold (`preview`), only the
    // Preview — the lowest-ordered non-superseded Lesson — is served; every other
    // Lesson returns an explicit `locked` marker, distinct from a not-found null.
    if (await lessonLocked(ctx, topic._id, level, key)) {
      return { key: lesson.key, seq: lesson.seq, title, html: "", locked: true };
    }
    return {
      key: lesson.key,
      seq: lesson.seq,
      title,
      locked: false,
      // The body is served as a content URL (content blob) or, on transition
      // rows, inline html — from the translated row if it has one, else source.
      ...pickContentBody(t, lesson),
    };
  },
});

export const listReferences = query({
  args: { topicSlug: v.string(), lang: v.optional(v.string()) },
  handler: async (ctx, { topicSlug, lang }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const topic = await topicBySlug(ctx, topicSlug);
    if (!topic) return [];
    // References are past the Preview, but their titles ride along in the table
    // of contents even for a `preview` caller (the bodies are locked in
    // getReference). `none` is not-found.
    const { lang: effLang, level } = await resolveReaderEdition(ctx, topic, userId, lang ?? null);
    if (level === "none") return [];
    const refs = await ctx.db
      .query("references")
      .withIndex("by_topic", (q) => q.eq("topicId", topic._id))
      .collect();
    const tmap = await editionMap(ctx, topic._id, effLang);
    return refs
      .sort((a, b) => a.key.localeCompare(b.key))
      .map((r) => ({ key: r.key, title: decodeEntities(tmap.get(`reference:${r.key}`)?.title ?? r.title) }));
  },
});

export const getReference = query({
  args: { topicSlug: v.string(), key: v.string(), lang: v.optional(v.string()) },
  handler: async (ctx, { topicSlug, key, lang }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const topic = await topicBySlug(ctx, topicSlug);
    if (!topic) return null;
    const { lang: effLang, level } = await resolveReaderEdition(ctx, topic, userId, lang ?? null);
    if (level === "none") return null;
    const ref = await ctx.db
      .query("references")
      .withIndex("by_topic_key", (q) => q.eq("topicId", topic._id).eq("key", key))
      .unique();
    if (!ref) return null;
    const t = await trOne(ctx, topic._id, effLang, "reference", key);
    const title = decodeEntities(t?.title ?? ref.title);
    // References sit entirely past the Preview — locked for a `preview` caller.
    if (level === "preview") return { key: ref.key, title, html: "", locked: true };
    return { key: ref.key, title, locked: false, ...pickContentBody(t, ref) };
  },
});

// ---- Publish (teach CLI, PUBLISH_SECRET-guarded) ---------------------------

// Mint an upload URL for a content blob (a Lesson / Reference body). The teach
// CLI `PUT`s the HTML straight to storage and passes the resulting storageId to
// the publish mutations, so the HTML never rides through a Convex function (see
// .scratch/html-blob-storage). Secret-guarded like the other teach seams.
export const generateContentUploadUrl = mutation({
  args: { secret: v.string() },
  returns: v.string(),
  handler: async (ctx, { secret }) => {
    assertAdmin(secret);
    return await ctx.storage.generateUploadUrl();
  },
});

// Resolve the Topic's owner from email, then create the owned Topic or backfill
// `ownerId` on the pre-existing unowned row (the legacy Hindi topic). Returns
// the topicId the rest of the publish run threads through.
// ponytail: by_slug.unique() assumes one Topic per slug globally — true until
// issue 05 owner-scopes the routine/publish path; multi-owner same-slug needs that.
export const ensureTopic = mutation({
  args: { secret: v.string(), ownerEmail: v.string(), slug: v.string(), title: v.string() },
  handler: async (ctx, { secret, ownerEmail, slug, title }): Promise<Id<"topics">> => {
    assertAdmin(secret);
    const owner = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", ownerEmail))
      .unique();
    if (!owner) throw new Error(`no registered user with email ${ownerEmail} — register first`);

    const existing = await ctx.db
      .query("topics")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (existing) {
      if (!existing.ownerId) await ctx.db.patch(existing._id, { ownerId: owner._id });
      return existing._id;
    }
    return await ctx.db.insert("topics", { slug, title, ownerId: owner._id });
  },
});

// The Routine's Mission publish (issue 07): on a Seeded Topic's first run it
// drafts the Mission from the Seed + Resources, publishes it here, and flips
// `seeded` → `active`. Operator path (no auth), so owner is named by email.
export const publishMission = mutation({
  args: { secret: v.string(), ownerEmail: v.string(), topicSlug: v.string(), mission: v.string() },
  handler: async (ctx, { secret, ownerEmail, topicSlug, mission }) => {
    assertAdmin(secret);
    const owner = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", ownerEmail))
      .unique();
    if (!owner) throw new Error(`no registered user with email ${ownerEmail}`);
    const topic = await getOwnedTopic(ctx, owner._id, topicSlug);
    if (!topic) throw new Error("topic not found");
    await ctx.db.patch(topic._id, { mission, status: "active" });
  },
});

// The teach skill's termination call (ADR 0015): when the Mission's "Success
// looks like" outcomes are substantially met (see SKILL.md "Terminating a
// course"), the run marks the Topic `completed` so the Routine's gate stops
// authoring. Secret-guarded like the other teach write-backs; resolves by slug
// (the run knows its Topic's slug), the twin of the owner's `endCourse`.
//
// The teach skill also supplies the default Emblem here (ADR 0017): an
// already-uploaded image reference (via `generateProcessedUploadUrl`) and/or a
// fallback glyph, normalised + uploaded skill-side. It is applied only when the
// owner has not set their own (`ownerSet`) — so the fixed precedence (owner
// override → AI image → AI glyph → generic default) holds regardless of which
// path wrote first. An owner-ended course (no model in the loop) supplies none
// and falls back to the generic default at read.
export const completeCourse = mutation({
  args: {
    secret: v.string(),
    topicSlug: v.string(),
    emblem: v.optional(
      v.object({
        storageId: v.optional(v.id("_storage")),
        contentType: v.optional(v.string()),
        glyph: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, { secret, topicSlug, emblem }) => {
    assertAdmin(secret);
    const topic = await topicBySlug(ctx, topicSlug);
    if (!topic) throw new Error("topic not found");
    await ctx.db.patch(topic._id, { status: "completed" });

    // The AI default never overwrites an owner override. Validate the image the
    // same way the owner path does (raster, size-capped) — both feed the anonymous
    // page. The AI emblem carries no `ownerSet`, so a later owner override still
    // wins.
    if (emblem && !topic.emblem?.ownerSet) {
      const next: { imageId?: Id<"_storage">; glyph?: string } = {};
      if (emblem.storageId) {
        await assertEmblemImage(ctx, emblem.storageId, emblem.contentType ?? "");
        next.imageId = emblem.storageId;
      }
      if (emblem.glyph) next.glyph = normaliseGlyph(emblem.glyph);
      if (next.imageId || next.glyph) await ctx.db.patch(topic._id, { emblem: next });
    }
  },
});

// Lessons are immutable: insert if absent, otherwise no-op. If `supersedes` is
// given, the named prior lesson is retired (its `supersededBy` points here).
export const publishLesson = mutation({
  args: {
    secret: v.string(),
    topicId: v.id("topics"),
    key: v.string(),
    seq: v.number(),
    title: v.string(),
    // The body is uploaded to storage by the CLI first (generateContentUploadUrl)
    // and passed as a blob id — the HTML never rides through this function.
    storageId: v.id("_storage"),
    supersedes: v.optional(v.string()),
  },
  handler: async (ctx, { secret, topicId, key, seq, title, storageId, supersedes }) => {
    assertAdmin(secret);

    const existing = await ctx.db
      .query("lessons")
      .withIndex("by_topic_key", (q) => q.eq("topicId", topicId).eq("key", key))
      .unique();
    // Lessons are immutable: the freshly-uploaded blob is redundant, so drop it
    // (mirrors resources' dedupe-delete) rather than orphan it in storage.
    if (existing) {
      await ctx.storage.delete(storageId);
      return { status: "exists" as const };
    }

    await ctx.db.insert("lessons", { topicId, key, seq, title, htmlStorageId: storageId });
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

// Learning records are append-only history: insert if absent, otherwise no-op
// (like Lessons). The Routine writes one per authored Lesson; they ground the
// next run's ZPD decision and are pulled back at materialise.
export const publishLearningRecord = mutation({
  args: {
    secret: v.string(),
    topicId: v.id("topics"),
    key: v.string(),
    seq: v.number(),
    markdown: v.string(),
  },
  handler: async (ctx, { secret, topicId, key, seq, markdown }) => {
    assertAdmin(secret);
    const existing = await ctx.db
      .query("learningRecords")
      .withIndex("by_topic_key", (q) => q.eq("topicId", topicId).eq("key", key))
      .unique();
    if (existing) return { status: "exists" as const };
    await ctx.db.insert("learningRecords", { topicId, key, seq, markdown });
    return { status: "inserted" as const };
  },
});

// References are mutable: upsert, skipping unchanged content (by hash).
export const upsertReference = mutation({
  args: {
    secret: v.string(),
    topicId: v.id("topics"),
    key: v.string(),
    title: v.string(),
    storageId: v.id("_storage"),
    contentHash: v.string(),
  },
  handler: async (ctx, { secret, topicId, key, title, storageId, contentHash }) => {
    assertAdmin(secret);

    const existing = await ctx.db
      .query("references")
      .withIndex("by_topic_key", (q) => q.eq("topicId", topicId).eq("key", key))
      .unique();
    if (existing) {
      // Unchanged content → the new upload is redundant; drop it.
      if (existing.contentHash === contentHash) {
        await ctx.storage.delete(storageId);
        return { status: "unchanged" as const };
      }
      // Changed → point at the new blob and delete the superseded one (a
      // Reference is mutable, so its old body would otherwise orphan). Clear any
      // legacy inline `html` so the row is blob-only going forward.
      if (existing.htmlStorageId) await ctx.storage.delete(existing.htmlStorageId);
      await ctx.db.patch(existing._id, { title, htmlStorageId: storageId, contentHash });
      return { status: "updated" as const };
    }
    await ctx.db.insert("references", { topicId, key, title, htmlStorageId: storageId, contentHash });
    return { status: "inserted" as const };
  },
});
