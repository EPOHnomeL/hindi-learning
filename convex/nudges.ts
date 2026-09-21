import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { getOwnedTopic } from "./topicAccess";
import { scheduleInvite } from "./shares";
import { shareRole } from "./shareGrants";
import { grantsFor } from "./grants";
import { learnerCompletion } from "./learners";
import { preferEdition } from "./editionPreference";
import { SOURCE_LANG } from "./sourceLang";

// The two Sharing-tab nudges (2026-09-21). Both are the same shape: the owner
// presses a button, we work out who is sitting on something they never used, and
// we re-send them the one email that unblocks them.
//
//   1. Learners who never started. Exactly the Dashboard's "Not started" bucket,
//      the people who have completed zero lessons.
//   2. Invited translators who never signed up. A pending invite carrying the
//      Editor role, so there is no account yet to hold the Share.
//
// **"Not started" means zero COMPLETED lessons, not "never opened".** That is the
// operator's definition (2026-09-21) and, more to the point, it is the one the
// Dashboard tab one click away already draws. Both now read it from the same
// `learners.learnerCompletion` walk, so the chart saying 23 and the button saying
// 4 is not a state this UI can get into. Someone who opened lesson one, read half
// of it and never ticked it is precisely who this email is for.
//
// **Both audiences are the whole course, every language, not the Edition the
// Sharing tab happens to be showing.** Scoping them per Edition is what the first
// cut did and it was wrong in the obvious way: the operator sits on the English
// source tab, where nobody is invited to translate and the learners are spread
// across af/bn/de/es, and both rows read zero while the Dashboard right next to
// them listed the people by name. The link carries the language instead: each
// recipient is mailed at their OWN Edition.
//
// Both ride the existing invite rail (convex/shares.ts scheduleInvite,
// convex/email.ts): same Resend sender, same tenant branding, same best-effort
// property, a bounced nudge never fails the mutation. The link is always
// `/courses/<slug>?lang=<their lang>`, which is a real URL for a signed-out
// translator too: AppGate renders sign-in in place at that URL, so creating the
// account lands them on the language they were asked to edit.
//
// Neither is scheduled or automatic. They fire only when the owner presses the
// button and confirms, so re-sending is the operator's judgement call and there
// is no unsubscribe rail to build for a cron that does not exist.

// One nudge: who to mail, and which Edition to land them in.
type Recipient = { email: string; lang: string };

// Which Edition to mail a learner at: the one they hold, preferring the source
// when they hold several. Through `grantsFor`, which is the one place the grant
// tables are read for a caller (ticket 28's boundary, and a boundary test keeps
// it that way) and which also resolves a free published Edition, the grant that
// is not a row. A learner can still hold nothing resolvable, and then the source
// Edition is the honest fallback.
async function editionFor(ctx: QueryCtx, topicId: Id<"topics">, userId: Id<"users">): Promise<string> {
  const grants = await grantsFor(ctx, topicId, userId);
  return preferEdition([...grants.keys()]) ?? SOURCE_LANG;
}

// The learners who have completed nothing, each with the Edition to mail them at.
// The population and the "completed" rule are `learnerCompletion`'s, so this is
// the Dashboard's "Not started" bucket and nothing else. An account with no email
// (deleted, or never had one) is dropped rather than guessed at.
async function notStartedLearners(ctx: QueryCtx, topic: Doc<"topics">): Promise<Recipient[]> {
  const { completed, truncated } = await learnerCompletion(ctx, topic);
  // Past the scan cap the walk refuses to guess, and so does this: mailing an
  // audience computed from a partial scan is worse than mailing nobody.
  if (truncated) return [];
  const out: Recipient[] = [];
  for (const [userId, marks] of completed) {
    if (marks > 0) continue;
    const user = await ctx.db.get(userId);
    if (!user?.email) continue;
    out.push({ email: user.email, lang: await editionFor(ctx, topic._id, userId) });
  }
  return out;
}

// The invited translators of this course with no account yet: every pending
// invite carrying the Editor role, in every language. An accepted Share is
// excluded by construction, it lives in `shares`, not `pendingShares`, so this
// email is only ever "you still need an account".
//
// One email per (address, language), not per address: someone invited to
// translate two Editions is waiting on two different things and each email links
// to its own. Legacy rows carry no `lang` and read as the source Edition.
async function pendingTranslators(ctx: QueryCtx, topicId: Id<"topics">): Promise<Recipient[]> {
  const pending = await ctx.db
    .query("pendingShares")
    .withIndex("by_topic", (q) => q.eq("topicId", topicId))
    .collect();
  const seen = new Set<string>();
  const out: Recipient[] = [];
  for (const p of pending) {
    if (shareRole(p) !== "editor") continue;
    const lang = p.lang ?? SOURCE_LANG;
    const key = `${p.email}|${lang}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ email: p.email, lang });
  }
  return out;
}

// Owner-only: resolve the Topic the nudge is about, or throw.
async function ownedTopic(ctx: QueryCtx, topicSlug: string): Promise<{ topic: Doc<"topics">; ownerEmail: string }> {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("unauthenticated");
  const topic = await getOwnedTopic(ctx, userId, topicSlug);
  if (!topic) throw new Error("topic not found");
  const owner = await ctx.db.get(userId);
  return { topic, ownerEmail: owner?.email ?? "" };
}

// How many people each nudge would reach, for the button subtitles and the
// confirmations. Owner-only, and it counts rather than lists: the Sharing tab
// only ever needs the number, and a count keeps the audience out of a client
// payload. Course-wide, so it does not take a language. `truncated` mirrors the
// Dashboard's: too much progress data to count, so the row says so instead of
// showing a zero it cannot stand behind.
export const nudgeAudience = query({
  args: { topicSlug: v.string() },
  returns: v.object({ notStarted: v.number(), translators: v.number(), truncated: v.boolean() }),
  handler: async (ctx, { topicSlug }) => {
    const { topic } = await ownedTopic(ctx, topicSlug);
    const { truncated } = await learnerCompletion(ctx, topic);
    return {
      notStarted: (await notStartedLearners(ctx, topic)).length,
      translators: (await pendingTranslators(ctx, topic._id)).length,
      truncated,
    };
  },
});

// Schedule one nudge email per recipient, after the mutation commits, each at its
// own Edition. Returns how many were scheduled, which is what the tab reports.
async function sendAll(
  ctx: MutationCtx,
  recipients: Recipient[],
  opts: { kind: "reminder" | "translator"; topic: Doc<"topics">; inviterEmail: string },
): Promise<number> {
  for (const { email, lang } of recipients) {
    await scheduleInvite(ctx, {
      to: email,
      kind: opts.kind,
      topic: opts.topic,
      editionLang: lang,
      inviterEmail: opts.inviterEmail,
      // A learner holds a read seat; a pending translator was invited to edit.
      role: opts.kind === "reminder" ? "viewer" : "editor",
    });
  }
  return recipients.length;
}

// Remind every learner on this course who has completed nothing. Owner-only.
export const remindNotStarted = mutation({
  args: { topicSlug: v.string() },
  returns: v.number(),
  handler: async (ctx, { topicSlug }) => {
    const { topic, ownerEmail } = await ownedTopic(ctx, topicSlug);
    return await sendAll(ctx, await notStartedLearners(ctx, topic), {
      kind: "reminder",
      topic,
      inviterEmail: ownerEmail,
    });
  },
});

// Nudge every invited translator of this course who has not created an account.
// Owner-only.
export const remindPendingTranslators = mutation({
  args: { topicSlug: v.string() },
  returns: v.number(),
  handler: async (ctx, { topicSlug }) => {
    const { topic, ownerEmail } = await ownedTopic(ctx, topicSlug);
    return await sendAll(ctx, await pendingTranslators(ctx, topic._id), {
      kind: "translator",
      topic,
      inviterEmail: ownerEmail,
    });
  },
});
