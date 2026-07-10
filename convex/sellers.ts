import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { getSeller, normaliseEmail, sellerStatusOf, sellerStatusValidator, type SellerStatus } from "./lib";
import { isCallerAdmin } from "./whitelist";

// Paid marketplace (ADR 0016, PayFast rail — .scratch/payfast-payments): the
// **Seller** side.
//
// Selling is a two-gate capability. The **Admin** grants a User `can-sell` (the
// presence of a `sellers` row), and the granted author then saves the SA payout
// bank details the operator EFTs their Ledger share to — no external onboarding,
// authors never register a payment account of their own. Only a Seller with both
// (status `ready`) may price an Edition. This module owns the grant/revoke
// (Admin-only) and the self status query; the bank-details save/read lands with
// ticket 02.

// ---- Admin: the can-sell grant (the first gate) -----------------------------

// Grant a User the can-sell capability (Admin-only). Idempotent: a repeat is a
// no-op that never clobbers an author's saved bank details. The account must
// exist — you grant the capability to a User, not a bare email.
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
      await ctx.db.insert("sellers", { userId: user._id });
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

// The granted Sellers and their readiness status, for the admin portal (Admin-only).
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

// ---- Self: readiness status (the second gate) ------------------------------

// The caller's own Seller status — drives the "set up selling" UI (ask the
// admin / save bank details / ready) and gates the pricing controls.
// Unauthenticated ⇒ not-granted.
export const sellerStatus = query({
  args: {},
  returns: sellerStatusValidator,
  handler: async (ctx): Promise<SellerStatus> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return "not-granted";
    return sellerStatusOf(await getSeller(ctx, userId));
  },
});
