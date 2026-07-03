import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { getViewableTopic, mintToken, topicLessonCounts } from "./lib";
import { decodeEntities } from "./content";

// Certificates (ADR 0015). Two auth models live in this file, kept apart:
//   - `myCertificate` / `claimCertificate` are AUTHED and owner-or-Viewer gated
//     (getAuthUserId → getViewableTopic): the in-app earn + view path. Both the
//     owner and a shared Viewer can earn their own; a Guest (no account) can't.
//   - `publicCertificate` (slice 3) is the anonymous, token-only read seam — the
//     exact shape of public.ts, authorized by token and never by getAuthUserId,
//     with an explicit output allowlist.

// Eligibility is derived, never stored: the Topic is `completed` AND the caller
// has completed every non-superseded Lesson. Reuses `topicLessonCounts` — the
// same counts the dashboard progress bar shows — so eligibility can't drift from
// what the learner sees. An empty course (no non-superseded Lessons) certifies
// nothing.
async function isEligible(ctx: QueryCtx, topic: Doc<"topics">, userId: Id<"users">): Promise<boolean> {
  if (topic.status !== "completed") return false;
  const { lessonCount, completedCount } = await topicLessonCounts(ctx, topic._id, userId);
  return lessonCount > 0 && completedCount === lessonCount;
}

async function certificateFor(ctx: QueryCtx, topicId: Id<"topics">, userId: Id<"users">) {
  return await ctx.db
    .query("certificates")
    .withIndex("by_topic_user", (q) => q.eq("topicId", topicId).eq("userId", userId))
    .unique();
}

// The caller's own achievement on a Topic: the earned Certificate if they have
// one, plus an eligibility flag when they don't — enough for the reader,
// celebration, and dashboard to choose between "View certificate", a claim
// prompt, or nothing. Owner-or-Viewer gated; null when signed-out or no access.
// `issuedAt` is the row's immutable `_creationTime`.
export const myCertificate = query({
  args: { topicSlug: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      certificate: v.union(
        v.null(),
        v.object({
          token: v.string(),
          learnerName: v.string(),
          courseTitle: v.string(),
          lessonCount: v.number(),
          issuedAt: v.number(),
        }),
      ),
      eligible: v.boolean(),
    }),
  ),
  handler: async (ctx, { topicSlug }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const topic = await getViewableTopic(ctx, userId, topicSlug);
    if (!topic) return null;
    const row = await certificateFor(ctx, topic._id, userId);
    if (row) {
      return {
        certificate: {
          token: row.token,
          learnerName: row.learnerName,
          courseTitle: row.courseTitle,
          lessonCount: row.lessonCount,
          issuedAt: row._creationTime,
        },
        // Already earned — nothing left to claim.
        eligible: false,
      };
    }
    return { certificate: null, eligible: await isEligible(ctx, topic, userId) };
  },
});

// Claim (mint) the caller's Certificate. Owner-or-Viewer gated; idempotent — a
// second claim returns the existing row, never a duplicate, so a double-click or
// a reopen+re-complete can't re-mint (permanence). Re-checks eligibility
// server-side and refuses the ineligible. The name to print is a per-Certificate
// snapshot (no account display-name exists yet); blank/whitespace falls back to
// the email's local-part so the email itself never lands on a certificate.
// courseTitle + lessonCount are snapshotted at issue and never rewritten.
export const claimCertificate = mutation({
  args: { topicSlug: v.string(), name: v.string() },
  returns: v.object({
    token: v.string(),
    learnerName: v.string(),
    courseTitle: v.string(),
    lessonCount: v.number(),
    issuedAt: v.number(),
  }),
  handler: async (ctx, { topicSlug, name }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("unauthenticated");
    const topic = await getViewableTopic(ctx, userId, topicSlug);
    if (!topic) throw new Error("topic not found");

    // Idempotent: an existing Certificate wins, unchanged.
    const existing = await certificateFor(ctx, topic._id, userId);
    if (existing) {
      return {
        token: existing.token,
        learnerName: existing.learnerName,
        courseTitle: existing.courseTitle,
        lessonCount: existing.lessonCount,
        issuedAt: existing._creationTime,
      };
    }

    // Re-check eligibility and snapshot the lesson count from one read (the same
    // counts the dashboard shows). lessonCount is frozen onto the Certificate.
    if (topic.status !== "completed") throw new Error("not eligible");
    const { lessonCount, completedCount } = await topicLessonCounts(ctx, topic._id, userId);
    if (lessonCount === 0 || completedCount !== lessonCount) throw new Error("not eligible");

    const user = await ctx.db.get(userId);
    const fallback = (user?.email ?? "Learner").split("@")[0]!;
    const learnerName = name.trim() || fallback;
    const courseTitle = decodeEntities(topic.title);
    const token = mintToken();

    const id = await ctx.db.insert("certificates", {
      topicId: topic._id,
      userId,
      token,
      learnerName,
      courseTitle,
      lessonCount,
    });
    const row = (await ctx.db.get(id))!;
    return { token, learnerName, courseTitle, lessonCount, issuedAt: row._creationTime };
  },
});

// The anonymous Certificate read seam (ADR 0015) — the exact shape of public.ts.
// Authorized by TOKEN, never getAuthUserId, so it backs the account-less
// /certificate/[token] page. The `returns` validator is an explicit output
// allowlist: the achievement only (name, course, issue date, lesson count) —
// never the email, userId, topicId, or any Lesson content. A missing/invalid
// token returns uniform null, so certificates can't be enumerated.
export const publicCertificate = query({
  args: { token: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      learnerName: v.string(),
      courseTitle: v.string(),
      issuedAt: v.number(),
      lessonCount: v.number(),
    }),
  ),
  handler: async (ctx, { token }) => {
    if (!token) return null;
    const row = await ctx.db
      .query("certificates")
      .withIndex("by_token", (q) => q.eq("token", token))
      .unique();
    if (!row) return null;
    return {
      learnerName: row.learnerName,
      courseTitle: row.courseTitle,
      issuedAt: row._creationTime,
      lessonCount: row.lessonCount,
    };
  },
});
