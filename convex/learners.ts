import type { QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";

// **Who counts as a learner on a course, and how far each has got.** One rule,
// one place. (Plain module, no Convex functions registered here.)
//
// Lifted out of `dashboard.ts` on 2026-09-21, when the Sharing tab's "remind the
// people who never started" nudge needed the *same* population the Dashboard's
// progress histogram draws. Two copies of this walk would have been two
// definitions of "not started" sitting one tab apart in the same UI, which is
// exactly the disagreement an operator reads as a bug: the chart says 23 and the
// button says 4.

// The `progress` scan's ceiling. The aggregate is one indexed range read over
// `by_topic_user_lesson` at `topicId`, every reader's every row for this course,
// grouped by reader in memory, which is readers x lessons documents per call.
// Past the cap this REFUSES TO GUESS, returning `truncated: true` and no counts
// rather than a histogram (or a mailing list) computed from a partial scan that
// would silently omit every reader the scan cut off. A denormalised per-reader
// counter is the fix if a real course ever trips this; at 8192 rows none is
// close (ui-overhaul ticket 14 counted 68 Shares across 14 courses).
export const PROGRESS_SCAN_CAP = 8192;

export type LearnerCompletion = {
  // One entry per learner, including the ones who have completed nothing (0).
  // Empty when `truncated`.
  completed: Map<Id<"users">, number>;
  // Live (non-superseded) Lessons, the denominator every percentage uses.
  lessonCount: number;
  truncated: boolean;
};

// Every learner account on a course, with how many live Lessons each has marked
// completed.
//
// A **learner** is any ACCOUNT that holds the course or has read it: a Share, an
// Entitlement (the one table every sold seat lands in, whichever rail sold it),
// a legacy enrollment, or nothing at all but a Progress row, which is how a
// reader of a free published Edition shows up. The owner is never one. A pending
// invite is never one either: it has no account, so it cannot have read
// anything.
//
// **Completion is course-wide, not per Edition.** A `progress` row carries a
// lesson key and no language, so a mark made in the Afrikaans edition counts
// once for that person on the course, which is what the operator ruled on
// 2026-09-01.
export async function learnerCompletion(ctx: QueryCtx, topic: Doc<"topics">): Promise<LearnerCompletion> {
  const ownerId = topic.ownerId;
  const accounts = new Set<Id<"users">>();

  const shares = await ctx.db.query("shares").withIndex("by_topic", (q) => q.eq("topicId", topic._id)).collect();
  for (const s of shares) if (s.viewerId !== ownerId) accounts.add(s.viewerId);
  const entitlements = await ctx.db
    .query("entitlements")
    .withIndex("by_topic", (q) => q.eq("topicId", topic._id))
    .collect();
  for (const e of entitlements) if (e.userId !== ownerId) accounts.add(e.userId);
  const enrollments = await ctx.db
    .query("enrollments")
    .withIndex("by_topic", (q) => q.eq("topicId", topic._id))
    .collect();
  for (const e of enrollments) if (e.userId !== ownerId) accounts.add(e.userId);

  const lessons = (
    await ctx.db.query("lessons").withIndex("by_topic_seq", (q) => q.eq("topicId", topic._id)).collect()
  ).filter((l) => !l.supersededBy);
  const live = new Set(lessons.map((l) => l.key));

  const rows = await ctx.db
    .query("progress")
    .withIndex("by_topic_user_lesson", (q) => q.eq("topicId", topic._id))
    .take(PROGRESS_SCAN_CAP + 1);
  const truncated = rows.length > PROGRESS_SCAN_CAP;
  if (truncated) return { completed: new Map(), lessonCount: lessons.length, truncated };

  const marks = new Map<Id<"users">, number>();
  for (const r of rows) {
    if (r.userId === ownerId) continue;
    // Someone reading a free published Edition holds no grant row at all, so
    // their progress is the only evidence they exist. Count them.
    accounts.add(r.userId);
    // A mark on a superseded Lesson is not progress through the course as it
    // stands today, so it counts for nothing.
    if (r.status !== "completed" || !live.has(r.lessonKey)) continue;
    marks.set(r.userId, (marks.get(r.userId) ?? 0) + 1);
  }

  const completed = new Map<Id<"users">, number>();
  for (const id of accounts) completed.set(id, marks.get(id) ?? 0);
  return { completed, lessonCount: lessons.length, truncated };
}
