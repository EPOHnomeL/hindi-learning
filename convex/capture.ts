import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";

// The conversation loop (PRD §4–§5). Reader writes responses/progress/questions
// for the signed-in learner; the teach CLI reads them (`pnpm run review`) and
// answers questions (`pnpm run reply`), both PUBLISH_SECRET-guarded.

function assertAdmin(secret: string) {
  const expected = process.env.PUBLISH_SECRET;
  if (!expected || secret !== expected) throw new Error("unauthorized");
}

async function requireUser(ctx: any) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("unauthenticated");
  return userId;
}

// ---- Reader (learner) ------------------------------------------------------

// First answer wins — a quiz is the learner's initial attempt, recorded once.
export const recordResponse = mutation({
  args: { lessonKey: v.string(), quizId: v.string(), answer: v.string(), correct: v.boolean() },
  handler: async (ctx, { lessonKey, quizId, answer, correct }) => {
    const userId = await requireUser(ctx);
    const existing = await ctx.db
      .query("responses")
      .withIndex("by_user_lesson_quiz", (q) =>
        q.eq("userId", userId).eq("lessonKey", lessonKey).eq("quizId", quizId),
      )
      .unique();
    if (existing) return; // first answer only
    await ctx.db.insert("responses", { userId, lessonKey, quizId, answer, correct });
  },
});

export const setProgress = mutation({
  args: { lessonKey: v.string(), status: v.union(v.literal("opened"), v.literal("completed")) },
  handler: async (ctx, { lessonKey, status }) => {
    const userId = await requireUser(ctx);
    const existing = await ctx.db
      .query("progress")
      .withIndex("by_user_lesson", (q) => q.eq("userId", userId).eq("lessonKey", lessonKey))
      .unique();
    // Never downgrade completed → opened.
    if (existing) {
      if (existing.status === "completed") return;
      await ctx.db.patch(existing._id, { status });
      return;
    }
    await ctx.db.insert("progress", { userId, lessonKey, status });
  },
});

export const askQuestion = mutation({
  args: { lessonKey: v.string(), text: v.string() },
  handler: async (ctx, { lessonKey, text }) => {
    const userId = await requireUser(ctx);
    await ctx.db.insert("questions", { userId, lessonKey, text, status: "open" });
  },
});

// The learner's own questions + replies, newest first (live via subscription).
export const myQuestions = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const rows = await ctx.db
      .query("questions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
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
  args: { secret: v.string() },
  handler: async (ctx, { secret }) => {
    assertAdmin(secret);
    const open = await ctx.db
      .query("questions")
      .withIndex("by_status", (q) => q.eq("status", "open"))
      .collect();
    const responses = await ctx.db.query("responses").collect();
    const progress = await ctx.db.query("progress").collect();
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
