import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { assertAdmin, getOwnedTopic, getViewableTopic, loadEdition, readableLang } from "./lib";
import { assertTenantFlag } from "./tenantFlags";

// The conversation loop (PRD §4–§5). Reader writes responses/progress/questions
// for the signed-in learner, scoped to the active Topic so identical lesson keys
// across Topics don't collide. The teach CLI reads them (`pnpm run review`) and
// answers questions (`pnpm run reply`), both PUBLISH_SECRET-guarded.

async function requireUser(ctx: { auth: MutationCtx["auth"] }) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("unauthenticated");
  return userId;
}

// The signed-in user's Topic by slug, for a write — throws if they don't own it.
async function requireOwnedTopic(ctx: MutationCtx, userId: Id<"users">, slug: string) {
  const topic = await getOwnedTopic(ctx, userId, slug);
  if (!topic) throw new Error("topic not found");
  return topic;
}

// ---- Teacher Q&A: the per-Topic show/hide -----------------------------------

// Whether a Topic offers a question channel (teacher-qa, CONTEXT.md). The single
// place the ABSENCE MEANS ON rule is expressed: a Topic that has never had the
// field written reads exactly as one with it explicitly on, which is why the
// setting needs no migration and no backfill. Read it, never `topic.teacherQa`.
//
// Not to be confused with the `qa` TENANT feature flag (tenantFlags.ts), which is
// per tenant and refuses only the `askQuestion` mutation. That flag gates the
// asking; this setting decides the showing. Both exist on purpose.
export function teacherQaOn(topic: { teacherQa?: boolean }): boolean {
  return topic.teacherQa !== false;
}

// Turn the course's question channel on or off. **Owner-only**, resolved through
// the same owner-only path `catalogue.setEditionPublished` uses: neither an
// Editor, a Share holder nor a tenant Admin decides how someone's course teaches.
// Per Topic, so it applies to every Edition; the UI puts it on the source
// language tab alone.
export const setTeacherQa = mutation({
  args: { topicSlug: v.string(), enabled: v.boolean() },
  returns: v.null(),
  handler: async (ctx, { topicSlug, enabled }) => {
    const userId = await requireUser(ctx);
    const topic = await requireOwnedTopic(ctx, userId, topicSlug);
    // Written explicitly either way: `true` is stored rather than cleared, so the
    // owner's decision is legible in the row and reads the same as absence.
    await ctx.db.patch(topic._id, { teacherQa: enabled });
    return null;
  },
});

// ---- Reader (learner) ------------------------------------------------------

// First answer wins — a quiz is the learner's initial attempt, recorded once.
export const recordResponse = mutation({
  args: { topicSlug: v.string(), lessonKey: v.string(), quizId: v.string(), answer: v.string(), correct: v.boolean() },
  handler: async (ctx, { topicSlug, lessonKey, quizId, answer, correct }) => {
    const userId = await requireUser(ctx);
    const topic = await requireOwnedTopic(ctx, userId, topicSlug);
    const existing = await ctx.db
      .query("responses")
      .withIndex("by_topic_user_lesson_quiz", (q) =>
        q.eq("topicId", topic._id).eq("userId", userId).eq("lessonKey", lessonKey).eq("quizId", quizId),
      )
      .unique();
    if (existing) return; // first answer only
    await ctx.db.insert("responses", { userId, topicId: topic._id, lessonKey, quizId, answer, correct });
  },
});

// Per-reader Progress: anyone with access (owner or shared Viewer) marks their
// own, keyed by their userId. A Viewer thus starts clean on a shared Topic (they
// have no rows) and their Progress never touches the owner's.
export const setProgress = mutation({
  args: { topicSlug: v.string(), lessonKey: v.string(), status: v.union(v.literal("opened"), v.literal("completed")) },
  handler: async (ctx, { topicSlug, lessonKey, status }) => {
    const userId = await requireUser(ctx);
    const topic = await getViewableTopic(ctx, userId, topicSlug);
    if (!topic) throw new Error("topic not found");
    const existing = await ctx.db
      .query("progress")
      .withIndex("by_topic_user_lesson", (q) => q.eq("topicId", topic._id).eq("userId", userId).eq("lessonKey", lessonKey))
      .unique();
    // Never downgrade completed → opened, but every write is still a read of
    // the lesson, so the resume stamp always moves (see myLastRead).
    if (existing) {
      if (existing.status === "completed") {
        await ctx.db.patch(existing._id, { lastReadAt: Date.now() });
        return;
      }
      await ctx.db.patch(existing._id, { status, lastReadAt: Date.now() });
      return;
    }
    await ctx.db.insert("progress", { userId, topicId: topic._id, lessonKey, status, lastReadAt: Date.now() });
  },
});

// The caller's most recent read across ALL their topics: the app tab bar's
// "Course" tab and the Home resume card (mobile bottom nav, 2026-08-23). Ordered
// by lastReadAt via by_user_lastReadAt; rows without a stamp (pre-migration)
// sort oldest, so they still resolve when they're all the caller has. Each
// candidate re-passes the owner-or-Viewer gate: a topic that was deleted or
// un-shared since the read must not come back as a resume point.
export const myLastRead = query({
  args: {},
  returns: v.union(v.object({ topicSlug: v.string(), lessonKey: v.string() }), v.null()),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const rows = await ctx.db
      .query("progress")
      .withIndex("by_user_lastReadAt", (q) => q.eq("userId", userId))
      .order("desc")
      .take(5);
    for (const row of rows) {
      const topic = await ctx.db.get(row.topicId);
      if (!topic) continue;
      const viewable = await getViewableTopic(ctx, userId, topic.slug);
      if (viewable) return { topicSlug: topic.slug, lessonKey: row.lessonKey };
    }
    return null;
  },
});

// The caller's own per-lesson progress in a Topic, so the reader can show what's
// done (live). Resolves through the owner-or-Viewer gate and reads the *caller's*
// rows: an owner sees their own, and a Viewer sees their own (fresh on a Topic
// shared with them), never the owner's.
export const myProgress = query({
  args: { topicSlug: v.string() },
  handler: async (ctx, { topicSlug }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const topic = await getViewableTopic(ctx, userId, topicSlug);
    if (!topic) return [];
    const rows = await ctx.db
      .query("progress")
      .withIndex("by_topic_user_lesson", (q) => q.eq("topicId", topic._id).eq("userId", userId))
      .collect();
    return rows.map((p) => ({ lessonKey: p.lessonKey, status: p.status }));
  },
});

export const askQuestion = mutation({
  args: { topicSlug: v.string(), lessonKey: v.string(), text: v.string() },
  handler: async (ctx, { topicSlug, lessonKey, text }) => {
    const userId = await requireUser(ctx);
    const topic = await requireOwnedTopic(ctx, userId, topicSlug);
    // Whitelabel: asking a question is create-side — gated by the tenant's `qa`
    // flag (no-op on the default site, issue 17). Reading the thread stays open.
    await assertTenantFlag(ctx, topic.tenantSlug, "qa");
    await ctx.db.insert("questions", { userId, topicId: topic._id, lessonKey, text, status: "open" });
  },
});

// The owner's questions + replies in a Topic, newest first (live). Owner-or-
// Viewer gated, reading the *owner's* thread: the owner sees their own Q&A, and
// a Viewer sees it read-only (PRD story 16). Asking (askQuestion) stays
// owner-only, so a Viewer reads the thread but can't add to it.
export const myQuestions = query({
  args: { topicSlug: v.string(), lang: v.optional(v.string()) },
  handler: async (ctx, { topicSlug, lang }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const topic = await getViewableTopic(ctx, userId, topicSlug);
    if (!topic?.ownerId) return [];
    const ownerId = topic.ownerId;
    const effLang = await readableLang(ctx, topic, userId, lang ?? null);
    if (!effLang) return [];
    const rows = await ctx.db
      .query("questions")
      .withIndex("by_topic_user", (q) => q.eq("topicId", topic._id).eq("userId", ownerId))
      .collect();
    // Translated Q&A for the current Edition (question text/reply else source),
    // via the shared Edition reader.
    const m = await loadEdition(ctx, topic, effLang).map(["question"]);
    return rows
      .sort((a, b) => b._creationTime - a._creationTime)
      .map((q) => {
        const { text, reply } = m.question(q);
        return { id: q._id, lessonKey: q.lessonKey, text, status: q.status, reply };
      });
  },
});

// ---- Teach CLI (PUBLISH_SECRET-guarded) ------------------------------------

// Everything the teacher needs at the start of a session: open questions, plus
// per-lesson responses and progress. v1 has one learner, so we read across all.
export const reviewState = query({
  args: { secret: v.string(), ownerEmail: v.string(), topicSlug: v.string() },
  handler: async (ctx, { secret, ownerEmail, topicSlug }) => {
    assertAdmin(secret);
    const empty = { openQuestions: [], responses: [], progress: [] };
    const owner = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", ownerEmail))
      .unique();
    if (!owner) return empty;
    const topic = await getOwnedTopic(ctx, owner._id, topicSlug);
    if (!topic) return empty;

    const open = await ctx.db
      .query("questions")
      .withIndex("by_topic_status", (q) => q.eq("topicId", topic._id).eq("status", "open"))
      .collect();
    const responses = await ctx.db
      .query("responses")
      .withIndex("by_topic", (q) => q.eq("topicId", topic._id))
      .collect();
    // The learner is the owner — read their Progress, not any Viewer's.
    const progress = await ctx.db
      .query("progress")
      .withIndex("by_topic_user_lesson", (q) => q.eq("topicId", topic._id).eq("userId", owner._id))
      .collect();
    return {
      openQuestions: open.map((q) => ({ id: q._id, lessonKey: q.lessonKey, text: q.text })),
      responses: responses.map((r) => ({
        lessonKey: r.lessonKey,
        quizId: r.quizId,
        answer: r.answer,
        correct: r.correct,
      })),
      progress: progress.map((p) => ({ lessonKey: p.lessonKey, status: p.status })),
    };
  },
});

export const replyToQuestion = mutation({
  args: { secret: v.string(), questionId: v.id("questions"), reply: v.string() },
  handler: async (ctx, { secret, questionId, reply }) => {
    assertAdmin(secret);
    await ctx.db.patch(questionId, { reply, status: "answered" });
  },
});
