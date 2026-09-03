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
import { getOwnedTopic, topicBySlug } from "./lib";
import { assertAdmin } from "./adminSecret";
import { isCallerAdmin, isCallerUncapped } from "./whitelist";

// The next-lesson Routine (ADR 0008). One cloud Claude Code routine, fired two
// ways through one gate: a daily Convex cron (`dailyFire`) and the reader button
// (`requestNextLesson`). The gate authors the next Lesson iff the Frontier (the
// highest-seq, non-superseded Lesson) is `completed`. A per-Topic lock row makes
// it single-flight; the cloud agent reports the outcome back via
// `reportGeneration`. The agent advances whichever Topic it's fired for (slug in
// the fire body), so this stays multi-topic-ready with a single routine.

// A run stuck "generating" past this is treated as crashed and re-fireable.
const STALE_MS = 10 * 60 * 1000;

// ---- The authoring Provider axis (architecture-deepening/05) -----------------

// WHICH runtime writes a course's lessons (ADR 0014): the cloud claude.ai teach
// Routine, or the in-Convex OpenRouter authoring action. A per-COURSE choice.
//
// Deliberately not called just "provider": two other, unrelated selection axes
// live in translate.ts — a per-EDITION translation `engine` (`free` | `gemini`)
// and the deployment-wide `translationBackend()` (`gemini` | `openrouter`). Three
// axes, three distinct nouns, so no reader has to hold three meanings of one word.
export type AuthoringProvider = "claude" | "openrouter";

// A course's authoring Provider. ABSENT reads as `claude`, so every course
// predating the field keeps its behaviour and the field needed no migration —
// and THIS is the one place that fallback is stated, rather than restated at
// every read site. The stored column keeps its legacy name (`topics.provider`);
// renaming a live schema field would cost a widen-migrate-narrow deploy for a
// vocabulary win, so only the code vocabulary moved.
export function authoringProvider(topic: { provider?: AuthoringProvider }): AuthoringProvider {
  return topic.provider ?? "claude";
}

// The on-demand button caps a user to one manual fire per this window; the daily
// cron is the primary authoring path (issue 08 — bounds Claude usage). The cap is
// per USER (across all their Topics), not per Topic, so "1 additional lesson per
// day" holds even for a learner with several courses.
const DAY_MS = 24 * 60 * 60 * 1000;

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

async function isCompleted(
  ctx: QueryCtx,
  topicId: Id<"topics">,
  ownerId: Id<"users"> | undefined,
  lessonKey: string,
): Promise<boolean> {
  // The gate advances the *owner's* curriculum, so only the owner's completion
  // counts — a Viewer's Progress must never fire authoring. No owner (legacy
  // unowned Topic) → nothing to gate on. Scoped to this Topic so an identical
  // lessonKey in another Topic can't count.
  if (!ownerId) return false;
  const row = await ctx.db
    .query("progress")
    .withIndex("by_topic_user_lesson", (q) =>
      q.eq("topicId", topicId).eq("userId", ownerId).eq("lessonKey", lessonKey),
    )
    .unique();
  return row?.status === "completed";
}

async function generationRow(ctx: QueryCtx, topicId: Id<"topics">): Promise<Doc<"generation"> | null> {
  return await ctx.db
    .query("generation")
    .withIndex("by_topic", (q) => q.eq("topicId", topicId))
    .unique();
}

// Append one immutable Generation Run row (generation-observability, issue 01).
// The single write site for the run-history log, called at every terminal exit of
// a run (reportGeneration / failGeneration / expireUnclaimedFinish). Insert-once,
// like lessons/learningRecords — never patched or deleted. `startedAt` falls back
// to `endedAt` when the lock never stamped one (e.g. a fire that failed before it
// armed), so the row always has a bracket. The produced-Lesson fields are supplied
// only for a `published` run (the Frontier the run advanced to).
async function recordRun(
  ctx: MutationCtx,
  args: {
    topicId: Id<"topics">;
    outcome: "published" | "nothing" | "failed";
    startedAt: number | undefined;
    error?: string;
    producedLessonKey?: string;
    producedLessonTitle?: string;
  },
): Promise<void> {
  const endedAt = Date.now();
  await ctx.db.insert("generationRuns", {
    topicId: args.topicId,
    outcome: args.outcome,
    startedAt: args.startedAt ?? endedAt,
    endedAt,
    ...(args.error !== undefined ? { error: args.error } : {}),
    ...(args.producedLessonKey !== undefined ? { producedLessonKey: args.producedLessonKey } : {}),
    ...(args.producedLessonTitle !== undefined ? { producedLessonTitle: args.producedLessonTitle } : {}),
  });
}

// Has this user fired the on-demand button within the trailing DAY_MS, on ANY of
// their Topics? Each Topic's lock row stamps `lastManualFireAt` on a manual fire
// (retained across reports), so the per-user cap is just the max of those across
// the user's Topics. Backs the "1 additional lesson per user per day" gate.
async function userFiredManuallyWithinDay(
  ctx: QueryCtx,
  userId: Id<"users">,
  now: number,
): Promise<boolean> {
  const topics = await ctx.db
    .query("topics")
    .withIndex("by_owner", (q) => q.eq("ownerId", userId))
    .collect();
  for (const topic of topics) {
    const gen = await generationRow(ctx, topic._id);
    if (gen?.lastManualFireAt !== undefined && now - gen.lastManualFireAt < DAY_MS) return true;
  }
  return false;
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
      // A fire-and-pray run the Admin has asked to stop — the ⋯ shows "Cancelling…"
      // until the loop notices and clears the lock.
      cancelRequested: gen?.cancelRequested ?? false,
    };
  },
});

// ---- Admin observability (generation-observability, issue 02) --------------

// How many recent runs the history query returns. Bounded (no pagination) — for a
// handful of internal courses this is ample; add a cursor if it ever isn't.
const HISTORY_LIMIT = 100;

// A human label for the course owner a run authored for — the "who" behind a run.
// Prefers the display name, falls back to email, null for a legacy unowned Topic.
async function ownerLabel(ctx: QueryCtx, topic: Doc<"topics"> | null): Promise<string | null> {
  if (!topic?.ownerId) return null;
  const owner = await ctx.db.get(topic.ownerId);
  return owner?.name ?? owner?.email ?? null;
}

// What the Routine is authoring RIGHT NOW (sys-admin only). Reads the live
// `generation` lock, not the run log, so both the Claude Routine and the
// OpenRouter action path (which share the lock) appear with no extra work. A lock
// still "generating" past the 10-min stale window is flagged (crashed/stuck), not
// dropped. Newest-first by start.
export const generatingNow = query({
  args: {},
  returns: v.array(
    v.object({
      topicSlug: v.string(),
      topicTitle: v.string(),
      owner: v.union(v.string(), v.null()),
      startedAt: v.union(v.number(), v.null()),
      stale: v.boolean(),
    }),
  ),
  handler: async (ctx) => {
    if (!(await isCallerAdmin(ctx))) throw new Error("forbidden");
    const now = Date.now();
    const locks = (await ctx.db.query("generation").collect()).filter((g) => g.status === "generating");
    const rows = await Promise.all(
      locks.map(async (g) => {
        const topic = await ctx.db.get(g.topicId);
        return {
          topicSlug: topic?.slug ?? "(deleted)",
          topicTitle: topic?.title ?? "(deleted course)",
          owner: await ownerLabel(ctx, topic),
          startedAt: g.startedAt ?? null,
          stale: g.startedAt !== undefined && now - g.startedAt > STALE_MS,
        };
      }),
    );
    return rows.sort((a, b) => (b.startedAt ?? 0) - (a.startedAt ?? 0));
  },
});

// The Generation Run history (sys-admin only): recent runs newest-first, each
// joined to its Topic's title/slug. A run whose Topic was later deleted is kept
// (with a placeholder title) rather than dropped — the history is the record.
export const runHistory = query({
  args: {},
  returns: v.array(
    v.object({
      topicSlug: v.string(),
      topicTitle: v.string(),
      owner: v.union(v.string(), v.null()),
      outcome: v.union(v.literal("published"), v.literal("nothing"), v.literal("failed")),
      startedAt: v.number(),
      endedAt: v.number(),
      error: v.union(v.string(), v.null()),
      producedLessonKey: v.union(v.string(), v.null()),
      producedLessonTitle: v.union(v.string(), v.null()),
    }),
  ),
  handler: async (ctx) => {
    if (!(await isCallerAdmin(ctx))) throw new Error("forbidden");
    const runs = await ctx.db.query("generationRuns").order("desc").take(HISTORY_LIMIT);
    return await Promise.all(
      runs.map(async (r) => {
        const topic = await ctx.db.get(r.topicId);
        return {
          topicSlug: topic?.slug ?? "(deleted)",
          topicTitle: topic?.title ?? "(deleted course)",
          owner: await ownerLabel(ctx, topic),
          outcome: r.outcome,
          startedAt: r.startedAt,
          endedAt: r.endedAt,
          error: r.error ?? null,
          producedLessonKey: r.producedLessonKey ?? null,
          producedLessonTitle: r.producedLessonTitle ?? null,
        };
      }),
    );
  },
});

// Generation + translation usage over time, bucketed by day, for the admin
// Generation tab's activity graph (.scratch/admin-sales follow-up). Two series
// on one count axis:
//   - generation: `generationRuns` that did work — `published` or `failed`,
//     excluding `nothing` (the routine's idle "caught up" polls, which aren't
//     usage). Bucketed by `_creationTime` (≈ when the run finished).
//   - translation: `translationJobs` by `_creationTime` (when an edition's
//     translation was first started). There's no per-run translation log, so
//     this is the coarse-but-comparable signal — one event per edition, on the
//     same scale as a generation run, which keeps both honest on one axis.
// Days are UTC (integer `_creationTime / DAY`); the window is zero-filled so the
// time axis is continuous. `from`/`to` are ms (from inclusive, to exclusive),
// supplied by the caller (floored to the day, so the args stay stable across
// renders). Admin-only.
const USAGE_DAY_CAP = 366; // defensive: never return more than a year of buckets

export const usageByDay = query({
  args: { from: v.number(), to: v.number() },
  returns: v.array(
    v.object({
      dayMs: v.number(),
      generation: v.number(),
      translation: v.number(),
    }),
  ),
  handler: async (ctx, { from, to }) => {
    if (!(await isCallerAdmin(ctx))) throw new Error("forbidden");
    const DAY = 86_400_000;
    const startDay = Math.floor(from / DAY);
    const endDay = Math.floor((to - 1) / DAY);
    if (endDay < startDay) return [];

    const bump = (m: Map<number, number>, ts: number) => {
      const d = Math.floor(ts / DAY);
      m.set(d, (m.get(d) ?? 0) + 1);
    };

    const runs = await ctx.db
      .query("generationRuns")
      .withIndex("by_creation_time", (q) => q.gte("_creationTime", from).lt("_creationTime", to))
      .collect();
    const jobs = await ctx.db
      .query("translationJobs")
      .withIndex("by_creation_time", (q) => q.gte("_creationTime", from).lt("_creationTime", to))
      .collect();

    const gen = new Map<number, number>();
    for (const r of runs) if (r.outcome !== "nothing") bump(gen, r._creationTime);
    const tr = new Map<number, number>();
    for (const j of jobs) bump(tr, j._creationTime);

    const out: { dayMs: number; generation: number; translation: number }[] = [];
    const lastDay = Math.min(endDay, startDay + USAGE_DAY_CAP - 1);
    for (let d = startDay; d <= lastDay; d++) {
      out.push({ dayMs: d * DAY, generation: gen.get(d) ?? 0, translation: tr.get(d) ?? 0 });
    }
    return out;
  },
});

// ---- The gate + lock (atomic) ----------------------------------------------

type AcquireResult =
  | { acquired: true; topicSlug: string; frontierKey: string; authoringProvider: AuthoringProvider }
  | { acquired: false; reason: string };

// Check the gate and grab the lock in one transaction. Returns whether the
// caller should now fire the routine. The ONLY place that decides to author.
export const tryAcquireGeneration = internalMutation({
  args: { topicSlug: v.string(), manual: v.optional(v.boolean()) },
  handler: async (ctx, { topicSlug, manual }): Promise<AcquireResult> => {
    const topic = await topicBySlug(ctx, topicSlug);
    if (!topic) return { acquired: false, reason: "no-topic" };

    // A completed course (ADR 0015) never authors again — the load-bearing "stop
    // authoring" guarantee. Refuse before the Frontier check, so the daily cron,
    // the reader button, and setup all no-op; `reopenCourse` (status → active)
    // lifts it. The soft `caughtUp` state is a separate, non-terminal concern.
    if (topic.status === "completed") return { acquired: false, reason: "completed" };

    const frontier = await frontierLesson(ctx, topic._id);
    if (!frontier) {
      // Bootstrap (issue 07): a Seeded Topic with no Lessons fires once to draft
      // the Mission + Lesson 1. Any other Topic with no Frontier just no-ops.
      if (topic.status !== "seeded") return { acquired: false, reason: "no-frontier" };
    } else if (!(await isCompleted(ctx, topic._id, topic.ownerId, frontier.key))) {
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
    }
    // The on-demand button is capped to one manual fire per user per day, across
    // ALL their Topics, so a learner with several courses can't advance every one
    // at once and spike Claude usage (issue 08). The cron (manual=false) is the
    // primary authoring path and isn't capped. Bypassed by an Admin (they drive
    // authoring and aren't the runaway-usage risk it guards against) and by an
    // `unlimited` member (ADR 0032) for the same reason: it rides the same
    // `isCallerUncapped` question as seedTopic's per-day cap, so an author granted
    // the volume to seed many courses can also advance them, which is what made
    // that grant mean anything. Derived server-side from the forwarded identity,
    // never a client arg. Runs whether or not THIS Topic has a lock row yet (the
    // user may have fired a different Topic), so it sits outside the per-Topic
    // branch above. Checked last so the per-user scan only runs for an
    // otherwise-acceptable manual fire.
    if (manual && !(await isCallerUncapped(ctx))) {
      const userId = await getAuthUserId(ctx);
      if (userId && (await userFiredManuallyWithinDay(ctx, userId, now))) {
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

    // The fire step branches on this: `claude` POSTs the routine, `openrouter`
    // schedules the authoring action (the absent-reads-as-claude rule lives in
    // `authoringProvider`).
    return { acquired: true, topicSlug, frontierKey, authoringProvider: authoringProvider(topic) };
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
    if (!gen) return;
    // Also end any fire-and-pray run — the fire never landed, so nothing will
    // report back to advance it; leaving the flags set would strand the lock.
    await ctx.db.patch(gen._id, { status: "failed", error, startedAt: undefined, finishRemaining: undefined, cancelRequested: undefined });
    // A real run ended (failed to launch) — record it in the history (issue 01).
    await recordRun(ctx, { topicId: topic._id, outcome: "failed", startedAt: gen.startedAt, error });
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
    // The run's best-guess total Lesson count for the course (PRD: `~N lessons`).
    // Folded into the Topic here so there's no extra call — the estimate is part
    // of "here's how this run ended". Advisory only; it never gates authoring.
    estimatedLessons: v.optional(v.number()),
  },
  handler: async (ctx, { secret, topicSlug, outcome, error, estimatedLessons }) => {
    assertAdmin(secret);
    const topic = await topicBySlug(ctx, topicSlug);
    if (!topic) throw new Error("topic not found");
    // Patch the estimate when supplied; leave it untouched otherwise, so a later
    // `nothing`/`failed` run never wipes a prior estimate. Topic-level, so it's
    // independent of whether a generation lock row exists.
    if (estimatedLessons !== undefined) await ctx.db.patch(topic._id, { estimatedLessons });
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

    // Record the finished run for the operator's history (issue 01). On a
    // `published` run, stamp the Lesson it advanced to — the current Frontier
    // (highest-seq non-superseded), which is what this run just authored.
    const produced = outcome === "published" ? await frontierLesson(ctx, topic._id) : null;
    await recordRun(ctx, {
      topicId: topic._id,
      outcome,
      startedAt: gen.startedAt,
      error: outcome === "failed" ? (error ?? "run failed") : undefined,
      producedLessonKey: produced?.key,
      producedLessonTitle: produced?.title,
    });

    // Fire-and-pray continuation (Admin). Only a `published` lesson on a live,
    // un-cancelled finish run advances; `nothing`/`failed` (course complete, caught
    // up, or errored) end it. Continuing re-arms the lock and schedules the course's
    // OWN provider to author the next lesson (Claude routine or OpenRouter action) —
    // so a Claude course is never quietly billed to OpenRouter. Ending clears the
    // finish flags so the ⋯ menu returns to "Finish generating".
    const remaining = gen.finishRemaining ?? 0;
    if (remaining > 0) {
      if (outcome === "published" && !gen.cancelRequested) {
        const reArmedAt = Date.now();
        await ctx.db.patch(gen._id, {
          status: "generating",
          startedAt: reArmedAt,
          error: undefined,
          finishRemaining: remaining - 1,
          claimedAt: undefined,
          runId: undefined,
        });
        await ctx.scheduler.runAfter(0, internal.routine.refireFinish, { topicSlug });
        await ctx.scheduler.runAfter(FINISH_CLAIM_TIMEOUT_MS, internal.routine.expireUnclaimedFinish, {
          topicSlug,
          startedAt: reArmedAt,
        });
      } else {
        await ctx.db.patch(gen._id, { finishRemaining: undefined, cancelRequested: undefined });
      }
    } else if (gen.cancelRequested) {
      await ctx.db.patch(gen._id, { cancelRequested: undefined });
    }
  },
});

// ---- The agent's claim (PUBLISH_SECRET-guarded) ----------------------------

// A fired run can't be told its Topic (the Fire body is closed, ADR 0008), so it
// calls this to atomically grab one locked-but-unclaimed Topic and stamp its
// runId. Concurrent fires (fire-all) each claim a distinct Topic; surplus fires
// get null and no-op. Returns the claimed Topic's slug AND its owner's email, or
// null if none waiting.
//
// The owner email matters: the run learns *which learner* it's authoring for only
// here, and the owner-scoped steps (materialise/review/publish) need it. It's
// intrinsic to the claimed Topic (`ownerId`), so we resolve it rather than make a
// human supply OWNER_EMAIL out of band. `null` only if the Topic has no owner on
// record (legacy/unowned) — the caller then falls back to a manual OWNER_EMAIL.
export const claimWork = mutation({
  args: { secret: v.string(), runId: v.string() },
  handler: async (ctx, { secret, runId }): Promise<{ topicSlug: string; ownerEmail: string | null } | null> => {
    assertAdmin(secret);
    const rows = await ctx.db.query("generation").collect();
    const candidate = rows
      .filter((g) => g.status === "generating" && g.claimedAt === undefined)
      .sort((a, b) => (a.startedAt ?? 0) - (b.startedAt ?? 0))[0];
    if (!candidate) return null;
    await ctx.db.patch(candidate._id, { claimedAt: Date.now(), runId });
    const topic = await ctx.db.get(candidate.topicId);
    if (!topic) return null;
    const owner = topic.ownerId ? await ctx.db.get(topic.ownerId) : null;
    return { topicSlug: topic.slug, ownerEmail: owner?.email ?? null };
  },
});

// ---- Firing the routine ----------------------------------------------------

type FireResult = { fired: boolean; reason?: string; error?: string };

// Shared by the button and the cron: acquire the lock, then POST the routine's
// Fire URL with the Topic slug in the body. On a failed fire, release the lock.
async function fireForTopic(ctx: ActionCtx, topicSlug: string, manual: boolean): Promise<FireResult> {
  const acquired: AcquireResult = await ctx.runMutation(internal.routine.tryAcquireGeneration, { topicSlug, manual });
  if (!acquired.acquired) return { fired: false, reason: acquired.reason };

  // OpenRouter path (ADR 0014): author in a Convex action rather than the
  // claude.ai Routine. No `claim` protocol — hand the action its topic directly.
  // The gate/lock above is reused unchanged; the action reports via the same
  // `reportGeneration`. A failed schedule releases the lock, as the POST path does.
  if (acquired.authoringProvider === "openrouter") {
    try {
      await ctx.scheduler.runAfter(0, internal.openrouter.authorTopic, { topicSlug });
      return { fired: true };
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      await ctx.runMutation(internal.routine.failGeneration, { topicSlug, error });
      return { fired: false, reason: "fire-error", error };
    }
  }

  try {
    await postRoutineFire();
    return { fired: true };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    await ctx.runMutation(internal.routine.failGeneration, { topicSlug, error });
    return { fired: false, reason: "fire-error", error };
  }
}

// POST the claude.ai Routine's Fire URL. The run endpoint has a closed body schema
// (custom fields are rejected), so we send none — the routine claims a locked-but-
// unclaimed Topic itself (`claimWork`), so the fire body needn't name one. Throws
// on a missing config or a non-2xx, so callers can release the lock. Shared by the
// normal fire path and the fire-and-pray re-fire.
async function postRoutineFire(): Promise<void> {
  const url = process.env.ROUTINE_FIRE_URL;
  const token = process.env.ROUTINE_FIRE_TOKEN;
  if (!url || !token) throw new Error("ROUTINE_FIRE_URL / ROUTINE_FIRE_TOKEN not set");
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
}

// Does the signed-in caller own this Topic? The fire actions are owner-only —
// a Viewer must never trigger authoring on the owner's behalf (PRD story 22) —
// but actions have no `ctx.db`, so they check ownership through this query
// (which runs with the action's forwarded identity).
export const callerOwnsTopic = internalQuery({
  args: { topicSlug: v.string() },
  returns: v.boolean(),
  handler: async (ctx, { topicSlug }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return false;
    return (await getOwnedTopic(ctx, userId, topicSlug)) !== null;
  },
});

// The reader button. Owner-only (a Viewer can read but never fire authoring);
// the gate inside still enforces the rest.
export const requestNextLesson = action({
  args: { topicSlug: v.string() },
  handler: async (ctx, { topicSlug }): Promise<FireResult> => {
    if (!(await ctx.runQuery(internal.routine.callerOwnsTopic, { topicSlug }))) {
      throw new Error("topic not found");
    }
    return await fireForTopic(ctx, topicSlug, true);
  },
});

// Kick off setup for a (usually freshly seeded) Topic straight from the app — the
// dashboard calls this on create and from the "Set up now" button, so a learner
// never waits for the daily cron. Fired as non-manual on purpose: setup isn't the
// rate-limited on-demand button, so a failed fire (e.g. transient) can be retried
// immediately rather than being locked out by the 20h manual cooldown. The gate
// still no-ops anything that isn't ready (e.g. an in-flight or caught-up Topic).
export const requestSetup = action({
  args: { topicSlug: v.string() },
  handler: async (ctx, { topicSlug }): Promise<FireResult> => {
    if (!(await ctx.runQuery(internal.routine.callerOwnsTopic, { topicSlug }))) {
      throw new Error("topic not found");
    }
    return await fireForTopic(ctx, topicSlug, false);
  },
});

// ---- Admin: finish generating (fire & pray) --------------------------------

// The Admin "fire and pray" driver: author the whole remaining curriculum back to
// back, WITHOUT waiting for the learner to complete each Frontier lesson (the gate
// the daily cron / reader button obey). It is event-driven, not a self-contained
// loop: `startFinishGenerating` arms the lock with a `finishRemaining` budget and
// fires ONCE via the course's OWN provider; each time a lesson is reported back
// (`reportGeneration`), the report re-fires the next one until the budget hits 0,
// the course completes (ADR 0015), or the Admin cancels. Because every fire goes
// through the course's provider, a Claude course drives the claude.ai Routine (the
// Claude Code plan) and an OpenRouter course drives `authorTopic` — a Claude course
// is never billed to OpenRouter.

// Backstop against a never-completing (e.g. open-ended) mission: the teacher is
// told never to complete a lifelong mission, so an unbounded re-fire would author
// forever. Cap the lessons one fire-and-pray run adds.
const MAX_FINISH_LESSONS = 30;

// A fired finish run must claim its topic within this window. A fire is a blind
// POST — if the run it should start never claims (fire lost, crash in setup,
// plan limits), the armed lock would sit "Generating…" forever: nothing re-fires
// a finish loop. Past the window, `expireUnclaimedFinish` fails the row visibly.
const FINISH_CLAIM_TIMEOUT_MS = 15 * 60 * 1000;

// Actions have no `ctx.db`; the finish action checks admin-ness through this query
// (run with the action's forwarded identity), mirroring `callerOwnsTopic`.
export const callerIsAdmin = internalQuery({
  args: {},
  returns: v.boolean(),
  handler: async (ctx) => isCallerAdmin(ctx),
});

// The course's authoring Provider (ADR 0014), or null if the Topic is gone —
// `refireFinish` reads it to fire the RIGHT runtime for each lesson.
export const finishProvider = internalQuery({
  args: { topicSlug: v.string() },
  returns: v.union(v.literal("claude"), v.literal("openrouter"), v.null()),
  handler: async (ctx, { topicSlug }) => {
    const topic = await topicBySlug(ctx, topicSlug);
    if (!topic) return null;
    return authoringProvider(topic);
  },
});

// Arm the lock for a fire-and-pray run, bypassing the Frontier-completed gate (the
// whole point). Refuses a completed course and an in-flight run (so two admins
// can't drive the same course at once) and clears any stale cancel flag. Sets the
// `finishRemaining` budget that `reportGeneration` counts down.
export const startFinishGenerating = internalMutation({
  args: { topicSlug: v.string() },
  returns: v.object({ started: v.boolean(), reason: v.optional(v.string()) }),
  handler: async (ctx, { topicSlug }): Promise<{ started: boolean; reason?: string }> => {
    const topic = await topicBySlug(ctx, topicSlug);
    if (!topic) return { started: false, reason: "no-topic" };
    if (topic.status === "completed") return { started: false, reason: "completed" };
    const gen = await generationRow(ctx, topic._id);
    const now = Date.now();
    if (gen) {
      const stale = gen.startedAt !== undefined && now - gen.startedAt > STALE_MS;
      if (gen.status === "generating" && !stale) return { started: false, reason: "already-generating" };
    }
    const patch = {
      status: "generating" as const,
      startedAt: now,
      error: undefined,
      claimedAt: undefined,
      runId: undefined,
      finishRemaining: MAX_FINISH_LESSONS,
      cancelRequested: undefined,
    };
    if (gen) await ctx.db.patch(gen._id, patch);
    else await ctx.db.insert("generation", { topicId: topic._id, ...patch });
    await ctx.scheduler.runAfter(FINISH_CLAIM_TIMEOUT_MS, internal.routine.expireUnclaimedFinish, {
      topicSlug,
      startedAt: now,
    });
    return { started: true };
  },
});

// The finish-loop watchdog, scheduled at every finish fire. A no-op unless the
// SAME fire cycle (matched by `startedAt`) is still armed, generating, and
// unclaimed — i.e. no run ever picked it up. (The OpenRouter action never claims,
// but its ~10-min action cap means it has always reported by the time this runs.)
export const expireUnclaimedFinish = internalMutation({
  args: { topicSlug: v.string(), startedAt: v.number() },
  returns: v.null(),
  handler: async (ctx, { topicSlug, startedAt }) => {
    const topic = await topicBySlug(ctx, topicSlug);
    if (!topic) return null;
    const gen = await generationRow(ctx, topic._id);
    if (
      !gen ||
      gen.status !== "generating" ||
      gen.claimedAt !== undefined ||
      gen.startedAt !== startedAt ||
      gen.finishRemaining === undefined
    ) {
      return null;
    }
    const error = "finish run never claimed the topic (fire lost or run crashed before starting)";
    await ctx.db.patch(gen._id, {
      status: "failed",
      error,
      startedAt: undefined,
      finishRemaining: undefined,
      cancelRequested: undefined,
    });
    // Record the abandoned run so it's visible in the history (issue 01). `startedAt`
    // matches the fire cycle we just expired.
    await recordRun(ctx, { topicId: topic._id, outcome: "failed", startedAt, error });
    return null;
  },
});

// The Admin asked to stop a fire-and-pray run. Clear the budget immediately (so no
// further lesson is fired even if a report is racing) and flag it for the UI; the
// currently in-flight lesson still reports back and settles the lock.
export const requestCancelFinish = internalMutation({
  args: { topicSlug: v.string() },
  returns: v.null(),
  handler: async (ctx, { topicSlug }) => {
    const topic = await topicBySlug(ctx, topicSlug);
    if (!topic) return null;
    const gen = await generationRow(ctx, topic._id);
    if (gen) await ctx.db.patch(gen._id, { cancelRequested: true, finishRemaining: undefined });
    return null;
  },
});

// Fire ONE lesson through the course's own provider, with NO gate (the lock is
// already armed). OpenRouter → the in-deployment `authorTopic`; Claude → the
// claude.ai Routine POST (claimed by slug via `claimWork`). A failed Claude fire
// ends the run (`failGeneration` clears the finish flags). Scheduled by the start
// action for the first lesson and by `reportGeneration` for each subsequent one.
export const refireFinish = internalAction({
  args: { topicSlug: v.string() },
  returns: v.null(),
  handler: async (ctx, { topicSlug }) => {
    const provider = await ctx.runQuery(internal.routine.finishProvider, { topicSlug });
    if (provider === null) return null; // topic gone
    if (provider === "openrouter") {
      await ctx.scheduler.runAfter(0, internal.openrouter.authorTopic, { topicSlug });
      return null;
    }
    try {
      await postRoutineFire();
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      await ctx.runMutation(internal.routine.failGeneration, { topicSlug, error });
    }
    return null;
  },
});

// The dashboard ⋯ entry point (Admin-only). Arms the lock past the completion gate
// and fires the first lesson; `reportGeneration` chains the rest. `startFinish…`
// refuses a completed or already-running course.
export const finishGenerating = action({
  args: { topicSlug: v.string() },
  returns: v.object({ started: v.boolean(), reason: v.optional(v.string()) }),
  handler: async (ctx, { topicSlug }): Promise<{ started: boolean; reason?: string }> => {
    if (!(await ctx.runQuery(internal.routine.callerIsAdmin, {}))) throw new Error("forbidden");
    const res = await ctx.runMutation(internal.routine.startFinishGenerating, { topicSlug });
    if (!res.started) return res;
    await ctx.scheduler.runAfter(0, internal.routine.refireFinish, { topicSlug });
    return { started: true };
  },
});

// Stop a running fire-and-pray loop (Admin-only). Flags the lock; the loop halts
// after the current lesson (a model call already in flight can't be interrupted).
export const cancelFinishGenerating = action({
  args: { topicSlug: v.string() },
  returns: v.object({ cancelled: v.boolean() }),
  handler: async (ctx, { topicSlug }): Promise<{ cancelled: boolean }> => {
    if (!(await ctx.runQuery(internal.routine.callerIsAdmin, {}))) throw new Error("forbidden");
    await ctx.runMutation(internal.routine.requestCancelFinish, { topicSlug });
    return { cancelled: true };
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
// The whole materialised context for one Topic + owner, in one round-trip. Shared
// by the secret-guarded `materialiseTopic` (the Claude CLI seam) and the internal
// `materialiseForProvider` (the OpenRouter action seam), so both see identical
// context regardless of which path pulls it.
async function collectTopicContext(ctx: QueryCtx, topic: Doc<"topics">, owner: Doc<"users">) {
    // Bodies live in content blobs (.scratch/html-blob-storage); a query can't
    // read blob bytes, so expose a signed `htmlUrl` the materialise CLI fetches.
    const lessons = await Promise.all(
      (await ctx.db.query("lessons").withIndex("by_topic_seq", (q) => q.eq("topicId", topic._id)).collect())
        .filter((l) => !l.supersededBy)
        .map(async (l) => ({
          key: l.key,
          seq: l.seq,
          title: l.title,
          htmlUrl: l.htmlStorageId ? await ctx.storage.getUrl(l.htmlStorageId) : null,
        })),
    );
    const learningRecords = (
      await ctx.db.query("learningRecords").withIndex("by_topic_seq", (q) => q.eq("topicId", topic._id)).collect()
    ).map((r) => ({ key: r.key, seq: r.seq, markdown: r.markdown }));
    const references = await Promise.all(
      (await ctx.db.query("references").withIndex("by_topic", (q) => q.eq("topicId", topic._id)).collect()).map(
        async (r) => ({
          key: r.key,
          title: r.title,
          htmlUrl: r.htmlStorageId ? await ctx.storage.getUrl(r.htmlStorageId) : null,
        }),
      ),
    );
    const resources = await Promise.all(
      (await ctx.db.query("resources").withIndex("by_topic", (q) => q.eq("topicId", topic._id)).collect()).map(
        async (r) => ({
          id: r._id, // the stable key the teach skill mints Resource links from (rich-media/11)
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
    // The run authors for the owner, so materialise the owner's Progress only.
    const progress = await ctx.db
      .query("progress")
      .withIndex("by_topic_user_lesson", (q) => q.eq("topicId", topic._id).eq("userId", owner._id))
      .collect();

    // Fire-and-pray (finishRemaining armed): the loop authors past the learner's
    // pace by design, but each fired run is a fresh teacher that reads an unread
    // Frontier as "caught up for today" and reports `nothing` — which ends the
    // loop one lesson in. So while a finish run is armed, present a caught-up
    // learner: every current lesson reads as completed. The stored Progress rows
    // are untouched; only this materialised view is masked.
    const gen = await generationRow(ctx, topic._id);
    const progressView =
      gen?.finishRemaining !== undefined
        ? lessons.map((l) => ({ lessonKey: l.key, status: "completed" }))
        : progress.map((p) => ({ lessonKey: p.lessonKey, status: p.status as string }));

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
        progress: progressView,
      },
    };
}

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
    return await collectTopicContext(ctx, topic, owner);
  },
});

// The OpenRouter action's context seam. Internal (in-deployment, no secret), keyed
// by slug: it resolves the Topic's own owner, so the action never needs an owner
// email out of band. Adds the topicId (publish mutations key by it) and the
// current Frontier (highest-seq non-superseded Lesson, or null) so the action can
// pick the ongoing-vs-bootstrap path and compute the next seq. Null if the Topic
// or its owner is missing.
export const materialiseForProvider = internalQuery({
  args: { topicSlug: v.string() },
  handler: async (ctx, { topicSlug }) => {
    const topic = await topicBySlug(ctx, topicSlug);
    if (!topic || !topic.ownerId) return null;
    const owner = await ctx.db.get(topic.ownerId);
    if (!owner) return null;
    const frontier = await frontierLesson(ctx, topic._id);
    return {
      topicId: topic._id,
      // The owner's email — the publish mutations (publishMission, etc.) key by it,
      // and it's intrinsic to the Topic, so the action never supplies it out of band.
      ownerEmail: owner.email ?? null,
      authoringProvider: authoringProvider(topic),
      frontier: frontier ? { key: frontier.key, seq: frontier.seq } : null,
      ...(await collectTopicContext(ctx, topic, owner)),
    };
  },
});
