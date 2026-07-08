import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { api } from "./_generated/api";

// The OpenRouter teaching runtime (ADR 0014). A course with `provider:
// "openrouter"` routes its authoring here instead of firing the claude.ai
// Routine — the fire step (`convex/routine.ts`) schedules `authorTopic` for the
// topic rather than POSTing the routine URL. Unlike the Claude path there is no
// `claim` protocol: the action is handed its topic slug directly.
//
// Walking skeleton (issue 01): this does NO LLM work yet. It exists to prove the
// schedule → run → `reportGeneration` round-trip and leave the generation lock in
// a clean state, so the whole seam is exercised before any model call is wired in
// (issues 02+). It reports `nothing` (→ `caughtUp`) deterministically.
export const authorTopic = internalAction({
  args: { topicSlug: v.string() },
  returns: v.null(),
  handler: async (ctx, { topicSlug }) => {
    // `reportGeneration` is the same PUBLISH_SECRET-guarded mutation the Claude
    // path's cloud agent calls; reuse it with the secret from env (no new report
    // code). The Claude path holds this secret out-of-band; here it's the app's.
    const secret = process.env.PUBLISH_SECRET;
    if (!secret) throw new Error("PUBLISH_SECRET not set");
    await ctx.runMutation(api.routine.reportGeneration, { secret, topicSlug, outcome: "nothing" });
    return null;
  },
});
