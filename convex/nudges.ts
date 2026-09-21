import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { getOwnedTopic } from "./topicAccess";
import { scheduleInvite } from "./shares";
import { shareRole } from "./shareGrants";
import { SOURCE_LANG } from "./sourceLang";

// The two Sharing-tab nudges (2026-09-21). Both are the same shape: the owner
// picks one Edition, we work out who is sitting on something they never used, and
// we re-send them the one email that unblocks them.
//
//   1. Buyers who never started. An Entitlement on this Edition and not a single
//      Progress row on the Topic. They paid and never opened it.
//   2. Invited translators who never signed up. A pending invite on this Edition
//      with the Editor role, so there is no account to hold the Share yet.
//
// Both reuse the invite rail (convex/shares.ts scheduleInvite, convex/email.ts),
// which means the same Resend sender, the same tenant branding, and the same
// best-effort property: a bounced nudge never fails the mutation. Both link
// straight at the Edition, `/courses/<slug>?lang=<lang>`, which is a real URL for
// a signed-out translator too: AppGate renders sign-in in place at that URL, so
// creating the account lands them on the language they were asked to edit.
//
// Neither is scheduled or automatic. They fire only when the owner presses the
// button and confirms, so re-sending is the operator's judgement call and there is
// no unsubscribe rail to build for a cron that does not exist.

// Has this account opened anything at all in this Topic? One indexed read: the
// Frontier, the Certificate and the dashboard all derive from `progress`, so a
// single row of any status is the whole definition of "started".
async function hasStarted(ctx: QueryCtx, topicId: Id<"topics">, userId: Id<"users">): Promise<boolean> {
  const row = await ctx.db
    .query("progress")
    .withIndex("by_topic_user_lesson", (q) => q.eq("topicId", topicId).eq("userId", userId))
    .first();
  return row !== null;
}

// The buyers of one Edition who have never opened the Topic, by email. An
// Entitlement is the paid right to read a (Topic, language) pair, so scoping to
// `lang` is what keeps a Spanish buyer out of the Urdu edition's reminder. A row
// whose account has no email (or was deleted) is dropped rather than guessed at.
async function unstartedBuyers(ctx: QueryCtx, topicId: Id<"topics">, lang: string): Promise<string[]> {
  const held = (
    await ctx.db
      .query("entitlements")
      .withIndex("by_topic", (q) => q.eq("topicId", topicId))
      .collect()
  ).filter((e) => e.lang === lang);
  const emails: string[] = [];
  for (const e of held) {
    if (await hasStarted(ctx, topicId, e.userId)) continue;
    const user = await ctx.db.get(e.userId);
    if (user?.email) emails.push(user.email);
  }
  // One address may hold the Edition twice in principle (an Admin grant on top of
  // a purchase); dedup so nobody gets the same nudge twice from one press.
  return [...new Set(emails)];
}

// The invited translators of one Edition with no account yet: pending invites on
// this `lang` carrying the Editor role. An accepted Share is excluded by
// construction, it lives in `shares`, not `pendingShares`, so this email is only
// ever "you still need an account". Lang is matched in memory because legacy rows
// carry no `lang` and read as English, which an index eq cannot express.
async function pendingTranslators(ctx: QueryCtx, topicId: Id<"topics">, lang: string): Promise<string[]> {
  const pending = await ctx.db
    .query("pendingShares")
    .withIndex("by_topic", (q) => q.eq("topicId", topicId))
    .collect();
  return [
    ...new Set(
      pending.filter((p) => (p.lang ?? SOURCE_LANG) === lang && shareRole(p) === "editor").map((p) => p.email),
    ),
  ];
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
// confirmation. Owner-only, and it counts rather than lists: the Sharing tab only
// ever needs the number, and a count keeps the audience out of a client payload.
export const nudgeAudience = query({
  args: { topicSlug: v.string(), lang: v.string() },
  returns: v.object({ buyers: v.number(), translators: v.number() }),
  handler: async (ctx, { topicSlug, lang }) => {
    const { topic } = await ownedTopic(ctx, topicSlug);
    return {
      buyers: (await unstartedBuyers(ctx, topic._id, lang)).length,
      translators: (await pendingTranslators(ctx, topic._id, lang)).length,
    };
  },
});

// Schedule one nudge email per address, after the mutation commits. Returns how
// many were scheduled, which is what the tab reports back.
async function sendAll(
  ctx: MutationCtx,
  emails: string[],
  opts: { kind: "reminder" | "translator"; topic: Doc<"topics">; lang: string; inviterEmail: string },
): Promise<number> {
  for (const to of emails) {
    await scheduleInvite(ctx, {
      to,
      kind: opts.kind,
      topic: opts.topic,
      editionLang: opts.lang,
      inviterEmail: opts.inviterEmail,
      // A buyer holds a read seat; a pending translator was invited to edit.
      role: opts.kind === "reminder" ? "viewer" : "editor",
    });
  }
  return emails.length;
}

// Remind every buyer of this Edition who has never opened it. Owner-only.
export const remindUnstartedBuyers = mutation({
  args: { topicSlug: v.string(), lang: v.string() },
  returns: v.number(),
  handler: async (ctx, { topicSlug, lang }) => {
    const { topic, ownerEmail } = await ownedTopic(ctx, topicSlug);
    const emails = await unstartedBuyers(ctx, topic._id, lang);
    return await sendAll(ctx, emails, { kind: "reminder", topic, lang, inviterEmail: ownerEmail });
  },
});

// Nudge every invited translator of this Edition who has not created an account.
// Owner-only.
export const remindPendingTranslators = mutation({
  args: { topicSlug: v.string(), lang: v.string() },
  returns: v.number(),
  handler: async (ctx, { topicSlug, lang }) => {
    const { topic, ownerEmail } = await ownedTopic(ctx, topicSlug);
    const emails = await pendingTranslators(ctx, topic._id, lang);
    return await sendAll(ctx, emails, { kind: "translator", topic, lang, inviterEmail: ownerEmail });
  },
});
