import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { editionPrice, topicBySlug } from "./lib";
import { payoutDetailsValidator } from "./schema";
import { isReadySeller } from "./sellerStatus";
import { isCallerAdmin } from "./whitelist";

// The **manual EFT rail** (ywampotch-launch PRD part 2): a second payment rail
// where the buyer transfers the price into the operator's own account and the
// operator confirms it by hand. The PayFast rail is deliberately untouched by any
// of this — it holds real money.
//
// This module owns the rail's configuration: the operator's **collection**
// account (where buyers pay IN — the opposite direction to `sellers.payout`) and
// the switch that turns the rail on. The intents, the confirm queue and the
// Ledger row land in tickets 03–05.

// The singleton row. Global by design: money lands in one account whichever
// tenant sold the course, so there is nothing tenant-specific to look up.
// ponytail: `.first()` on a table with at most one row — no index, no key.
async function getRow(ctx: MutationCtx | QueryCtx) {
  return await ctx.db.query("operatorBank").first();
}

// The operator's collection account, for the sys-admin editor (sys admin only —
// a tenant admin must not see or change where the platform's money is
// collected). `null` while the rail has never been configured.
export const operatorBank = query({
  args: {},
  returns: v.union(v.object({ ...payoutDetailsValidator.fields, enabled: v.boolean() }), v.null()),
  handler: async (ctx) => {
    if (!(await isCallerAdmin(ctx))) throw new Error("forbidden");
    const row = await getRow(ctx);
    if (!row) return null;
    const { accountHolder, bank, accountNumber, branchCode, enabled } = row;
    return { accountHolder, bank, accountNumber, branchCode, enabled };
  },
});

// Save the operator's collection account and the rail's on/off state (sys admin
// only, unscoped `isCallerAdmin` — see above). Upserts the singleton row so the
// operator can correct the details on prod without a deploy, which is why this is
// a record rather than a Convex env var.
//
// Light validation only, mirroring `sellers.savePayoutDetails`: every field
// non-blank, account number and branch code numeric with spaces stripped. The
// operator eyeballs these before publishing them to buyers, and no API can tell
// us the account really exists.
// ponytail: the five validation lines are duplicated from sellers.ts rather than
// extracted — factoring them out would edit a working money-adjacent function for
// no behaviour change. Extract if a third bank-details form ever appears.
export const saveOperatorBank = mutation({
  args: { ...payoutDetailsValidator.fields, enabled: v.boolean() },
  returns: v.null(),
  handler: async (ctx, { accountHolder, bank, accountNumber, branchCode, enabled }) => {
    if (!(await isCallerAdmin(ctx))) throw new Error("forbidden");
    const details = {
      accountHolder: accountHolder.trim(),
      bank: bank.trim(),
      accountNumber: accountNumber.replace(/\s+/g, ""),
      branchCode: branchCode.replace(/\s+/g, ""),
    };
    if (!details.accountHolder || !details.bank) throw new Error("every field is required");
    if (!/^\d{4,20}$/.test(details.accountNumber)) throw new Error("account number must be 4–20 digits");
    if (!/^\d+$/.test(details.branchCode)) throw new Error("branch code must be digits");
    const row = await getRow(ctx);
    if (row) await ctx.db.patch(row._id, { ...details, enabled });
    else await ctx.db.insert("operatorBank", { ...details, enabled });
    return null;
  },
});

// The buyer-facing read, for the paygate's "Pay by EFT" affordance: the account
// to transfer into, or `null` when the rail is off or unconfigured (so the button
// simply isn't offered).
//
// DELIBERATE DISCLOSURE: while the rail is enabled this returns the operator's
// bank details to **any signed-in caller**, not only to a caller mid-purchase.
// That is intentional and was decided in the PRD — bank details are printed on
// invoices, they are not a secret, and gating them per-Edition buys nothing a
// buyer couldn't get by clicking Buy. This is not an oversight to "fix": if it is
// ever tightened, tighten it on purpose. Sign-in IS required, because checkout is
// auth-first (.scratch/auth-first-checkout) so a real paygate always has an
// account behind it, and that keeps the details off anonymous/public pages.
export const eftDetails = query({
  args: {},
  returns: v.union(payoutDetailsValidator, v.null()),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const row = await getRow(ctx);
    if (!row?.enabled) return null;
    return bankOf(row);
  },
});

// The four buyer-facing fields of the collection account, without `enabled`.
function bankOf(row: Doc<"operatorBank">) {
  const { accountHolder, bank, accountNumber, branchCode } = row;
  return { accountHolder, bank, accountNumber, branchCode };
}

// ---- The buyer's reference (ticket 03) --------------------------------------

// The random half of a reference. Excludes characters that collide when
// handwritten or read down a phone line — I/1, O/0, S/5, Z/2 — because the buyer
// retypes this into a banking app and a mistyped reference is a payment the
// operator cannot match to anyone.
const REF_ALPHABET = "ACDEFGHJKMNPQRTUVWXY34679";

// A reference: a course-derived prefix (so the operator recognises it on the
// statement at a glance) + a random suffix (so it's unique per buyer per Edition).
// e.g. `TSW-4F2K`. Deliberately NOT the PayFast `m_payment_id` UUID — a human
// types this one.
function mintRef(slug: string): string {
  const prefix = (slug.replace(/[^a-zA-Z]/g, "").slice(0, 3) || "EFT").toUpperCase();
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  const suffix = Array.from(bytes, (b) => REF_ALPHABET[b % REF_ALPHABET.length]).join("");
  return `${prefix}-${suffix}`;
}

// The caller's own PENDING intent on one Edition, if any. `status` is the whole
// mechanism: a confirmed intent has already granted access (so the reader isn't
// locked any more) and a dismissed one never got paid, so both read as "nothing
// pending" and the buyer is free to start again. Lang is matched in memory over
// the buyer's intents on this course, like entitlements/shares.
async function pendingIntent(ctx: MutationCtx | QueryCtx, userId: Doc<"users">["_id"], topicId: Doc<"topics">["_id"], lang: string) {
  const rows = await ctx.db
    .query("eftIntents")
    .withIndex("by_user_topic", (q) => q.eq("userId", userId).eq("topicId", topicId))
    .collect();
  return rows.find((r) => r.lang === lang && r.status === "pending") ?? null;
}

// Start an EFT purchase: record the intent and hand the buyer the reference and
// the account to transfer into. Auth-first (ADR 0021) exactly like
// `market.startCheckout` — the intent is keyed to the signed-in ACCOUNT, never a
// typed email, because the operator's confirmation grants access to that account.
//
// Access is NOT granted here, and no email is sent: an intent is a promise to
// pay. Only the operator confirming the money arrived (ticket 04) mints the
// Entitlement and the Ledger row.
//
// Idempotent per (buyer, Edition): a second click returns the SAME reference
// rather than minting a competing one. Two references for one buyer and one
// Edition is how a real transfer ends up matched to the wrong row, or to none.
export const startEftPurchase = mutation({
  args: { topicSlug: v.string(), lang: v.string() },
  returns: v.object({ ref: v.string(), amount: v.number(), bank: payoutDetailsValidator }),
  handler: async (ctx, { topicSlug, lang }) => {
    const row = await getRow(ctx);
    // The rail's own toggle governs — deliberately NOT PayFast's `sellingEnabled()`.
    // The point of this rail is to sell when the gateway is the obstacle.
    if (!row?.enabled) throw new Error("EFT payment isn't available right now");
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("sign in to pay by EFT — a purchase attaches to your account");
    const topic = await topicBySlug(ctx, topicSlug);
    if (!topic) throw new Error("this edition isn't for sale");
    const listing = await editionPrice(ctx, topic._id, lang);
    if (!listing) throw new Error("this edition isn't for sale");
    // Same invariant as the card rail: never sell a seat whose Seller has nowhere
    // to be paid out to.
    if (!topic.ownerId || !(await isReadySeller(ctx, topic.ownerId))) {
      throw new Error("this course isn't available for purchase right now");
    }

    const existing = await pendingIntent(ctx, userId, topic._id, lang);
    if (existing) return { ref: existing.ref, amount: existing.amount, bank: bankOf(row) };

    // Uniqueness is enforced on read, not by a constraint (Convex has none): retry
    // until the minted reference is unused. 25^4 ≈ 390k suffixes per course prefix,
    // so a collision is already unlikely at hundreds of sales.
    // ponytail: bounded retry loop, not a counter table — revisit if a course ever
    // sells enough for collisions to be routine.
    let ref = mintRef(topicSlug);
    for (let i = 0; i < 5; i++) {
      const clash = await ctx.db
        .query("eftIntents")
        .withIndex("by_ref", (q) => q.eq("ref", ref))
        .first();
      if (!clash) break;
      ref = mintRef(topicSlug);
    }

    // The price SHOWN at this click is frozen onto the intent (like
    // `checkoutIntents.amount`), so a re-price before the money lands never
    // strands a genuine payment — the operator confirms what the buyer was told.
    await ctx.db.insert("eftIntents", {
      ref,
      userId,
      topicId: topic._id,
      lang,
      amount: listing.amount,
      status: "pending",
    });
    return { ref, amount: listing.amount, bank: bankOf(row) };
  },
});

// The caller's pending EFT purchase on one Edition — the returning buyer's state.
// An EFT clears in hours or days, so a buyer who comes back before the operator
// confirms must see "waiting for your transfer", with the reference and account
// again: the bare paygate reappearing reads as "my payment failed".
//
// Reactive, like `market.checkoutStatus`: it resolves itself the moment the
// operator confirms (the row leaves `pending` in the same transaction that mints
// the Entitlement), so the reader unlocks with no reload and no polling.
export const myEftIntent = query({
  args: { topicSlug: v.string(), lang: v.string() },
  returns: v.union(v.object({ ref: v.string(), amount: v.number(), bank: payoutDetailsValidator }), v.null()),
  handler: async (ctx, { topicSlug, lang }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const row = await getRow(ctx);
    if (!row) return null;
    const topic = await topicBySlug(ctx, topicSlug);
    if (!topic) return null;
    const intent = await pendingIntent(ctx, userId, topic._id, lang);
    if (!intent) return null;
    return { ref: intent.ref, amount: intent.amount, bank: bankOf(row) };
  },
});
