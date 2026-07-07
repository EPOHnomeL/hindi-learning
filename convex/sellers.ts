import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { action, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { getSeller, normaliseEmail, sellerStatusOf, type SellerStatus } from "./lib";
import { appUrl, stripeClient } from "./stripe";
import { isCallerAdmin } from "./whitelist";

// Paid marketplace (ADR 0016) — Slice 2: the **Seller** side.
//
// Selling is a two-gate capability. The **Admin** grants a User `can-sell` (the
// presence of a `sellers` row), and the granted user then completes Stripe
// Express onboarding; only a Seller whose payouts are enabled may price an
// Edition. This module owns the grant/revoke (Admin-only), the self status query,
// and the internal mutations the Stripe onboarding action / `account.updated`
// webhook call to persist the connected-account id and its capability flags. The
// Stripe SDK is touched only in the actions at the bottom (PRD: never in a query).

const sellerStatusValidator = v.union(
  v.literal("not-granted"),
  v.literal("granted-not-onboarded"),
  v.literal("onboarding-incomplete"),
  v.literal("ready"),
);

// ---- Admin: the can-sell grant (the first gate) -----------------------------

// Grant a User the can-sell capability (Admin-only). Idempotent: a repeat is a
// no-op that never resets an already-onboarded Seller's Stripe flags. The account
// must exist — you grant the capability to a User, not a bare email.
export const grantCanSell = mutation({
  args: { email: v.string() },
  returns: v.null(),
  handler: async (ctx, { email }) => {
    if (!(await isCallerAdmin(ctx))) throw new Error("forbidden");
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", normaliseEmail(email)))
      .unique();
    if (!user) throw new Error(`no account for ${email} — the user must sign up first`);
    const existing = await getSeller(ctx, user._id);
    if (!existing) {
      await ctx.db.insert("sellers", { userId: user._id, chargesEnabled: false, payoutsEnabled: false });
    }
    return null;
  },
});

// Revoke a User's can-sell capability (Admin-only). Deletes the Seller row, which
// stops NEW pricing (the pricing guard fails) — but leaves already-sold
// Entitlements and existing listings untouched, so buyers keep what they paid for.
// No-op if there's no account or no grant.
export const revokeCanSell = mutation({
  args: { email: v.string() },
  returns: v.null(),
  handler: async (ctx, { email }) => {
    if (!(await isCallerAdmin(ctx))) throw new Error("forbidden");
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", normaliseEmail(email)))
      .unique();
    if (!user) return null;
    const existing = await getSeller(ctx, user._id);
    if (existing) await ctx.db.delete(existing._id);
    return null;
  },
});

// The granted Sellers and their onboarding status, for the admin portal (Admin-only).
export const listSellers = query({
  args: {},
  returns: v.array(v.object({ email: v.string(), status: sellerStatusValidator })),
  handler: async (ctx) => {
    if (!(await isCallerAdmin(ctx))) throw new Error("forbidden");
    // Bounded scan: Sellers are hand-vetted (Admin-granted), so the table stays
    // small, but cap it rather than load an unbounded table for the portal list.
    const rows = await ctx.db.query("sellers").take(1000);
    const out = await Promise.all(
      rows.map(async (r) => {
        const user = await ctx.db.get(r.userId);
        return { email: user?.email ?? "(unknown)", status: sellerStatusOf(r) };
      }),
    );
    return out.sort((a, b) => a.email.localeCompare(b.email));
  },
});

// ---- Self: onboarding status (the second gate) ------------------------------

// The caller's own Seller status — drives the onboarding UI (start / continue /
// ready) and gates the pricing controls. Unauthenticated ⇒ not-granted.
export const sellerStatus = query({
  args: {},
  returns: sellerStatusValidator,
  handler: async (ctx): Promise<SellerStatus> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return "not-granted";
    return sellerStatusOf(await getSeller(ctx, userId));
  },
});

// ---- Internal: called by the Stripe onboarding action / account webhook ------

// The caller's Seller row (id + Stripe account + flags), for the onboarding
// action deciding whether to create a connected account or reuse one.
export const getSellerRow = internalQuery({
  args: { userId: v.id("users") },
  returns: v.union(
    v.object({ stripeAccountId: v.union(v.string(), v.null()), payoutsEnabled: v.boolean() }),
    v.null(),
  ),
  handler: async (ctx, { userId }) => {
    const row = await getSeller(ctx, userId);
    if (!row) return null;
    return { stripeAccountId: row.stripeAccountId ?? null, payoutsEnabled: row.payoutsEnabled };
  },
});

// Persist the connected-account id onto a granted Seller when onboarding starts.
// Requires the grant to still exist (a revoke mid-onboarding wins). Never
// overwrites a different account id already attached (reuse, not re-create).
export const attachStripeAccount = internalMutation({
  args: { userId: v.id("users"), stripeAccountId: v.string() },
  returns: v.null(),
  handler: async (ctx, { userId, stripeAccountId }) => {
    const row = await getSeller(ctx, userId);
    if (!row) throw new Error("can-sell was revoked before onboarding completed");
    if (!row.stripeAccountId) await ctx.db.patch(row._id, { stripeAccountId });
    return null;
  },
});

// Mirror a Stripe account's capability flags onto the Seller row — called on the
// onboarding return and by the `account.updated` webhook. Idempotent; a no-op if
// no Seller matches the account id (e.g. can-sell was revoked). Flipping
// `payoutsEnabled` true is what promotes the Seller to `ready`.
export const updateAccountFlags = internalMutation({
  args: { stripeAccountId: v.string(), chargesEnabled: v.boolean(), payoutsEnabled: v.boolean() },
  returns: v.null(),
  handler: async (ctx, { stripeAccountId, chargesEnabled, payoutsEnabled }) => {
    const row = await ctx.db
      .query("sellers")
      .withIndex("by_stripe_account", (q) => q.eq("stripeAccountId", stripeAccountId))
      .unique();
    if (!row) return null;
    await ctx.db.patch(row._id, { chargesEnabled, payoutsEnabled });
    return null;
  },
});

// ---- Stripe Express onboarding (actions — the only Stripe calls in this file) -

// Start (or resume) Stripe Express onboarding for the granted caller. Creates the
// connected account on first run and remembers it, then returns a fresh
// Stripe-hosted onboarding URL for the client to redirect to. Reused on retry:
// the same account gets a new link, never a second account. `returnPath` is the
// relative path Stripe returns the buyer to (resolved against the trusted
// SITE_URL); the return page calls `refreshOnboarding` to persist the result.
export const startOnboarding = action({
  args: { returnPath: v.optional(v.string()) },
  returns: v.object({ url: v.string() }),
  handler: async (ctx, { returnPath }): Promise<{ url: string }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("forbidden");
    const seller = await ctx.runQuery(internal.sellers.getSellerRow, { userId });
    if (!seller) throw new Error("you haven't been granted the ability to sell");

    const stripe = stripeClient();
    let accountId = seller.stripeAccountId;
    if (!accountId) {
      // Express + direct charges: the connected account needs card_payments and
      // transfers. Stripe's hosted flow collects country / KYC / bank details.
      const account = await stripe.accounts.create({
        type: "express",
        capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
      });
      accountId = account.id;
      await ctx.runMutation(internal.sellers.attachStripeAccount, { userId, stripeAccountId: accountId });
    }
    const link = await stripe.accountLinks.create({
      account: accountId,
      // Stripe bounces the buyer back to `refresh_url` if the link expired before
      // use (re-mint one) and to `return_url` when they finish or step away.
      refresh_url: appUrl("/?onboarding=refresh"),
      return_url: appUrl(returnPath ?? "/?onboarding=return"),
      type: "account_onboarding",
    });
    if (!link.url) throw new Error("Stripe did not return an onboarding URL");
    return { url: link.url };
  },
});

// Pull the connected account's live capability flags from Stripe and persist them
// — called when the caller returns from the hosted onboarding flow (the
// account.updated webhook does the same on Stripe's schedule, Slice 3). Returns
// the caller's fresh Seller status so the UI can react without a second round-trip.
export const refreshOnboarding = action({
  args: {},
  returns: v.union(
    v.literal("not-granted"),
    v.literal("granted-not-onboarded"),
    v.literal("onboarding-incomplete"),
    v.literal("ready"),
  ),
  handler: async (ctx): Promise<SellerStatus> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return "not-granted";
    const seller = await ctx.runQuery(internal.sellers.getSellerRow, { userId });
    if (seller?.stripeAccountId) {
      const stripe = stripeClient();
      const account = await stripe.accounts.retrieve(seller.stripeAccountId);
      await ctx.runMutation(internal.sellers.updateAccountFlags, {
        stripeAccountId: seller.stripeAccountId,
        chargesEnabled: account.charges_enabled ?? false,
        payoutsEnabled: account.payouts_enabled ?? false,
      });
    }
    return await ctx.runQuery(api.sellers.sellerStatus, {});
  },
});
