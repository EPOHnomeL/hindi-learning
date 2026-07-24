import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { action, internalMutation, internalQuery, mutation, type ActionCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { assertTenantFlag, getEditableTopic, getOwnedTopic, SOURCE_LANG, topicBySlug } from "../lib";
import { itemHash, quizStructureMatches } from "../translate";
import { isCallerAdmin, isEmailAdmitted } from "../whitelist";

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
    const target = await ctx.runQuery(internal.content.authoring.lessonEditTarget, { topicSlug, key });
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
      await ctx.runMutation(internal.content.authoring.applyLessonEdit, { topicSlug, key, storageId });
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
    const target = await ctx.runQuery(internal.content.authoring.translatedLessonEditTarget, { topicSlug, key, lang });
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
      await ctx.runMutation(internal.content.authoring.applyTranslatedLessonEdit, { topicSlug, key, lang, storageId });
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
