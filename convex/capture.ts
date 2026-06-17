import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { assertAdmin, getOwnedTopic, topicBySlug } from "./lib";

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

export const setProgress = mutation({
  args: { topicSlug: v.string(), lessonKey: v.string(), status: v.union(v.literal("opened"), v.literal("completed")) },
  handler: async (ctx, { topicSlug, lessonKey, status }) => {
    const userId = await requireUser(ctx);
    const topic = await requireOwnedTopic(ctx, userId, topicSlug);
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

// The learner's per-lesson progress in a Topic, so the reader can show what's
// done (live).
export const myProgress = query({
  args: { topicSlug: v.string() },
  handler: async (ctx, { topicSlug }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const topic = await getOwnedTopic(ctx, userId, topicSlug);
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
    await ctx.db.insert("questions", { userId, topicId: topic._id, lessonKey, text, status: "open" });
  },
});

// The learner's own questions + replies in a Topic, newest first (live).
export const myQuestions = query({
  args: { topicSlug: v.string() },
  handler: async (ctx, { topicSlug }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const topic = await getOwnedTopic(ctx, userId, topicSlug);
    if (!topic) return [];
    const rows = await ctx.db
      .query("questions")
      .withIndex("by_topic_user", (q) => q.eq("topicId", topic._id).eq("userId", userId))
      .collect();
    return rows
      .sort((a, b) => b._creationTime - a._creationTime)
      .map((q) => ({
        id: q._id,
        lessonKey: q.lessonKey,
        text: q.text,
        status: q.status,
        reply: q.reply ?? null,
      }));
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
    const progress = await ctx.db
      .query("progress")
      .withIndex("by_topic_lesson", (q) => q.eq("topicId", topic._id))
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

// One-shot migration (PUBLISH_SECRET-guarded): stamp the Topic onto capture
// rows written before Topic-scoping existed. v1 is single-learner, so every
// orphaned row is that learner's <slug> data. Idempotent; returns per-table
// patched counts. Run once per deployment:
//   npx convex run capture:backfillCaptureTopic '{"secret":"…","slug":"hindi"}'
// ponytail: full scan + per-row patch — fine for one learner; if capture ever
// grows large, batch with ctx.scheduler.runAfter to stay within txn limits.
export const backfillCaptureTopic = mutation({
  args: { secret: v.string(), slug: v.string() },
  handler: async (ctx, { secret, slug }) => {
    assertAdmin(secret);
    const topic = await topicBySlug(ctx, slug);
    if (!topic) throw new Error(`topic "${slug}" not found — run ensureTopic first`);

    let progress = 0;
    let responses = 0;
    let questions = 0;
    for (const row of await ctx.db.query("progress").collect()) {
      if (row.topicId === undefined) {
        await ctx.db.patch(row._id, { topicId: topic._id });
        progress++;
      }
    }
    for (const row of await ctx.db.query("responses").collect()) {
      if (row.topicId === undefined) {
        await ctx.db.patch(row._id, { topicId: topic._id });
        responses++;
      }
    }
    for (const row of await ctx.db.query("questions").collect()) {
      if (row.topicId === undefined) {
        await ctx.db.patch(row._id, { topicId: topic._id });
        questions++;
      }
    }
    return { progress, responses, questions };
  },
});
