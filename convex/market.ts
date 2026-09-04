import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { editionPrice, hasEntitlement, heldLangs, translatedTitle } from "./edition";
import { getOwnedTopic, topicBySlug } from "./topicAccess";
import { mintToken } from "./tokens";
import { normaliseEmail } from "./shareGrants";
import { SOURCE_LANG } from "./sourceLang";
import { isReadySeller } from "./sellerStatus";
import { topicLessonCounts } from "./progressCounts";
import { langInfo } from "./languages";
import { appUrl, buildCheckoutFields, platformFeeBps, processUrl, sellingEnabled, splitNet } from "./payfast";
import { isCallerAdmin } from "./whitelist";
import { chargeCents, regionForCountry } from "./regions";

// Paid marketplace (ADR 0016, PayFast rail — .scratch/payfast-payments) — the
// Edition **listing** (price) and **Entitlement** grants. A listing's PRESENCE
// makes an Edition paid; an Entitlement is a buyer's permanent right to read one
// paid Edition past its free Preview (the access resolver in edition.ts reads both).
//
// Pricing (set/clearEditionPrice) is the **Seller** action: the course OWNER,
// once they are a ready Seller (can-sell grant + payout bank details), prices
// each Edition of their *completed* course independently — a pure DB write, the
// listing the access resolver reads. `grant/revokeEntitlement` are the manual
// Admin tools (revoke is the ONLY refund path — nothing automated).


// Set (or update) the price of an Edition (Topic, language), making it paid —
// the Seller pricing action. The caller must OWN the course, be a ready Seller,
// and the course must be `completed`; the Edition must be one the owner holds
// (the source language or a ready translation). Setting a price is a pure DB
// write (the flag the access resolver reads) — no gateway call.
export const setEditionPrice = mutation({
  args: {
    topicSlug: v.string(),
    lang: v.string(),
    amount: v.number(),
    currency: v.string(),
    // The **regional** price points (ticket 11), in the FOREIGN currency's minor
    // units. Omitting one is how a seller withdraws that regional price — it is
    // never read as "leave what was there", or a price could never be un-set.
    usdAmount: v.optional(v.number()),
    eurAmount: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, { topicSlug, lang, amount, currency, usdAmount, eurAmount }) => {
    // Selling must be live before a listing can exist — either the deployment's
    // PayFast rail isn't configured, or PAYFAST_MODE=off has paused it. A listing
    // that checkout can't sell must never come into being. Env is read at call
    // time: provisioning the vars (and clearing the pause) enables selling.
    if (!sellingEnabled()) {
      throw new Error("Selling is disabled on this deployment.");
    }
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
    // A bounded positive integer in minor units — the same rule for the base
    // ZAR price and for each regional one, since all three end up as money.
    const bounded = (n: number) => Number.isInteger(n) && n > 0 && n <= 100_000_000;
    if (!bounded(amount)) {
      throw new Error("amount must be a positive integer in the currency's minor units");
    }
    if ((usdAmount !== undefined && !bounded(usdAmount)) || (eurAmount !== undefined && !bounded(eurAmount))) {
      throw new Error("a regional price must be a positive integer in that currency's minor units");
    }
    // ZAR-only (.scratch/payfast-payments): PayFast settles in Rand, so a price
    // in any other currency would be a lie the checkout can't honour. `currency`
    // describes the BASE price only — the regional amounts above are quoted in
    // USD/EUR but still charged as Rand (ticket 11: presentment, not a new rail).
    const cur = currency.trim().toLowerCase();
    if (cur !== "zar") throw new Error("prices are in South African Rand (ZAR) only");
    const existing = await editionPrice(ctx, topic._id, lang);
    // `usdAmount`/`eurAmount` are written on every save, undefined included, so
    // an omitted field clears the regional price rather than silently keeping it.
    const row = { amount, currency: cur, usdAmount, eurAmount };
    if (existing) await ctx.db.patch(existing._id, row);
    else await ctx.db.insert("listings", { topicId: topic._id, lang, ...row });
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
  // The regional price points ride along so the seller's editor can re-open on
  // what they last saved: a save writes all three, so a form that couldn't read
  // the foreign two back would withdraw them on every edit of the Rand price.
  returns: v.array(
    v.object({
      lang: v.string(),
      amount: v.number(),
      currency: v.string(),
      usdAmount: v.optional(v.number()),
      eurAmount: v.optional(v.number()),
    }),
  ),
  handler: async (ctx, { topicSlug }) => {
    const topic = await topicBySlug(ctx, topicSlug);
    if (!topic) return [];
    const rows = await ctx.db
      .query("listings")
      .withIndex("by_topic", (q) => q.eq("topicId", topic._id))
      .collect();
    return rows
      .map((r) => ({ lang: r.lang, amount: r.amount, currency: r.currency, usdAmount: r.usdAmount, eurAmount: r.eurAmount }))
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
    if (!(await hasEntitlement(ctx, topic._id, user._id, lang))) {
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

// Grant access on a verified COMPLETE payment AND record what the operator now
// owes the Seller — one seam, one transaction ("money in + what we owe"). The
// intent email is an ACCOUNT's (auth-first checkout froze it at Buy), so the
// Entitlement mints directly onto that user; no account means something is
// deeply wrong and the mutation throws — the rollback un-records the
// payfastEvents row too, so PayFast's ITN retry re-runs it whole and money is
// never silently dropped. The Ledger row records the ITN's gross/fee/net
// (cents) with the net split 50/50 (splitNet), status `owed`. Idempotent per
// pf_payment_id and per (buyer, Topic, language) — a replay, or a buyer who
// already holds it, is a no-op.
export const fulfillPurchase = internalMutation({
  args: {
    pfPaymentId: v.string(),
    topicId: v.id("topics"),
    lang: v.string(),
    email: v.string(),
    gross: v.number(),
    fee: v.number(),
    net: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, { pfPaymentId, topicId, lang, email: rawEmail, gross, fee, net }) => {
    // Internal (only the verified ITN calls this), but money is money: the
    // amounts must be sane non-negative integer cents.
    for (const n of [gross, fee, net]) {
      if (!Number.isInteger(n) || n < 0) throw new Error("ledger amounts must be non-negative integer cents");
    }
    if (await alreadyProcessed(ctx, pfPaymentId)) return null;
    const email = normaliseEmail(rawEmail);
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email))
      .unique();
    if (!user) throw new Error(`no account for intent email — cannot fulfil ${pfPaymentId}`);
    if (!(await hasEntitlement(ctx, topicId, user._id, lang))) {
      await ctx.db.insert("entitlements", { userId: user._id, topicId, lang, pfPaymentId });
    }
    // The Ledger row — what this sale means in money. A throw here rolls back
    // the grant AND the payfastEvents row, so PayFast's retry re-runs it whole.
    const topic = await ctx.db.get(topicId);
    if (!topic?.ownerId) throw new Error("sold course has no owner to owe");
    const { sellerShare, platformShare } = splitNet(net, platformFeeBps());
    await ctx.db.insert("ledger", {
      topicId,
      lang,
      sellerId: topic.ownerId,
      buyerEmail: email,
      gross,
      fee,
      net,
      sellerShare,
      platformShare,
      pfPaymentId,
      kind: "sale",
      status: "owed",
    });
    return null;
  },
});

// The state of a purchase as seen from the return page, resolved from the
// checkout-intent by its unguessable `m_payment_id` (a bearer capability, like
// a Public link — that's what authorises this read). Drives the confirming
// banner:
//   awaiting-payment — intent exists, the ITN hasn't landed yet (the banner
//                      shows; this query is reactive, so it resolves the
//                      moment the ITN writes)
//   granted          — the intent's account holds the Entitlement
// Carries NO email — a bearer-token query must not leak PII. Read-only and
// grants nothing: access still comes only from the verified ITN.
export const checkoutStatus = query({
  args: { mPaymentId: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      lang: v.string(),
      state: v.union(v.literal("awaiting-payment"), v.literal("granted")),
    }),
  ),
  handler: async (ctx, { mPaymentId }) => {
    const intent = await ctx.db
      .query("checkoutIntents")
      .withIndex("by_m_payment_id", (q) => q.eq("mPaymentId", mPaymentId))
      .unique();
    if (!intent) return null;
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", intent.email))
      .unique();
    if (user && (await hasEntitlement(ctx, intent.topicId, user._id, intent.lang))) {
      return { lang: intent.lang, state: "granted" as const };
    }
    return { lang: intent.lang, state: "awaiting-payment" as const };
  },
});

// The checkout-intent behind an ITN's `m_payment_id` — the ITN's source of
// truth for WHAT was bought (topic/lang), for WHOM (the buyer's ACCOUNT email,
// frozen at Buy — the ITN's own email_address may be the buyer's PayFast
// account address instead), and at WHAT PRICE (the listing as shown at Buy
// time, so a re-price/un-list after Buy never strands a genuine payment). Null
// when no Buy click ever minted the reference.
export const checkoutIntentByRef = internalQuery({
  args: { mPaymentId: v.string() },
  returns: v.union(
    v.null(),
    v.object({ topicId: v.id("topics"), lang: v.string(), email: v.string(), amount: v.number() }),
  ),
  handler: async (ctx, { mPaymentId }) => {
    const intent = await ctx.db
      .query("checkoutIntents")
      .withIndex("by_m_payment_id", (q) => q.eq("mPaymentId", mPaymentId))
      .unique();
    if (!intent) return null;
    return { topicId: intent.topicId, lang: intent.lang, email: intent.email, amount: intent.amount };
  },
});

// Start a purchase — auth-first (ADR 0021): the caller must be signed in, and
// the purchase email is their ACCOUNT's, never an argument — impersonation-via-
// checkout and typo-stranding both die at this seam. Confirms the Edition is
// priced and its Seller is ready, persists a **checkout-intent** (m_payment_id
// → account email, topic, lang — what the ITN grants to), and returns the
// signed PayFast field set for the client to form-POST to the hosted process
// URL. Access is NOT granted here — only the verified ITN (/payfast/notify)
// grants. A mutation, not an action: PayFast's checkout needs no network call
// from us, so the intent write and the field build are one transaction (a
// rejected checkout writes nothing).
export const startCheckout = mutation({
  args: {
    topicSlug: v.string(),
    lang: v.string(),
    // The buyer's `x-vercel-ip-country`, read from `headers()` in the checkout
    // server component and passed through — Convex runs off Vercel and can never
    // see the header itself (ticket 10). **Only the country crosses this
    // boundary, never an amount**: the price is derived here, or a client could
    // name its own. Optional because localhost sends no header, and absent
    // resolves to the base price.
    country: v.optional(v.string()),
  },
  // `fields` is an ORDERED list of pairs, not a record: Convex sorts object
  // keys, and PayFast's signature is computed over the field order — the client
  // must POST them in exactly this order.
  returns: v.object({ action: v.string(), fields: v.array(v.object({ name: v.string(), value: v.string() })) }),
  handler: async (ctx, { topicSlug, lang, country }) => {
    // Selling can be paused platform-wide (PAYFAST_MODE=off) even with the rail
    // provisioned — e.g. while the merchant account is blocked. No checkout may
    // start, so no buyer is ever sent to a gateway that would 400 them.
    if (!sellingEnabled()) throw new Error("this edition isn't for sale right now");
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("sign in to buy — a purchase attaches to your account");
    const user = await ctx.db.get(userId);
    if (!user?.email) throw new Error("your account has no email address");
    // users.email is stored normalised at sign-up; normalise again anyway so the
    // intent row can never disagree with the ITN's comparison.
    const email = normaliseEmail(user.email);
    const topic = await topicBySlug(ctx, topicSlug);
    if (!topic) throw new Error("this edition isn't for sale");
    const listing = await editionPrice(ctx, topic._id, lang);
    if (!listing) throw new Error("this edition isn't for sale");
    // The Seller must still be ready (grant + payout bank details): a sale with
    // nowhere to send the Seller's cut must never start.
    if (!topic.ownerId || !(await isReadySeller(ctx, topic.ownerId))) {
      throw new Error("this course isn't available for purchase right now");
    }

    const merchantId = process.env.PAYFAST_MERCHANT_ID;
    const merchantKey = process.env.PAYFAST_MERCHANT_KEY;
    const passphrase = process.env.PAYFAST_PASSPHRASE;
    if (!merchantId || !merchantKey || !passphrase) {
      throw new Error("PAYFAST_MERCHANT_ID / PAYFAST_MERCHANT_KEY / PAYFAST_PASSPHRASE are not set — provision them as Convex env vars");
    }

    const mPaymentId = mintToken();
    // The **regional** charge (ticket 11), derived here from the country and
    // never accepted from the caller. For a base-region buyer this is exactly
    // `listing.amount` and nothing about the rail changes.
    const amountCents = chargeCents(listing, regionForCountry(country));
    // The intent freezes the price SHOWN at this Buy click — what the ITN's
    // amount match verifies against, so a later re-price never strands the payment.
    await ctx.db.insert("checkoutIntents", { mPaymentId, email, topicId: topic._id, lang, amount: amountCents });

    const title = await translatedTitle(ctx, topic._id, lang, topic.title);
    const editionName = lang === SOURCE_LANG ? "English" : langInfo(lang).name;
    const back = `/courses/${topicSlug}${lang === SOURCE_LANG ? "" : `?lang=${lang}`}`;
    const fields = buildCheckoutFields({
      merchantId,
      merchantKey,
      returnUrl: appUrl(`${back}${back.includes("?") ? "&" : "?"}purchase=return&mp=${mPaymentId}`, topic.tenantSlug),
      cancelUrl: appUrl(back, topic.tenantSlug),
      notifyUrl: `${process.env.CONVEX_SITE_URL}/payfast/notify`,
      mPaymentId,
      amountCents,
      itemName: `${title} — ${editionName} edition`,
      email,
      // What the ITN grants, echoed back to us on the notification. `custom_str2`
      // is also the rail discriminator (ADR 0027) — a language code is never
      // "donation", so a sale is never mistaken for one.
      custom1: topic._id,
      custom2: lang,
      passphrase,
    });
    return { action: processUrl(), fields: Object.entries(fields).map(([name, value]) => ({ name, value })) };
  },
});
