import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { getOwnedTopic } from "./topicAccess";
import { scheduleInvite } from "./shares";
import { shareRole } from "./shareGrants";
import { preferEdition } from "./editionPreference";
import { SOURCE_LANG } from "./sourceLang";

// The two Sharing-tab nudges (2026-09-21). Both are the same shape: the owner
// presses a button, we work out who is sitting on something they never used, and
// we re-send them the one email that unblocks them.
//
//   1. Buyers who never started. An Entitlement on the course and not a single
//      Progress row. They hold a seat and never opened it.
//   2. Invited translators who never signed up. A pending invite carrying the
//      Editor role, so there is no account yet to hold the Share.
//
// **Both audiences are the whole course, every language, not the Edition the
// Sharing tab happens to be showing.** Scoping them per Edition is what the first
// cut did and it was wrong in the obvious way: the operator sits on the English
// source tab, where nobody is invited to translate and the buyers are spread
// across af/bn/de/es, and both rows read zero while the Dashboard right next to
// them lists the people by name. The link is what carries the language instead:
// each recipient is mailed at their OWN Edition.
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

// Every account that has opened ANY lesson of this Topic. One range read at
// `topicId`, which is how the Dashboard's rollup reads progress too: cheaper than
// a per-buyer lookup once a course has more than a handful of seats, and it makes
// "started" mean exactly what the Dashboard means by it.
async function startedAccounts(ctx: QueryCtx, topicId: Id<"topics">): Promise<Set<Id<"users">>> {
  const rows = await ctx.db
    .query("progress")
    .withIndex("by_topic_user_lesson", (q) => q.eq("topicId", topicId))
    .collect();
  return new Set(rows.map((r) => r.userId));
}

// The seat-holders of this course who have never opened it, whatever language
// they hold. `entitlements` is the one table a seat is written to, whichever rail
// sold it (PayFast, EFT, voucher, org Seat, Admin grant), so it is the whole
// "bought it" audience; `enrollments` is legacy and read-only, nothing writes it.
// A buyer holding several Editions is mailed ONCE, at the Edition `preferEdition`
// picks, so two languages is not two emails. The owner is skipped, and so is a
// row whose account is gone or has no email.
async function unstartedBuyers(ctx: QueryCtx, topic: Doc<"topics">): Promise<Recipient[]> {
  const held = await ctx.db
    .query("entitlements")
    .withIndex("by_topic", (q) => q.eq("topicId", topic._id))
    .collect();
  const started = await startedAccounts(ctx, topic._id);

  const langsByUser = new Map<Id<"users">, string[]>();
  for (const e of held) {
    if (e.userId === topic.ownerId || started.has(e.userId)) continue;
    langsByUser.set(e.userId, [...(langsByUser.get(e.userId) ?? []), e.lang]);
  }

  const out: Recipient[] = [];
  for (const [userId, langs] of langsByUser) {
    const user = await ctx.db.get(userId);
    const lang = preferEdition(langs);
    if (user?.email && lang) out.push({ email: user.email, lang });
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
// payload. Course-wide, so it does not take a language.
export const nudgeAudience = query({
  args: { topicSlug: v.string() },
  returns: v.object({ buyers: v.number(), translators: v.number() }),
  handler: async (ctx, { topicSlug }) => {
    const { topic } = await ownedTopic(ctx, topicSlug);
    return {
      buyers: (await unstartedBuyers(ctx, topic)).length,
      translators: (await pendingTranslators(ctx, topic._id)).length,
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
      // A buyer holds a read seat; a pending translator was invited to edit.
      role: opts.kind === "reminder" ? "viewer" : "editor",
    });
  }
  return recipients.length;
}

// Remind every buyer of this course who has never opened it. Owner-only.
export const remindUnstartedBuyers = mutation({
  args: { topicSlug: v.string() },
  returns: v.number(),
  handler: async (ctx, { topicSlug }) => {
    const { topic, ownerEmail } = await ownedTopic(ctx, topicSlug);
    return await sendAll(ctx, await unstartedBuyers(ctx, topic), {
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
