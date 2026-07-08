import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
import {
  assembleLesson,
  buildOngoingMessages,
  nextLessonKey,
  parseAuthoringResult,
  supersedesFrom,
  titleFrom,
  type MaterialisedContext,
} from "./authoring";
import { authorModel, chatComplete } from "./openrouterClient";

// The OpenRouter teaching runtime (ADR 0014). A course with `provider:
// "openrouter"` routes its authoring here instead of firing the claude.ai
// Routine — the fire step (`convex/routine.ts`) schedules `authorTopic` for the
// topic rather than POSTing the routine URL. Unlike the Claude path there is no
// `claim` protocol: the action is handed its topic slug directly. It reuses the
// existing gate/lock (already acquired before scheduling) and the existing
// publish/report mutations (secret from env) — no new publish or report code.

// A whole authoring run for one topic. Ongoing single-pass (issue 03): the course
// already has a Frontier, so author the next Lesson in one GLM 4.2 pass and
// publish it. A seeded course with no Frontier is the bootstrap path (issue 04) —
// still a skeleton here (reports `nothing`). Any failure reports `failed` so the
// reader shows a retry and the lock never sticks.
export const authorTopic = internalAction({
  args: { topicSlug: v.string() },
  returns: v.null(),
  handler: async (ctx, { topicSlug }) => {
    const secret = process.env.PUBLISH_SECRET;
    if (!secret) throw new Error("PUBLISH_SECRET not set");

    try {
      const context = (await ctx.runQuery(internal.routine.materialiseForProvider, { topicSlug })) as
        | (MaterialisedContext & { topicId: import("./_generated/dataModel").Id<"topics"> })
        | null;
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
        // Bootstrap (seeded, no Frontier) — issue 04. Skeleton for now: report
        // `nothing` so the lock lands in `caughtUp` rather than sticking.
        await ctx.runMutation(api.routine.reportGeneration, { secret, topicSlug, outcome: "nothing" });
        return null;
      }

      // Ongoing single-pass: one GLM 4.2 call for the next lesson (no web search).
      const raw = await chatComplete({ model: authorModel(), messages: buildOngoingMessages(context) });
      const { lessonHtml, learningRecord, estimatedLessons } = parseAuthoringResult(raw);

      const seq = context.frontier.seq + 1;
      const html = assembleLesson(lessonHtml);
      const title = titleFrom(html);
      const key = nextLessonKey(seq, title);

      await ctx.runMutation(api.content.publishLesson, {
        secret,
        topicId: context.topicId,
        key,
        seq,
        title,
        html,
        supersedes: supersedesFrom(html),
      });
      await ctx.runMutation(api.content.publishLearningRecord, {
        secret,
        topicId: context.topicId,
        key,
        seq,
        markdown: learningRecord,
      });
      await ctx.runMutation(api.routine.reportGeneration, {
        secret,
        topicSlug,
        outcome: "published",
        estimatedLessons,
      });
      return null;
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      await ctx.runMutation(api.routine.reportGeneration, { secret, topicSlug, outcome: "failed", error });
      return null;
    }
  },
});
