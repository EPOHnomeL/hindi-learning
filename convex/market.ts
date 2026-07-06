import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { editionPrice, normaliseEmail, topicBySlug } from "./lib";
import { isCallerAdmin } from "./whitelist";

// Paid marketplace (ADR 0016) — Slice 1 backend spine.
//
// This module owns the Edition **listing** (price) and **Entitlement** grants.
// A listing's PRESENCE makes an Edition paid; an Entitlement is a buyer's
// permanent right to read one paid Edition past its free Preview (the access
// resolver in lib.ts reads both). The set-price and grant mutations here are
// TEMPORARY Admin/dev tools so the whole paygate is demoable before Stripe
// exists: Slice 2 replaces set/clearEditionPrice with a Seller pricing action
// (guarded on payouts-enabled + a completed course), and Slice 3 replaces
// grant/revokeEntitlement with a signature-verified Stripe webhook. Every write
// here is Admin-gated so the temporary tools can't be poked by a normal user.

// Both grant/price paths are Admin-only in Slice 1 (identity derived server-side,
// never a client arg) — the same boundary the Allowlist portal uses.
const CURRENCY = /^[a-z]{3}$/;

// Set (or update) the price of an Edition (Topic, language), making it paid.
// TEMP Admin/dev tool — Slice 2's Seller pricing action supersedes it.
export const setEditionPrice = mutation({
  args: { topicSlug: v.string(), lang: v.string(), amount: v.number(), currency: v.string() },
  returns: v.null(),
  handler: async (ctx, { topicSlug, lang, amount, currency }) => {
    if (!(await isCallerAdmin(ctx))) throw new Error("forbidden");
    // A bounded positive integer in minor units. `Number.isInteger` rejects NaN,
    // Infinity, and fractions; the ceiling keeps a stray value from becoming an
    // absurd price (well above any real course, comfortably under Stripe's max).
    if (!Number.isInteger(amount) || amount <= 0 || amount > 100_000_000) {
      throw new Error("amount must be a positive integer in the currency's minor units");
    }
    const cur = currency.trim().toLowerCase();
    if (!CURRENCY.test(cur)) throw new Error("currency must be a 3-letter ISO-4217 code");
    const topic = await topicBySlug(ctx, topicSlug);
    if (!topic) throw new Error("topic not found");
    const existing = await editionPrice(ctx, topic._id, lang);
    if (existing) await ctx.db.patch(existing._id, { amount, currency: cur });
    else await ctx.db.insert("listings", { topicId: topic._id, lang, amount, currency: cur });
    return null;
  },
});

// Clear an Edition's price, making it free again (its Share / Public link revert
// to today's free behaviour). TEMP Admin/dev tool. No-op if it wasn't priced.
export const clearEditionPrice = mutation({
  args: { topicSlug: v.string(), lang: v.string() },
  returns: v.null(),
  handler: async (ctx, { topicSlug, lang }) => {
    if (!(await isCallerAdmin(ctx))) throw new Error("forbidden");
    const topic = await topicBySlug(ctx, topicSlug);
    if (!topic) throw new Error("topic not found");
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

// Grant an Entitlement for one Edition to the account with this email, minting a
// buyer's permanent read access. TEMP Admin/dev tool — Slice 3's verified Stripe
// webhook supersedes it (and adds the email-keyed pending grant for buyers with
// no account yet). Idempotent per (buyer, Topic, language): a repeat is a no-op.
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

// Revoke a buyer's Entitlement for one Edition (the manual twin of Slice 4's
// refund → revoke). TEMP Admin/dev tool. No-op if there's no account or no
// matching grant; other languages the buyer holds are untouched.
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
