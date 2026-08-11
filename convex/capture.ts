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
    // Never downgrade completed → opened.
    if (existing) {
      if (existing.status === "completed") return;
      await ctx.db.patch(existing._id, { status });
      return;
    }
    await ctx.db.insert("progress", { userId, topicId: topic._id, lessonKey, status });
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
