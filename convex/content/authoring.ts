import { ConvexError, v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { action, internalMutation, internalQuery, mutation, type ActionCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { getEditableTopic, getOwnedTopic, topicBySlug } from "../topicAccess";
import { SOURCE_LANG } from "../sourceLang";
import { assertTenantFlag } from "../tenantFlags";
import { itemHash, quizStructureMatches } from "../translate";
import { isCallerUncapped, isEmailAdmitted } from "../whitelist";

// A learner may seed at most one new course per this window — an anti-abuse / cost
// cap that mirrors the routine's per-user on-demand cap. Rolling 24h window.
const DAY_MS = 24 * 60 * 60 * 1000;

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
    // Whitelabel: seeding a course is create-side — gated by the CALLER's own
    // tenant `seeding` flag (there's no Topic yet at creation, so the tenant comes
    // from the user, not a Topic). No-op for a default-site user (issue 17).
    await assertTenantFlag(ctx, user.tenantSlug, "seeding");
    // One new course per user per day (issue 08, bounds Claude usage). Exempt: an
    // Admin (they drive the app and aren't the runaway-usage risk this guards
    // against, mirroring the routine's on-demand bypass) and any member whose
    // Allowlist row carries `unlimited` (ADR 0032), which grants the volume without
    // granting the Admin panel. Checked against the user's most recent Topic, so
    // their first course is never blocked.
    if (!(await isCallerUncapped(ctx))) {
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

// Mint an upload URL for the reader's in-place edit: the client PUTs the edited
// Lesson body straight to storage and passes the resulting storageId to
// `editLesson`, so the HTML never rides through a Convex function (mirrors the
// teach CLI's `generateContentUploadUrl`, but caller-guarded instead of
// secret-guarded). Scoped to the Topic+Edition being edited — the blob still does
// nothing until the write path accepts it.
//
// The guard MUST be the same one the write paths use (`getEditableTopic`: owner
// OR that Edition's Editor, ADR 0020) and NOT owner-only. It was `getOwnedTopic`
// until 2026-08-05, which made every Editor's save die here — the reader shows
// the pencil on the server's `canEdit` (owner or Editor) and `editLesson` /
// `editTranslatedLesson` / `editReference` all accept an Editor, so an Editor
// could open the editor, type, press Save, and get a bare "Server Error" from
// this mutation before any write path was reached.
export const generateEditUploadUrl = mutation({
  args: { topicSlug: v.string(), lang: v.optional(v.string()) },
  returns: v.string(),
  handler: async (ctx, { topicSlug, lang }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("unauthenticated");
    // `lang` is the Edition being edited (absent ≡ the English source), so an
    // Editor of lang X can't mint an upload URL against lang Y — the same
    // per-Edition boundary `applyTranslatedLessonEdit` enforces on the write.
    const topic = await getEditableTopic(ctx, userId, topicSlug, lang);
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
  args: { topicSlug: v.string(), key: v.string(), storageId: v.id("_storage"), title: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, { topicSlug, key, storageId, title }) => {
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
    await ctx.db.patch(lesson._id, { htmlStorageId: storageId, ...titlePatch(title) });
    if (old && old !== storageId) await ctx.storage.delete(old);
    return null;
  },
});

async function blobText(ctx: ActionCtx, id: Id<"_storage">): Promise<string | null> {
  const blob = await ctx.storage.get(id);
  return blob ? await blob.text() : null;
}

// The refusals below are instructions to the person editing ("reword without
// adding an option", "refresh and try again"), and the editor shows them inline.
//
// They MUST be ConvexError: a **production** deployment redacts a plain Error's
// message before it reaches the client, so `e.message` becomes "[CONVEX
// A(content/authoring:editLesson)] … Server Error" and every one of these
// sentences was replaced by that noise on the live site — the same trap the
// donation-flag precondition fell into (see `convex/tenantFlags.ts`). Only
// ConvexError's `data` crosses the wire in prod.
//
// The *guard* failures above (`unauthenticated`, `topic not found`, `lesson not
// found`) stay plain Errors deliberately: they aren't instructions, and being
// redacted is the right outcome for an authorisation detail.
const REFUSAL = {
  unreadableUpload: "The edited lesson couldn't be read back. Please try saving again.",
  unreadableCurrent: "Couldn't check this edit against the current lesson. Please refresh and try again.",
  unreadableSource: "Couldn't check this edit against the source lesson. Please refresh and try again.",
  quizStructure:
    "This edit changes the lesson's quiz structure, so it can't be saved. Reword the text without adding or removing quiz options or answers.",
  unreadableReference: "The edited reference couldn't be read back. Please try saving again.",
} as const;

// The display title from an edit save (editing-obviousness unit 4). The editor
// splices the same string into the stored document's head `<title>`
// (`replaceTitleDisplay`) and sends it here for the row's `title` column, which
// is what the reader renders; the column is therefore the authority, and the tag
// is what keeps a document read on its own self-describing. Absent or blank means
// "leave the current title alone", so a body-only save can never clear a name.
function titlePatch(title: string | undefined): { title: string } | undefined {
  const trimmed = title?.trim();
  return trimmed ? { title: trimmed } : undefined;
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
  args: { topicSlug: v.string(), key: v.string(), storageId: v.id("_storage"), title: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, { topicSlug, key, storageId, title }): Promise<null> => {
    const target = await ctx.runQuery(internal.content.authoring.lessonEditTarget, { topicSlug, key });
    // Read the edited body up front. The swap must NEVER proceed on an unreadable
    // upload (a bogus/consumed storageId): that would patch the lesson to a dead
    // blob and then delete the good previous body — silent, unrecoverable loss.
    const newHtml = await blobText(ctx, storageId);
    if (newHtml === null) throw new ConvexError(REFUSAL.unreadableUpload);
    // A lesson with a current body must keep its quiz-marker counts unchanged
    // (scoring is positional). If the current body can't be read, the edit can't
    // be verified against it — refuse rather than accept a possibly-structural
    // change. (A lesson with no stored body yet has nothing to preserve.)
    if (target.storageId) {
      const oldHtml = await blobText(ctx, target.storageId);
      if (oldHtml === null || !quizStructureMatches(oldHtml, newHtml)) {
        await ctx.storage.delete(storageId);
        throw new ConvexError(oldHtml === null ? REFUSAL.unreadableCurrent : REFUSAL.quizStructure);
      }
    }
    // Guard passed. If the swap itself fails (e.g. the lesson was superseded in the
    // window since lessonEditTarget resolved), delete the upload so it doesn't orphan.
    try {
      await ctx.runMutation(internal.content.authoring.applyLessonEdit, { topicSlug, key, storageId, title });
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
  args: { topicSlug: v.string(), key: v.string(), storageId: v.id("_storage"), title: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, { topicSlug, key, storageId, title }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("unauthenticated");
    // Owner OR an Editor of the English (source) edition. Since 2026-08-31 a
    // translated Edition's Reference has its own write path
    // (`editTranslatedReference`), so a caller reaching HERE is editing the
    // source, and an Editor of some other Edition is refused by the resolver.
    const topic = await getEditableTopic(ctx, userId, topicSlug);
    if (!topic) throw new Error("topic not found");
    const ref = await ctx.db
      .query("references")
      .withIndex("by_topic_key", (q) => q.eq("topicId", topic._id).eq("key", key))
      .unique();
    if (!ref) throw new Error("reference not found");
    if (!(await ctx.db.system.get(storageId))) throw new ConvexError(REFUSAL.unreadableReference);
    const old = ref.htmlStorageId;
    await ctx.db.patch(ref._id, { htmlStorageId: storageId, ...titlePatch(title) });
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
  args: { topicSlug: v.string(), key: v.string(), lang: v.string(), storageId: v.id("_storage"), title: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, { topicSlug, key, lang, storageId, title }) => {
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
      await ctx.db.patch(row._id, { htmlStorageId: storageId, html: undefined, sourceHash, ...titlePatch(title) });
      if (old && old !== storageId) await ctx.storage.delete(old);
    } else {
      // First edit of this item in this Edition (it was showing the English
      // fallback). With no title of its own the reader falls back to the source
      // title, so the column is set only when the rename field carried one.
      await ctx.db.insert("translations", { topicId: topic._id, lang, kind: "lesson", key, htmlStorageId: storageId, sourceHash, ...titlePatch(title) });
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
  args: { topicSlug: v.string(), key: v.string(), lang: v.string(), storageId: v.id("_storage"), title: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, { topicSlug, key, lang, storageId, title }): Promise<null> => {
    const target = await ctx.runQuery(internal.content.authoring.translatedLessonEditTarget, { topicSlug, key, lang });
    const newHtml = await blobText(ctx, storageId);
    if (newHtml === null) throw new ConvexError(REFUSAL.unreadableUpload);
    if (target.sourceStorageId) {
      const srcHtml = await blobText(ctx, target.sourceStorageId);
      if (srcHtml === null || !quizStructureMatches(srcHtml, newHtml)) {
        await ctx.storage.delete(storageId);
        throw new ConvexError(srcHtml === null ? REFUSAL.unreadableSource : REFUSAL.quizStructure);
      }
    }
    try {
      await ctx.runMutation(internal.content.authoring.applyTranslatedLessonEdit, { topicSlug, key, lang, storageId, title });
    } catch (e) {
      await ctx.storage.delete(storageId);
      throw e;
    }
    return null;
  },
});

// Correct a translated Edition's Reference in place: the grammar sheet, the
// glossary, whatever the course carries. The twin of `editTranslatedLesson` for
// References, and of `editReference` for a non-source Edition.
//
// Reference editing was source-only until 2026-08-31 (the map's own out-of-scope
// line, editing-obviousness D8), which left a translator holding an Editor share
// on their own Edition able to fix every Lesson and neither the grammar sheet nor
// the glossary. Nothing about References made that necessary: the reader has
// always served a translated Reference (`loadEdition(...).reference` in
// convex/lib.ts) and `publishTranslation` has always written the rows. Only the
// in-app write path was missing.
//
// A plain mutation, not an action: References carry no quiz, so there is no
// structure to guard and no reason to read either body's bytes (the same reason
// `editReference` is a mutation). `db.system.get` still confirms the upload is a
// real blob, so a bogus or consumed id can't swap in a dead body. The source
// Reference and every other Edition are untouched, and `sourceHash` is stamped
// from the current source so a later re-translate of an unchanged source skips
// this item and keeps the correction.
export const editTranslatedReference = mutation({
  args: { topicSlug: v.string(), key: v.string(), lang: v.string(), storageId: v.id("_storage"), title: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, { topicSlug, key, lang, storageId, title }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("unauthenticated");
    // The source Edition keeps its own write path: it patches the `references`
    // row, not a `translations` row (which never carries lang "en").
    if (lang === SOURCE_LANG) throw new Error("not a translated edition");
    // Owner OR an Editor of THIS Edition (ADR 0020): an editor-Share for lang X
    // never authorises an edit to lang Y.
    const topic = await getEditableTopic(ctx, userId, topicSlug, lang);
    if (!topic) throw new Error("topic not found");
    const ref = await ctx.db
      .query("references")
      .withIndex("by_topic_key", (q) => q.eq("topicId", topic._id).eq("key", key))
      .unique();
    if (!ref) throw new Error("reference not found");
    if (!(await ctx.db.system.get(storageId))) throw new ConvexError(REFUSAL.unreadableReference);
    const sourceHash = itemHash("reference", ref);
    const row = await ctx.db
      .query("translations")
      .withIndex("by_topic_lang_kind_key", (q) => q.eq("topicId", topic._id).eq("lang", lang).eq("kind", "reference").eq("key", key))
      .unique();
    if (row) {
      const old = row.htmlStorageId;
      // Clear any inline `html` (older translations stored the body inline) so the
      // row is blob-only going forward, exactly as the Lesson path does.
      await ctx.db.patch(row._id, { htmlStorageId: storageId, html: undefined, sourceHash, ...titlePatch(title) });
      if (old && old !== storageId) await ctx.storage.delete(old);
    } else {
      // First edit of this Reference in this Edition: it was showing the English
      // fallback, and now this Edition owns it.
      await ctx.db.insert("translations", { topicId: topic._id, lang, kind: "reference", key, htmlStorageId: storageId, sourceHash, ...titlePatch(title) });
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
