import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { action, internalMutation, mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import {
  editionPrice,
  getOwnedTopic,
  heldLangs,
  isReadySeller,
  normaliseEmail,
  SOURCE_LANG,
  topicBySlug,
  topicLessonCounts,
  translatedTitle,
} from "./lib";
import { langInfo } from "./languages";
import { isCallerAdmin } from "./whitelist";

// Paid marketplace (ADR 0016, PayFast rail — .scratch/payfast-payments) — the
// Edition **listing** (price) and **Entitlement** grants. A listing's PRESENCE
// makes an Edition paid; an Entitlement is a buyer's permanent right to read one
// paid Edition past its free Preview (the access resolver in lib.ts reads both).
//
// Pricing (set/clearEditionPrice) is the **Seller** action: the course OWNER,
// once they are a ready Seller (can-sell grant + payout bank details), prices
// each Edition of their *completed* course independently — a pure DB write, the
// listing the access resolver reads. `grant/revokeEntitlement` are the manual
// Admin tools (revoke is the ONLY refund path — nothing automated).

const CURRENCY = /^[a-z]{3}$/;

// Set (or update) the price of an Edition (Topic, language), making it paid —
// the Seller pricing action. The caller must OWN the course, be a ready Seller,
// and the course must be `completed`; the Edition must be one the owner holds
// (the source language or a ready translation). Setting a price is a pure DB
// write (the flag the access resolver reads) — no gateway call.
export const setEditionPrice = mutation({
  args: { topicSlug: v.string(), lang: v.string(), amount: v.number(), currency: v.string() },
  returns: v.null(),
  handler: async (ctx, { topicSlug, lang, amount, currency }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("forbidden");
    const topic = await getOwnedTopic(ctx, userId, topicSlug);
    if (!topic) throw new Error("not your course");
    if (!(await isReadySeller(ctx, userId))) {
      throw new Error("you must be an approved Seller with payouts enabled to price a course");
    }
    if (topic.status !== "completed") throw new Error("only a completed course can be priced");
    // Only an Edition the owner actually holds (English source, or a language with
    // a ready translation) is sellable — you can't price a language you can't serve.
    if (!(await heldLangs(ctx, topic, userId)).has(lang)) {
      throw new Error("that edition isn't ready to sell");
    }
    // A bounded positive integer in minor units. `Number.isInteger` rejects NaN,
    // Infinity, and fractions; the ceiling keeps a stray value from becoming an
    // absurd price (R1,000,000 — well above any real course).
    if (!Number.isInteger(amount) || amount <= 0 || amount > 100_000_000) {
      throw new Error("amount must be a positive integer in the currency's minor units");
    }
    const cur = currency.trim().toLowerCase();
    if (!CURRENCY.test(cur)) throw new Error("currency must be a 3-letter ISO-4217 code");
    const existing = await editionPrice(ctx, topic._id, lang);
    if (existing) await ctx.db.patch(existing._id, { amount, currency: cur });
    else await ctx.db.insert("listings", { topicId: topic._id, lang, amount, currency: cur });
    return null;
  },
});

// Clear an Edition's price, making it free again (its Share / Public link revert
// to today's free behaviour). Owner-only — an owner can always un-list, even if
// their can-sell grant later lapsed. No-op if it wasn't priced.
export const clearEditionPrice = mutation({
  args: { topicSlug: v.string(), lang: v.string() },
  returns: v.null(),
  handler: async (ctx, { topicSlug, lang }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("forbidden");
    const topic = await getOwnedTopic(ctx, userId, topicSlug);
    if (!topic) throw new Error("not your course");
    const existing = await editionPrice(ctx, topic._id, lang);
    if (existing) await ctx.db.delete(existing._id);
    return null;
  },
});

// The priced Editions of a Topic (language + price), for the buy affordance and
// the demo. Not secret — the price is what a prospective buyer needs to see.
export const editionPricing = query({
  args: { topicSlug: v.string() },
  returns: v.array(v.object({ lang: v.string(), amount: v.number(), currency: v.string() })),
  handler: async (ctx, { topicSlug }) => {
    const topic = await topicBySlug(ctx, topicSlug);
    if (!topic) return [];
    const rows = await ctx.db
      .query("listings")
      .withIndex("by_topic", (q) => q.eq("topicId", topic._id))
      .collect();
    return rows
      .map((r) => ({ lang: r.lang, amount: r.amount, currency: r.currency }))
      .sort((a, b) => a.lang.localeCompare(b.lang));
  },
});

// The caller's purchased courses, as dashboard cards — the paid twin of
// `shares.listSharedTopics` (ADR 0016). An entitled buyer reads a course exactly
// like a Viewer, so this mirrors that query's shape: one card per Topic, grouping
// the Editions the buyer holds, with the buyer's OWN progress counts. The card
// title shows in an Edition they hold (English if bought, else their first).
export const myPurchases = query({
  args: {},
  returns: v.array(
    v.object({
      slug: v.string(),
      title: v.string(),
      mission: v.union(v.string(), v.null()),
      lessonCount: v.number(),
      completedCount: v.number(),
      langs: v.array(
        v.object({ lang: v.string(), name: v.string(), native: v.string(), rtl: v.boolean() }),
      ),
    }),
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const ents = await ctx.db
      .query("entitlements")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    // A buyer may hold several Editions of one Topic (one per language) — one card.
    const byTopic = new Map<Id<"topics">, Set<string>>();
    for (const e of ents) {
      const set = byTopic.get(e.topicId) ?? new Set<string>();
      set.add(e.lang);
      byTopic.set(e.topicId, set);
    }
    const cards = await Promise.all(
      [...byTopic.entries()].map(async ([topicId, langSet]) => {
        const topic = await ctx.db.get(topicId);
        if (!topic) return null;
        const counts = await topicLessonCounts(ctx, topic._id, userId);
        const langList = [...langSet].sort();
        const preferred = langList.includes(SOURCE_LANG) ? SOURCE_LANG : langList[0]!;
        const title = await translatedTitle(ctx, topic._id, preferred, topic.title);
        return {
          slug: topic.slug,
          title,
          mission: topic.mission ?? null,
          ...counts,
          langs: langList.map((l) => {
            const i = langInfo(l);
            return {
              lang: l,
              name: l === SOURCE_LANG ? "English" : i.name,
              native: l === SOURCE_LANG ? "English" : i.native,
              rtl: l === SOURCE_LANG ? false : !!i.rtl,
            };
          }),
        };
      }),
    );
    return cards.filter((c): c is NonNullable<typeof c> => c !== null);
  },
});

// Grant an Entitlement for one Edition to the account with this email, minting a
// buyer's permanent read access. Manual Admin tool — the normal path is the
// verified ITN (fulfillPurchase); this is the by-hand grant (comps, support).
// Idempotent per (buyer, Topic, language): a repeat is a no-op.
export const grantEntitlement = mutation({
  args: { email: v.string(), topicSlug: v.string(), lang: v.string() },
  returns: v.null(),
  handler: async (ctx, { email, topicSlug, lang }) => {
    if (!(await isCallerAdmin(ctx))) throw new Error("forbidden");
    const topic = await topicBySlug(ctx, topicSlug);
    if (!topic) throw new Error("topic not found");
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", normaliseEmail(email)))
      .unique();
    if (!user) throw new Error(`no account for ${email} — the buyer must sign up first`);
    const existing = await ctx.db
      .query("entitlements")
      .withIndex("by_topic_user", (q) => q.eq("topicId", topic._id).eq("userId", user._id))
      .collect();
    if (!existing.some((e) => e.lang === lang)) {
      await ctx.db.insert("entitlements", { userId: user._id, topicId: topic._id, lang });
    }
    return null;
  },
});

// Revoke a buyer's Entitlement for one Edition — the ONLY refund path (the
// product offers no refunds; nothing automated listens for them). Admin-only.
// No-op if there's no account or no matching grant; other languages the buyer
// holds are untouched.
export const revokeEntitlement = mutation({
  args: { email: v.string(), topicSlug: v.string(), lang: v.string() },
  returns: v.null(),
  handler: async (ctx, { email, topicSlug, lang }) => {
    if (!(await isCallerAdmin(ctx))) throw new Error("forbidden");
    const topic = await topicBySlug(ctx, topicSlug);
    if (!topic) throw new Error("topic not found");
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", normaliseEmail(email)))
      .unique();
    if (!user) return null;
    const rows = await ctx.db
      .query("entitlements")
      .withIndex("by_topic_user", (q) => q.eq("topicId", topic._id).eq("userId", user._id))
      .collect();
    for (const e of rows) if (e.lang === lang) await ctx.db.delete(e._id);
    return null;
  },
});

// ---- Purchase lifecycle: the money path -------------------------------------
//
// Access is granted ONLY by the verified PayFast ITN (http.ts — signature +
// amount match + server postback), never from the client return redirect. The
// ITN calls the idempotent `fulfillPurchase` below, keyed on **pf_payment_id**
// (PayFast re-delivers ITNs): the same payment never double-grants or
// double-writes the Ledger. PayFast is mocked at the HTTP boundary; this
// mutation is pure Convex and fully tested.

// Whether this PayFast payment has already been processed. Records it (inside
// the same transaction as the mint, so a rollback un-records it) and returns
// true if it was seen before — the caller no-ops on true.
async function alreadyProcessed(ctx: MutationCtx, pfPaymentId: string): Promise<boolean> {
  const seen = await ctx.db
    .query("payfastEvents")
    .withIndex("by_pf_payment_id", (q) => q.eq("pfPaymentId", pfPaymentId))
    .unique();
  if (seen) return true;
  await ctx.db.insert("payfastEvents", { pfPaymentId });
  return false;
}

// Grant access on a verified COMPLETE payment. If an account exists for the paid
// email, mint the Entitlement for that Edition; otherwise mint an email-keyed
// **pending** Entitlement that becomes real when that email signs up
// (`claimPendingEntitlements`). Idempotent per pf_payment_id and per
// (buyer, Topic, language) — a replay, or a buyer who already holds it, is a no-op.
// (Ticket 04 adds the Ledger write in this same transaction.)
export const fulfillPurchase = internalMutation({
  args: {
    pfPaymentId: v.string(),
    topicId: v.id("topics"),
    lang: v.string(),
    email: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, { pfPaymentId, topicId, lang, email: rawEmail }) => {
    if (await alreadyProcessed(ctx, pfPaymentId)) return null;
    const email = normaliseEmail(rawEmail);
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email))
      .unique();
    if (user) {
      const existing = await ctx.db
        .query("entitlements")
        .withIndex("by_topic_user", (q) => q.eq("topicId", topicId).eq("userId", user._id))
        .collect();
      if (!existing.some((e) => e.lang === lang)) {
        await ctx.db.insert("entitlements", { userId: user._id, topicId, lang, pfPaymentId });
      }
    } else {
      const existing = await ctx.db
        .query("pendingEntitlements")
        .withIndex("by_topic_email_lang", (q) => q.eq("topicId", topicId).eq("email", email).eq("lang", lang))
        .unique();
      if (!existing) {
        await ctx.db.insert("pendingEntitlements", { email, topicId, lang, pfPaymentId });
      }
    }
    return null;
  },
});

// Start a purchase — NEUTRALISED during the PayFast pivot (ticket 01): the
// Stripe checkout is gone and the PayFast signed-form checkout lands with
// ticket 03. Kept as a stub so the Paygate's buy dialog keeps compiling; it
// surfaces as the dialog's "try again in a moment" error.
export const startCheckout = action({
  args: { topicSlug: v.string(), lang: v.string(), returnPath: v.optional(v.string()) },
  returns: v.object({ url: v.string() }),
  handler: async (): Promise<{ url: string }> => {
    throw new Error("purchases are temporarily unavailable");
  },
});
