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
import { assertAdmin, getOwnedTopic, topicBySlug } from "./lib";

// The next-lesson Routine (ADR 0008). One cloud Claude Code routine, fired two
// ways through one gate: a daily Convex cron (`dailyFire`) and the reader button
// (`requestNextLesson`). The gate authors the next Lesson iff the Frontier (the
// highest-seq, non-superseded Lesson) is `completed`. A per-Topic lock row makes
// it single-flight; the cloud agent reports the outcome back via
// `reportGeneration`. The agent advances whichever Topic it's fired for (slug in
// the fire body), so this stays multi-topic-ready with a single routine.

// A run stuck "generating" past this is treated as crashed and re-fireable.
const STALE_MS = 10 * 60 * 1000;

// The on-demand button can fire a Topic at most once per this window; the daily
// cron is the primary authoring path (issue 08 — bounds Claude usage).
const MANUAL_COOLDOWN_MS = 20 * 60 * 60 * 1000;

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

async function isCompleted(ctx: QueryCtx, topicId: Id<"topics">, lessonKey: string): Promise<boolean> {
  // Scoped to this Topic: an identical lessonKey in another Topic must not count.
  // A Topic has one owner, so any completed row for it is the owner's.
  const rows = await ctx.db
    .query("progress")
    .withIndex("by_topic_lesson", (q) => q.eq("topicId", topicId).eq("lessonKey", lessonKey))
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
      // Raw timestamp; the client compares against the cooldown (queries can't
      // call Date.now()). Lets the button disable when fired within the window.
      lastManualFireAt: gen?.lastManualFireAt ?? null,
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
  args: { topicSlug: v.string(), manual: v.optional(v.boolean()) },
  handler: async (ctx, { topicSlug, manual }): Promise<AcquireResult> => {
    const topic = await topicBySlug(ctx, topicSlug);
    if (!topic) return { acquired: false, reason: "no-topic" };

    const frontier = await frontierLesson(ctx, topic._id);
    if (!frontier) {
      // Bootstrap (issue 07): a Seeded Topic with no Lessons fires once to draft
      // the Mission + Lesson 1. Any other Topic with no Frontier just no-ops.
      if (topic.status !== "seeded") return { acquired: false, reason: "no-frontier" };
    } else if (!(await isCompleted(ctx, topic._id, frontier.key))) {
      return { acquired: false, reason: "frontier-not-completed" };
    }
    // The lock key: the completed Frontier, or a sentinel for the bootstrap fire.
    const frontierKey = frontier?.key ?? "(seed)";

    const gen = await generationRow(ctx, topic._id);
    const now = Date.now();
    if (gen) {
      const stale = gen.startedAt !== undefined && now - gen.startedAt > STALE_MS;
      if (gen.status === "generating" && !stale) {
        return { acquired: false, reason: "already-generating" };
      }
      // Debounce: a previous run reported nothing for this exact Frontier.
      if (gen.status === "caughtUp" && gen.frontierKey === frontierKey) {
        return { acquired: false, reason: "caught-up" };
      }
      // The button is capped to once per cooldown; the cron (manual=false) isn't.
      if (manual && gen.lastManualFireAt !== undefined && now - gen.lastManualFireAt < MANUAL_COOLDOWN_MS) {
        return { acquired: false, reason: "rate-limited" };
      }
    }

    const base = {
      status: "generating" as const,
      frontierKey,
      startedAt: now,
      error: undefined,
      claimedAt: undefined, // fresh lock — unclaimed until a fired run grabs it
      runId: undefined,
    };
    const patch = manual ? { ...base, lastManualFireAt: now } : base;
    if (gen) await ctx.db.patch(gen._id, patch);
    else await ctx.db.insert("generation", { topicId: topic._id, ...patch });

    return { acquired: true, topicSlug, frontierKey };
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
    const clear = { startedAt: undefined, claimedAt: undefined, runId: undefined };
    if (outcome === "published") {
      await ctx.db.patch(gen._id, { status: "idle", error: undefined, ...clear });
    } else if (outcome === "nothing") {
      await ctx.db.patch(gen._id, { status: "caughtUp", error: undefined, ...clear });
    } else {
      await ctx.db.patch(gen._id, { status: "failed", error: error ?? "run failed", ...clear });
    }
  },
});

// ---- The agent's claim (PUBLISH_SECRET-guarded) ----------------------------

// A fired run can't be told its Topic (the Fire body is closed, ADR 0008), so it
// calls this to atomically grab one locked-but-unclaimed Topic and stamp its
// runId. Concurrent fires (fire-all) each claim a distinct Topic; surplus fires
// get null and no-op. Returns the claimed Topic's slug, or null if none waiting.
export const claimWork = mutation({
  args: { secret: v.string(), runId: v.string() },
  handler: async (ctx, { secret, runId }): Promise<{ topicSlug: string } | null> => {
    assertAdmin(secret);
    const rows = await ctx.db.query("generation").collect();
    const candidate = rows
      .filter((g) => g.status === "generating" && g.claimedAt === undefined)
      .sort((a, b) => (a.startedAt ?? 0) - (b.startedAt ?? 0))[0];
    if (!candidate) return null;
    await ctx.db.patch(candidate._id, { claimedAt: Date.now(), runId });
    const topic = await ctx.db.get(candidate.topicId);
    return topic ? { topicSlug: topic.slug } : null;
  },
});

// ---- Firing the routine ----------------------------------------------------

type FireResult = { fired: boolean; reason?: string; error?: string };

// Shared by the button and the cron: acquire the lock, then POST the routine's
// Fire URL with the Topic slug in the body. On a failed fire, release the lock.
async function fireForTopic(ctx: ActionCtx, topicSlug: string, manual: boolean): Promise<FireResult> {
  const acquired: AcquireResult = await ctx.runMutation(internal.routine.tryAcquireGeneration, { topicSlug, manual });
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
    return await fireForTopic(ctx, topicSlug, true);
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
      await fireForTopic(ctx, slug, false);
    }
  },
});

// ---- Materialise (PUBLISH_SECRET-guarded) ----------------------------------

// The whole context a claimed run needs, pulled in one round-trip: prior
// Lessons + References (with HTML), Resources (raw download URL + any cached
// `processed`), and Topic-scoped capture. The `materialise` CLI writes these to
// `topics/<slug>/` and the teach skill runs there (ADR 0009: the Routine pulls
// from Convex, never the repo). ponytail: returns all Lesson HTML in one query —
// fine for a curriculum's worth; paginate if a Topic ever grows huge.
export const materialiseTopic = query({
  args: { secret: v.string(), ownerEmail: v.string(), topicSlug: v.string() },
  handler: async (ctx, { secret, ownerEmail, topicSlug }) => {
    assertAdmin(secret);
    const owner = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", ownerEmail))
      .unique();
    if (!owner) return null;
    const topic = await getOwnedTopic(ctx, owner._id, topicSlug);
    if (!topic) return null;

    const lessons = (
      await ctx.db.query("lessons").withIndex("by_topic_seq", (q) => q.eq("topicId", topic._id)).collect()
    )
      .filter((l) => !l.supersededBy)
      .map((l) => ({ key: l.key, seq: l.seq, title: l.title, html: l.html }));
    const learningRecords = (
      await ctx.db.query("learningRecords").withIndex("by_topic_seq", (q) => q.eq("topicId", topic._id)).collect()
    ).map((r) => ({ key: r.key, seq: r.seq, markdown: r.markdown }));
    const references = (
      await ctx.db.query("references").withIndex("by_topic", (q) => q.eq("topicId", topic._id)).collect()
    ).map((r) => ({ key: r.key, title: r.title, html: r.html }));
    const resources = await Promise.all(
      (await ctx.db.query("resources").withIndex("by_topic", (q) => q.eq("topicId", topic._id)).collect()).map(
        async (r) => ({
          filename: r.filename,
          kind: r.kind,
          status: r.status,
          contentHash: r.contentHash,
          url: r.url ?? null, // external link, for kind: "url"
          rawUrl: r.rawStorageId ? await ctx.storage.getUrl(r.rawStorageId) : null, // signed blob URL, for kind: "file"
          processed: r.processed ?? null,
        }),
      ),
    );
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
      topic: {
        slug: topic.slug,
        title: topic.title,
        status: topic.status ?? "active",
        // The drafted Mission (null until the Routine drafts it) and the learner's
        // raw Seed ("why"). A seeded Topic has a seed but no mission yet — the run
        // drafts the mission from the seed + resources, then publishes it.
        mission: topic.mission ?? null,
        seed: topic.seed ?? null,
      },
      lessons,
      learningRecords,
      references,
      resources,
      capture: {
        openQuestions: open.map((q) => ({ id: q._id, lessonKey: q.lessonKey, text: q.text })),
        responses: responses.map((r) => ({ lessonKey: r.lessonKey, quizId: r.quizId, answer: r.answer, correct: r.correct })),
        progress: progress.map((p) => ({ lessonKey: p.lessonKey, status: p.status })),
      },
    };
  },
});
