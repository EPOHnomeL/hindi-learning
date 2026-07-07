import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { action, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  editionPrice,
  getOwnedTopic,
  getSeller,
  heldLangs,
  isReadySeller,
  normaliseEmail,
  sellerStatusOf,
  SOURCE_LANG,
  topicBySlug,
  topicLessonCounts,
} from "./lib";
import { langInfo } from "./languages";
import { applicationFee, appUrl, stripeClient } from "./stripe";
import { isCallerAdmin } from "./whitelist";

// Paid marketplace (ADR 0016) — the Edition **listing** (price) and
// **Entitlement** grants. A listing's PRESENCE makes an Edition paid; an
// Entitlement is a buyer's permanent right to read one paid Edition past its free
// Preview (the access resolver in lib.ts reads both).
//
// Pricing (set/clearEditionPrice) is the **Seller** action (Slice 2): the course
// OWNER, once they are a payouts-enabled Seller, prices each Edition of their
// *completed* course independently — no Stripe call, just the listing the access
// resolver reads. The `grant/revokeEntitlement` mutations are still TEMPORARY
// Admin/dev tools (Slice 3 replaces them with a signature-verified Stripe webhook).

const CURRENCY = /^[a-z]{3}$/;

// Set (or update) the price of an Edition (Topic, language), making it paid — the
// Seller pricing action (Slice 2). The caller must OWN the course, be a
// payouts-enabled Seller, and the course must be `completed`; the Edition must be
// one the owner holds (the source language or a ready translation). Setting a
// price is a pure DB write (the flag the access resolver reads) — no Stripe here.
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
    // absurd price (well above any real course, comfortably under Stripe's max).
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
        let title = topic.title;
        if (preferred !== SOURCE_LANG) {
          const t = await ctx.db
            .query("translations")
            .withIndex("by_topic_lang_kind_key", (q) =>
              q.eq("topicId", topic._id).eq("lang", preferred).eq("kind", "title").eq("key", ""),
            )
            .unique();
          if (t?.text) title = t.text;
        }
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

// ---- Purchase lifecycle (Slice 3 / 4): the money path ----------------------
//
// Access is granted ONLY by the signature-verified Stripe webhook (http.ts),
// never from the client success redirect — the HTTP action verifies the event
// and calls the two internal mutations below. Both are **idempotent on the Stripe
// event id** (Stripe retries deliveries): the same event never double-grants or
// double-revokes. Stripe is mocked at the action boundary; these mutations are
// pure Convex and fully tested.

// Whether this Stripe event has already been processed. Records it (inside the
// same transaction as the mint/revoke, so a rollback un-records it) and returns
// true if it was seen before — the caller no-ops on true.
async function alreadyProcessed(ctx: MutationCtx, eventId: string): Promise<boolean> {
  const seen = await ctx.db
    .query("stripeEvents")
    .withIndex("by_event", (q) => q.eq("eventId", eventId))
    .unique();
  if (seen) return true;
  await ctx.db.insert("stripeEvents", { eventId });
  return false;
}

// Grant access on a completed purchase (`checkout.session.completed`). If an
// account exists for the buyer's email, mint the Entitlement for that Edition;
// otherwise mint an email-keyed **pending** Entitlement that becomes real when
// that email signs up (`claimPendingEntitlements`). Idempotent per event and per
// (buyer, Topic, language) — a replay, or a buyer who already holds it, is a no-op.
export const fulfillPurchase = internalMutation({
  args: {
    eventId: v.string(),
    topicId: v.id("topics"),
    lang: v.string(),
    email: v.string(),
    paymentIntentId: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, { eventId, topicId, lang, email: rawEmail, paymentIntentId }) => {
    if (await alreadyProcessed(ctx, eventId)) return null;
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
        await ctx.db.insert("entitlements", { userId: user._id, topicId, lang, stripePaymentIntentId: paymentIntentId });
      }
    } else {
      const existing = await ctx.db
        .query("pendingEntitlements")
        .withIndex("by_topic_email_lang", (q) => q.eq("topicId", topicId).eq("email", email).eq("lang", lang))
        .unique();
      if (!existing) {
        await ctx.db.insert("pendingEntitlements", { email, topicId, lang, stripePaymentIntentId: paymentIntentId });
      }
    }
    return null;
  },
});

// Revoke access on a refund / dispute (Slice 4 — DEFENSIVE: the product offers no
// refunds, but if Stripe ever reports a refund or chargeback we keep access
// honest). Keyed on the PaymentIntent that paid for it (the deterministic link a
// Charge doesn't carry via metadata): deletes the Entitlement it minted — or the
// pending one if the buyer never signed up — leaving every other Edition/purchase
// untouched. Idempotent per event; a replay finds nothing to delete.
export const revokePurchaseByPaymentIntent = internalMutation({
  args: { eventId: v.string(), paymentIntentId: v.string() },
  returns: v.null(),
  handler: async (ctx, { eventId, paymentIntentId }) => {
    if (await alreadyProcessed(ctx, eventId)) return null;
    const ents = await ctx.db
      .query("entitlements")
      .withIndex("by_payment_intent", (q) => q.eq("stripePaymentIntentId", paymentIntentId))
      .collect();
    for (const e of ents) await ctx.db.delete(e._id);
    const pending = await ctx.db
      .query("pendingEntitlements")
      .withIndex("by_payment_intent", (q) => q.eq("stripePaymentIntentId", paymentIntentId))
      .collect();
    for (const p of pending) await ctx.db.delete(p._id);
    return null;
  },
});

// What the checkout action needs about an Edition to open a Stripe session: the
// price, the display title in that language, and the Seller's connected account
// + readiness. Null when the Edition isn't for sale. Internal (the action's read).
export const checkoutInfo = internalQuery({
  args: { topicSlug: v.string(), lang: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      topicId: v.id("topics"),
      lang: v.string(),
      title: v.string(),
      amount: v.number(),
      currency: v.string(),
      sellerAccountId: v.union(v.string(), v.null()),
      sellerReady: v.boolean(),
    }),
  ),
  handler: async (ctx, { topicSlug, lang }) => {
    const topic = await topicBySlug(ctx, topicSlug);
    if (!topic) return null;
    const listing = await editionPrice(ctx, topic._id, lang);
    if (!listing) return null; // not for sale
    const seller = topic.ownerId ? await getSeller(ctx, topic.ownerId) : null;
    // The display title in the requested language (translated title, else source).
    let title = topic.title;
    if (lang !== SOURCE_LANG) {
      const t = await ctx.db
        .query("translations")
        .withIndex("by_topic_lang_kind_key", (q) =>
          q.eq("topicId", topic._id).eq("lang", lang).eq("kind", "title").eq("key", ""),
        )
        .unique();
      if (t?.text) title = t.text;
    }
    return {
      topicId: topic._id,
      lang,
      title,
      amount: listing.amount,
      currency: listing.currency,
      sellerAccountId: seller?.stripeAccountId ?? null,
      sellerReady: sellerStatusOf(seller) === "ready",
    };
  },
});

// Start a purchase (Slice 3) — available to Guests. Creates a Stripe Checkout
// session as a **direct charge on the Seller's connected account** with the
// platform **application fee** (15%, see stripe.applicationFee), presenting the
// price in the buyer's local currency (Adaptive Pricing, enabled on the account).
// Access is NOT granted here — only the verified webhook grants it. Returns the
// hosted checkout URL for the client to redirect to.
export const startCheckout = action({
  args: { topicSlug: v.string(), lang: v.string(), returnPath: v.optional(v.string()) },
  returns: v.object({ url: v.string() }),
  handler: async (ctx, { topicSlug, lang, returnPath }): Promise<{ url: string }> => {
    const info = await ctx.runQuery(internal.market.checkoutInfo, { topicSlug, lang });
    if (!info) throw new Error("this edition isn't for sale");
    if (!info.sellerReady || !info.sellerAccountId) {
      throw new Error("this course isn't available for purchase right now");
    }
    const stripe = stripeClient();
    const editionName = info.lang === SOURCE_LANG ? "English" : langInfo(info.lang).name;
    const back = returnPath ?? `/courses/${topicSlug}${info.lang === SOURCE_LANG ? "" : `?lang=${info.lang}`}`;
    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: info.currency,
              unit_amount: info.amount,
              product_data: { name: `${info.title} — ${editionName} edition` },
            },
          },
        ],
        // Direct charge + application fee: the request runs on the connected
        // account (options below), so the charge is the Seller's and the platform
        // skims `application_fee_amount`. Metadata carries what the webhook grants.
        payment_intent_data: {
          application_fee_amount: applicationFee(info.amount),
          metadata: { topicId: info.topicId, lang: info.lang },
        },
        metadata: { topicId: info.topicId, lang: info.lang },
        success_url: appUrl(`${back}${back.includes("?") ? "&" : "?"}purchase=success`),
        cancel_url: appUrl(back),
      },
      { stripeAccount: info.sellerAccountId },
    );
    if (!session.url) throw new Error("Stripe did not return a checkout URL");
    return { url: session.url };
  },
});
