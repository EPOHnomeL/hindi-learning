import { v } from "convex/values";
import { internalAction, type ActionCtx } from "./_generated/server";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  assembleLesson,
  assembleReference,
  buildMissionMessages,
  buildOngoingMessages,
  nextLessonKey,
  parseAuthoringResult,
  parseMissionResult,
  supersedesFrom,
  titleFrom,
  type AuthoringResult,
  type MaterialisedContext,
} from "./authoring";
import { authorModel, chatComplete } from "./openrouterClient";
import { hashString } from "./lib";

// The OpenRouter teaching runtime (ADR 0014). A course with `provider:
// "openrouter"` routes its authoring here instead of firing the claude.ai
// Routine — the fire step (`convex/routine.ts`) schedules `authorTopic` for the
// topic rather than POSTing the routine URL. Unlike the Claude path there is no
// `claim` protocol: the action is handed its topic slug directly. It reuses the
// existing gate/lock (already acquired before scheduling) and the existing
// publish/report mutations (secret from env) — no new publish or report code.

// Soft wall-clock budget for the multi-step bootstrap. A Convex action hard-caps
// near 10 min; we check this between steps so an over-budget setup reports
// `failed` cleanly (lock clears) instead of being killed mid-flight.
const SETUP_BUDGET_MS = 8 * 60 * 1000;

type ProviderContext = MaterialisedContext & { topicId: Id<"topics">; ownerEmail: string | null };

// Wrap the model's lean fragment into a stored document + shuffle its quizzes,
// then publish the lesson and its learning record via the existing mutations.
async function publishAuthoredLesson(
  ctx: ActionCtx,
  secret: string,
  topicId: Id<"topics">,
  seq: number,
  result: AuthoringResult,
): Promise<void> {
  // Only reached on the author path, where the contract requires a lesson.
  if (!result.lessonHtml || !result.learningRecord) throw new Error("authoring: no lesson to publish");
  const html = assembleLesson(result.lessonHtml);
  const title = titleFrom(html);
  const key = nextLessonKey(seq, title);
  // Bodies live in content blobs now (.scratch/html-blob-storage): the HTML never
  // rides through the mutation. In-deployment we can store the blob directly,
  // skipping the CLI's generateContentUploadUrl → PUT dance. publishLesson takes
  // ownership of the blob (drops it if the Lesson already exists).
  const storageId = await ctx.storage.store(new Blob([html], { type: "text/html" }));
  await ctx.runMutation(api.content.publishLesson, {
    secret,
    topicId,
    key,
    seq,
    title,
    storageId,
    supersedes: supersedesFrom(html),
  });
  await ctx.runMutation(api.content.publishLearningRecord, { secret, topicId, key, seq, markdown: result.learningRecord! });
  // Upsert any references the lesson relies on / cross-links to, so a
  // /references/<key> link never dangles (AUTHORING.md §7). Stored as-authored.
  for (const ref of result.references) {
    // The model emits a lean reference fragment; wrap it in the bundled reference
    // design system so the STORED reference is a complete, consistently-styled
    // document (references render raw — see assembleReference; this overrides
    // AUTHORING.md §7's "stored as-authored").
    const refHtml = assembleReference(ref.html, ref.title);
    const refStorageId = await ctx.storage.store(new Blob([refHtml], { type: "text/html" }));
    await ctx.runMutation(api.content.upsertReference, {
      secret,
      topicId,
      key: ref.key,
      title: ref.title,
      storageId: refStorageId,
      contentHash: hashString(refHtml),
    });
  }
}

// Batched Q&A (issue 05): answer the open questions the model replied to, matching
// on the ids we handed it so a stray/hallucinated id is ignored. Same delayed
// cadence as the Claude path — replies land as part of the authoring run.
async function applyReplies(ctx: ActionCtx, secret: string, context: ProviderContext, result: AuthoringResult): Promise<void> {
  const known = new Set(context.capture.openQuestions.map((q) => q.id));
  for (const r of result.replies) {
    if (!known.has(r.questionId)) continue;
    await ctx.runMutation(api.capture.replyToQuestion, {
      secret,
      questionId: r.questionId as Id<"questions">,
      reply: r.reply,
    });
  }
}

// A whole authoring run for one topic. Two paths, chosen by the Frontier:
//   - Ongoing single-pass (issue 03): a Frontier exists → one GLM 4.2 call for the
//     next Lesson, no web search.
//   - Bootstrap (issue 04): a seeded course with no Frontier → a web-grounded,
//     orchestrated pass: draft + publish the Mission (flips seeded → active), then
//     author + publish Lesson 1. Bounded by SETUP_BUDGET_MS.
// Either way it publishes through the existing mutations and reports `published`
// (with the ~N estimate) or `failed` (retryable) so the lock never sticks.
export const authorTopic = internalAction({
  args: { topicSlug: v.string() },
  returns: v.null(),
  handler: async (ctx, { topicSlug }) => {
    const secret = process.env.PUBLISH_SECRET;
    if (!secret) throw new Error("PUBLISH_SECRET not set");
    const model = authorModel();

    try {
      const context = (await ctx.runQuery(internal.routine.materialiseForProvider, { topicSlug })) as ProviderContext | null;
      if (!context) {
        await ctx.runMutation(api.routine.reportGeneration, {
          secret,
          topicSlug,
          outcome: "failed",
          error: "no materialised context (missing topic or owner)",
        });
        return null;
      }

      if (!context.frontier) {
        // Only a seeded course bootstraps; anything else with no Frontier no-ops.
        if (context.topic.status !== "seeded") {
          await ctx.runMutation(api.routine.reportGeneration, { secret, topicSlug, outcome: "nothing" });
          return null;
        }
        if (!context.ownerEmail) throw new Error("seeded topic has no owner email");

        // Bootstrap is made atomic w.r.t. the (failure-prone) model calls by doing
        // ALL generation BEFORE any publish, and publishing the Mission LAST —
        // publishMission is what flips seeded → active, so if mission-drafting or
        // Lesson-1 authoring fails/times out, the course stays `seeded` and the
        // gate re-fires bootstrap cleanly (issue 03/04: a failed run is retryable).
        // Publishing mission first (the old order) bricked the course: active with
        // no Frontier, which the gate refuses on both the bootstrap and ongoing paths.

        // Step 1 — draft the Mission (web-grounded), in memory (not yet published).
        const startedAt = Date.now();
        const missionRaw = await chatComplete({ model, messages: buildMissionMessages(context), webSearch: true });
        const { mission } = parseMissionResult(missionRaw);

        if (Date.now() - startedAt > SETUP_BUDGET_MS) throw new Error("setup exceeded time budget before lesson 1");

        // Step 2 — author Lesson 1 (web-grounded), injecting the drafted mission into
        // the prompt context (no Frontier → seq 1) without publishing it yet.
        const withMission: ProviderContext = { ...context, topic: { ...context.topic, mission, status: "active" } };
        const raw = await chatComplete({ model, messages: buildOngoingMessages(withMission), webSearch: true });
        const result = parseAuthoringResult(raw);

        // All model work succeeded — now publish. Lesson (+ record + refs) first,
        // then the Mission LAST (flips seeded → active), so the course only leaves
        // `seeded` once it has a Frontier.
        await publishAuthoredLesson(ctx, secret, context.topicId, 1, result);
        await ctx.runMutation(api.content.publishMission, { secret, ownerEmail: context.ownerEmail, topicSlug, mission });
        await ctx.runMutation(api.routine.reportGeneration, {
          secret,
          topicSlug,
          outcome: "published",
          estimatedLessons: result.estimatedLessons,
        });
        return null;
      }

      // Ongoing single-pass: one GLM 4.2 call that judges completion, authors the
      // next lesson (unless complete), and batches replies (no web search).
      const raw = await chatComplete({ model, messages: buildOngoingMessages(context) });
      const result = parseAuthoringResult(raw);

      // Answer open questions regardless of the author-vs-complete branch.
      await applyReplies(ctx, secret, context, result);

      if (result.complete) {
        // Terminate (ADR 0015): complete with NO emblem — a finished OpenRouter
        // course falls back to the generic 🎓 (the owner may set one). Report
        // `nothing` so the reader stops offering "Generate next lesson".
        await ctx.runMutation(api.content.completeCourse, { secret, topicSlug });
        await ctx.runMutation(api.routine.reportGeneration, {
          secret,
          topicSlug,
          outcome: "nothing",
          estimatedLessons: result.estimatedLessons,
        });
        return null;
      }

      await publishAuthoredLesson(ctx, secret, context.topicId, context.frontier.seq + 1, result);
      await ctx.runMutation(api.routine.reportGeneration, {
        secret,
        topicSlug,
        outcome: "published",
        estimatedLessons: result.estimatedLessons,
      });
      return null;
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      await ctx.runMutation(api.routine.reportGeneration, { secret, topicSlug, outcome: "failed", error });
      return null;
    }
  },
});
