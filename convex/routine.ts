import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
  type ActionCtx,
} from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { assertAdmin, topicBySlug } from "./lib";

// The next-lesson Routine (ADR 0008). One cloud Claude Code routine, fired two
// ways through one gate: a daily Convex cron (`dailyFire`) and the reader button
// (`requestNextLesson`). The gate authors the next Lesson iff the Frontier (the
// highest-seq, non-superseded Lesson) is `completed`. A per-Topic lock row makes
// it single-flight; the cloud agent reports the outcome back via
// `reportGeneration`. The agent advances whichever Topic it's fired for (slug in
// the fire body), so this stays multi-topic-ready with a single routine.

// A run stuck "generating" past this is treated as crashed and re-fireable.
const STALE_MS = 10 * 60 * 1000;

// The Frontier: highest-seq non-superseded Lesson, or null if the Topic has none.
async function frontierLesson(ctx: QueryCtx, topicId: Id<"topics">): Promise<Doc<"lessons"> | null> {
  for await (const lesson of ctx.db
    .query("lessons")
    .withIndex("by_topic_seq", (q) => q.eq("topicId", topicId))
    .order("desc")) {
    if (!lesson.supersededBy) return lesson;
  }
  return null;
}

async function isCompleted(ctx: QueryCtx, lessonKey: string): Promise<boolean> {
  // v1 is single-learner, so any completed row is the learner's.
  const rows = await ctx.db
    .query("progress")
    .withIndex("by_lesson", (q) => q.eq("lessonKey", lessonKey))
    .collect();
  return rows.some((p) => p.status === "completed");
}

async function generationRow(ctx: QueryCtx, topicId: Id<"topics">): Promise<Doc<"generation"> | null> {
  return await ctx.db
    .query("generation")
    .withIndex("by_topic", (q) => q.eq("topicId", topicId))
    .unique();
}

// ---- Reader status ---------------------------------------------------------

// What the reader needs to render the "generate next lesson" control. Mirrors
// the lock row; the reader pairs it with its own knowledge of the Frontier.
export const generationStatus = query({
  args: { topicSlug: v.string() },
  handler: async (ctx, { topicSlug }) => {
    if (!(await getAuthUserId(ctx))) return null;
    const topic = await topicBySlug(ctx, topicSlug);
    if (!topic) return null;
    const gen = await generationRow(ctx, topic._id);
    return {
      status: gen?.status ?? "idle",
      frontierKey: gen?.frontierKey ?? null,
      startedAt: gen?.startedAt ?? null,
      error: gen?.error ?? null,
    };
  },
});

// ---- The gate + lock (atomic) ----------------------------------------------

type AcquireResult =
  | { acquired: true; topicSlug: string; frontierKey: string }
  | { acquired: false; reason: string };

// Check the gate and grab the lock in one transaction. Returns whether the
// caller should now fire the routine. The ONLY place that decides to author.
export const tryAcquireGeneration = internalMutation({
  args: { topicSlug: v.string() },
  handler: async (ctx, { topicSlug }): Promise<AcquireResult> => {
    const topic = await topicBySlug(ctx, topicSlug);
    if (!topic) return { acquired: false, reason: "no-topic" };

    const frontier = await frontierLesson(ctx, topic._id);
    if (!frontier) return { acquired: false, reason: "no-frontier" };
    if (!(await isCompleted(ctx, frontier.key))) {
      return { acquired: false, reason: "frontier-not-completed" };
    }

    const gen = await generationRow(ctx, topic._id);
    const now = Date.now();
    if (gen) {
      const stale = gen.startedAt !== undefined && now - gen.startedAt > STALE_MS;
      if (gen.status === "generating" && !stale) {
        return { acquired: false, reason: "already-generating" };
      }
      // Debounce: a previous run reported nothing for this exact Frontier.
      if (gen.status === "caughtUp" && gen.frontierKey === frontier.key) {
        return { acquired: false, reason: "caught-up" };
      }
    }

    const patch = {
      status: "generating" as const,
      frontierKey: frontier.key,
      startedAt: now,
      error: undefined,
    };
    if (gen) await ctx.db.patch(gen._id, patch);
    else await ctx.db.insert("generation", { topicId: topic._id, ...patch });

    return { acquired: true, topicSlug, frontierKey: frontier.key };
  },
});

// Release the lock when the fire itself fails to land (network / config). The
// agent never started, so this is an internal failure, not an agent report.
export const failGeneration = internalMutation({
  args: { topicSlug: v.string(), error: v.string() },
  handler: async (ctx, { topicSlug, error }) => {
    const topic = await topicBySlug(ctx, topicSlug);
    if (!topic) return;
    const gen = await generationRow(ctx, topic._id);
    if (gen) await ctx.db.patch(gen._id, { status: "failed", error, startedAt: undefined });
  },
});

// ---- The agent's outcome report (PUBLISH_SECRET-guarded) -------------------

// Called by the cloud agent at the end of its run (in a `finally`). "published"
// clears the lock (the new Lesson advances the Frontier and closes the gate);
// "nothing" debounces this Frontier; "failed" surfaces a retry in the reader.
export const reportGeneration = mutation({
  args: {
    secret: v.string(),
    topicSlug: v.string(),
    outcome: v.union(v.literal("published"), v.literal("nothing"), v.literal("failed")),
    error: v.optional(v.string()),
  },
  handler: async (ctx, { secret, topicSlug, outcome, error }) => {
    assertAdmin(secret);
    const topic = await topicBySlug(ctx, topicSlug);
    if (!topic) throw new Error("topic not found");
    const gen = await generationRow(ctx, topic._id);
    if (!gen) return;
    if (outcome === "published") {
      await ctx.db.patch(gen._id, { status: "idle", startedAt: undefined, error: undefined });
    } else if (outcome === "nothing") {
      await ctx.db.patch(gen._id, { status: "caughtUp", startedAt: undefined, error: undefined });
    } else {
      await ctx.db.patch(gen._id, { status: "failed", startedAt: undefined, error: error ?? "run failed" });
    }
  },
});

// ---- Firing the routine ----------------------------------------------------

type FireResult = { fired: boolean; reason?: string; error?: string };

// Shared by the button and the cron: acquire the lock, then POST the routine's
// Fire URL with the Topic slug in the body. On a failed fire, release the lock.
async function fireForTopic(ctx: ActionCtx, topicSlug: string): Promise<FireResult> {
  const acquired: AcquireResult = await ctx.runMutation(internal.routine.tryAcquireGeneration, { topicSlug });
  if (!acquired.acquired) return { fired: false, reason: acquired.reason };

  try {
    const url = process.env.ROUTINE_FIRE_URL;
    const token = process.env.ROUTINE_FIRE_TOKEN;
    if (!url || !token) throw new Error("ROUTINE_FIRE_URL / ROUTINE_FIRE_TOKEN not set");
    // The run endpoint has a closed body schema (custom fields are rejected), so
    // we send none — the routine's instructions fix the Topic (v1: hindi).
    // Multi-topic will need a per-Topic routine or a supported input field; the
    // gate/lock are already Topic-keyed for that day. `topicSlug` is still used
    // locally for the lock and the agent's report.
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "anthropic-version": "2023-06-01",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({}),
    });
    if (!res.ok) throw new Error(`fire ${res.status}: ${await res.text()}`);
    return { fired: true };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    await ctx.runMutation(internal.routine.failGeneration, { topicSlug, error });
    return { fired: false, reason: "fire-error", error };
  }
}

// The reader button. Auth-gated; the gate inside still enforces the rest.
export const requestNextLesson = action({
  args: { topicSlug: v.string() },
  handler: async (ctx, { topicSlug }): Promise<FireResult> => {
    if (!(await getAuthUserId(ctx))) throw new Error("unauthenticated");
    return await fireForTopic(ctx, topicSlug);
  },
});

// ---- Daily cron ------------------------------------------------------------

export const listTopicSlugs = internalQuery({
  args: {},
  handler: async (ctx): Promise<string[]> => {
    const topics = await ctx.db.query("topics").collect();
    return topics.map((t) => t.slug);
  },
});

// Fires every ready Topic once a day. fireForTopic no-ops any Topic whose
// Frontier isn't completed, so most days this does nothing — by design.
export const dailyFire = internalAction({
  args: {},
  handler: async (ctx) => {
    const slugs: string[] = await ctx.runQuery(internal.routine.listTopicSlugs, {});
    for (const slug of slugs) {
      await fireForTopic(ctx, slug);
    }
  },
});
