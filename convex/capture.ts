import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { getOwnedTopic, getViewableTopic, loadEdition, readableLang, topicBySlug } from "./lib";
import { assertAdmin } from "./adminSecret";
import { assertTenantFlag } from "./tenantFlags";

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

// ---- Teacher Q&A: the per-Topic show/hide -----------------------------------

// Whether a Topic offers a question channel (teacher-qa, CONTEXT.md). The single
// place the ABSENCE MEANS ON rule is expressed: a Topic that has never had the
// field written reads exactly as one with it explicitly on, which is why the
// setting needs no migration and no backfill. Read it, never `topic.teacherQa`.
//
// Not to be confused with the `qa` TENANT feature flag (tenantFlags.ts), which is
// per tenant and refuses only the `askQuestion` mutation. That flag gates the
// asking; this setting decides the showing. Both exist on purpose.
export function teacherQaOn(topic: { teacherQa?: boolean }): boolean {
  return topic.teacherQa !== false;
}

// Turn the course's question channel on or off. **Owner-only**, resolved through
// the same owner-only path `catalogue.setEditionPublished` uses: neither an
// Editor, a Share holder nor a tenant Admin decides how someone's course teaches.
// Per Topic, so it applies to every Edition; the UI puts it on the source
// language tab alone.
export const setTeacherQa = mutation({
  args: { topicSlug: v.string(), enabled: v.boolean() },
  returns: v.null(),
  handler: async (ctx, { topicSlug, enabled }) => {
    const userId = await requireUser(ctx);
    const topic = await requireOwnedTopic(ctx, userId, topicSlug);
    // Written explicitly either way: `true` is stored rather than cleared, so the
    // owner's decision is legible in the row and reads the same as absence.
    await ctx.db.patch(topic._id, { teacherQa: enabled });
    return null;
  },
});

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

// Per-reader Progress: anyone with access (owner or shared Viewer) marks their
// own, keyed by their userId. A Viewer thus starts clean on a shared Topic (they
// have no rows) and their Progress never touches the owner's.
export const setProgress = mutation({
  args: { topicSlug: v.string(), lessonKey: v.string(), status: v.union(v.literal("opened"), v.literal("completed")) },
  handler: async (ctx, { topicSlug, lessonKey, status }) => {
    const userId = await requireUser(ctx);
    const topic = await getViewableTopic(ctx, userId, topicSlug);
    if (!topic) throw new Error("topic not found");
    const existing = await ctx.db
      .query("progress")
      .withIndex("by_topic_user_lesson", (q) => q.eq("topicId", topic._id).eq("userId", userId).eq("lessonKey", lessonKey))
      .unique();
    // Never downgrade completed → opened, but every write is still a read of
    // the lesson, so the resume stamp always moves (see myLastRead).
    if (existing) {
      if (existing.status === "completed") {
        await ctx.db.patch(existing._id, { lastReadAt: Date.now() });
        return;
      }
      await ctx.db.patch(existing._id, { status, lastReadAt: Date.now() });
      return;
    }
    await ctx.db.insert("progress", { userId, topicId: topic._id, lessonKey, status, lastReadAt: Date.now() });
  },
});

// Admin: read someone else's Progress on one Topic, so an operator can look before
// writing with `setProgressFor` below and check the result afterwards. Read-only and
// secret-guarded. `null` when no such registered user or no such Topic, which is
// itself the answer to "does this person even have an account".
export const readProgressFor = query({
  args: { secret: v.string(), email: v.string(), topicSlug: v.string() },
  returns: v.union(
    v.null(),
    v.array(v.object({ lessonKey: v.string(), status: v.string(), lastReadAt: v.union(v.number(), v.null()) })),
  ),
  handler: async (ctx, { secret, email, topicSlug }) => {
    assertAdmin(secret);
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email))
      .unique();
    const topic = await topicBySlug(ctx, topicSlug);
    if (!user || !topic) return null;
    const rows = await ctx.db
      .query("progress")
      .withIndex("by_topic_user_lesson", (q) => q.eq("topicId", topic._id).eq("userId", user._id))
      .collect();
    return rows
      .map((r) => ({ lessonKey: r.lessonKey, status: r.status, lastReadAt: r.lastReadAt ?? null }))
      .sort((a, b) => a.lessonKey.localeCompare(b.lessonKey));
  },
});

// Admin: set SOMEONE ELSE'S Progress, named by email. `setProgress` above is
// deliberately self-only (a reader marks their own, keyed by their own userId),
// which leaves no way to do the one thing an operator legitimately needs: place a
// reader at a lesson they reached outside the reader. That happens with a
// translator or reviewer who worked through a course in a spreadsheet rather than
// by clicking Next, and would otherwise have to re-open twenty-odd lessons by hand
// to stop the course telling them they are on lesson 1.
//
// Two rules are inherited from `setProgress` on purpose:
//
//   * completed is never downgraded to opened. An operator backfill must not be
//     able to erase a reader's own record of having finished something.
//   * every entry stamps `lastReadAt`, because that is what the resume point reads
//     (`myLastRead`). They are stamped in ARGUMENT ORDER, one millisecond apart, so
//     the caller's last entry is the newest and therefore the lesson the reader
//     lands on. Stamping them all with one `Date.now()` would leave the resume
//     point to sort order rather than intent.
export const setProgressFor = mutation({
  args: {
    secret: v.string(),
    email: v.string(),
    topicSlug: v.string(),
    entries: v.array(
      v.object({ lessonKey: v.string(), status: v.union(v.literal("opened"), v.literal("completed")) }),
    ),
  },
  returns: v.object({ inserted: v.number(), updated: v.number(), kept: v.number() }),
  handler: async (ctx, { secret, email, topicSlug, entries }) => {
    assertAdmin(secret);
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email))
      .unique();
    if (!user) throw new Error(`no registered user with email ${email}`);
    const topic = await topicBySlug(ctx, topicSlug);
    if (!topic) throw new Error(`no topic ${topicSlug}`);

    const base = Date.now() - entries.length;
    let inserted = 0;
    let updated = 0;
    let kept = 0;
    for (const [i, { lessonKey, status }] of entries.entries()) {
      const lastReadAt = base + i;
      const existing = await ctx.db
        .query("progress")
        .withIndex("by_topic_user_lesson", (q) =>
          q.eq("topicId", topic._id).eq("userId", user._id).eq("lessonKey", lessonKey),
        )
        .unique();
      if (!existing) {
        await ctx.db.insert("progress", { userId: user._id, topicId: topic._id, lessonKey, status, lastReadAt });
        inserted++;
      } else if (existing.status === "completed" && status === "opened") {
        await ctx.db.patch(existing._id, { lastReadAt });
        kept++;
      } else if (existing.status === status) {
        await ctx.db.patch(existing._id, { lastReadAt });
        kept++;
      } else {
        await ctx.db.patch(existing._id, { status, lastReadAt });
        updated++;
      }
    }
    return { inserted, updated, kept };
  },
});

// The caller's most recent read across ALL their topics: the app tab bar's
// "Course" tab and the Home resume card (mobile bottom nav, 2026-08-23). Ordered
// by lastReadAt via by_user_lastReadAt; rows without a stamp (pre-migration)
// sort oldest, so they still resolve when they're all the caller has. Each
// candidate re-passes the owner-or-Viewer gate: a topic that was deleted or
// un-shared since the read must not come back as a resume point.
export const myLastRead = query({
  args: {},
  returns: v.union(v.object({ topicSlug: v.string(), lessonKey: v.string() }), v.null()),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const rows = await ctx.db
      .query("progress")
      .withIndex("by_user_lastReadAt", (q) => q.eq("userId", userId))
      .order("desc")
      .take(5);
    for (const row of rows) {
      const topic = await ctx.db.get(row.topicId);
      if (!topic) continue;
      const viewable = await getViewableTopic(ctx, userId, topic.slug);
      if (viewable) return { topicSlug: topic.slug, lessonKey: row.lessonKey };
    }
    return null;
  },
});

// The caller's own per-lesson progress in a Topic, so the reader can show what's
// done (live). Resolves through the owner-or-Viewer gate and reads the *caller's*
// rows: an owner sees their own, and a Viewer sees their own (fresh on a Topic
// shared with them), never the owner's.
export const myProgress = query({
  args: { topicSlug: v.string() },
  handler: async (ctx, { topicSlug }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const topic = await getViewableTopic(ctx, userId, topicSlug);
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
    // Whitelabel: asking a question is create-side — gated by the tenant's `qa`
    // flag (no-op on the default site, issue 17). Reading the thread stays open.
    await assertTenantFlag(ctx, topic.tenantSlug, "qa");
    await ctx.db.insert("questions", { userId, topicId: topic._id, lessonKey, text, status: "open" });
  },
});

// The owner's questions + replies in a Topic, newest first (live). Owner-or-
// Viewer gated, reading the *owner's* thread: the owner sees their own Q&A, and
// a Viewer sees it read-only (PRD story 16). Asking (askQuestion) stays
// owner-only, so a Viewer reads the thread but can't add to it.
export const myQuestions = query({
  args: { topicSlug: v.string(), lang: v.optional(v.string()) },
  handler: async (ctx, { topicSlug, lang }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const topic = await getViewableTopic(ctx, userId, topicSlug);
    if (!topic?.ownerId) return [];
    // Teacher Q&A off (teacher-qa, CONTEXT.md): the question channel is withheld
    // HERE, on the read path, and not merely undrawn by the client. That is a
    // deliberate departure from `assertTenantFlag`'s rule that a flag never gates
    // reads, because a Guest's course bundle ships the owner's Q&A over the wire
    // (see the twin gate in public.publicCourse), so a client-side hide would
    // leave it readable in devtools. Please do not "fix" this back.
    //
    // One query, three silences: the desktop panel, the mobile block and the
    // sidebar reply dot all read this list. Nothing is deleted, so flipping the
    // setting back on restores the conversation exactly as it was.
    if (!teacherQaOn(topic)) return [];
    const ownerId = topic.ownerId;
    const effLang = await readableLang(ctx, topic, userId, lang ?? null);
    if (!effLang) return [];
    const rows = await ctx.db
      .query("questions")
      .withIndex("by_topic_user", (q) => q.eq("topicId", topic._id).eq("userId", ownerId))
      .collect();
    // Translated Q&A for the current Edition (question text/reply else source),
    // via the shared Edition reader.
    const m = await loadEdition(ctx, topic, effLang).map(["question"]);
    return rows
      .sort((a, b) => b._creationTime - a._creationTime)
      .map((q) => {
        const { text, reply } = m.question(q);
        return { id: q._id, lessonKey: q.lessonKey, text, status: q.status, reply };
      });
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
    // The learner is the owner — read their Progress, not any Viewer's.
    const progress = await ctx.db
      .query("progress")
      .withIndex("by_topic_user_lesson", (q) => q.eq("topicId", topic._id).eq("userId", owner._id))
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
