import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { getSeller, normaliseEmail, sellerStatusOf, sellerStatusValidator, type SellerStatus } from "./lib";
import { payfastConfigured } from "./payfast";
import { payoutDetailsValidator } from "./schema";
import { isCallerAdmin } from "./whitelist";

// Paid marketplace (ADR 0016, PayFast rail — .scratch/payfast-payments): the
// **Seller** side.
//
// Selling is a two-gate capability. The **Admin** grants a User `can-sell` (the
// presence of a `sellers` row), and the granted Seller then saves the SA payout
// bank details the operator EFTs their Ledger share to — no external onboarding,
// Sellers never register a payment account of their own. Only a Seller with both
// (status `ready`) may price an Edition. This module owns the grant/revoke
// (Admin-only) and the self status query; the bank-details save/read lands with
// ticket 02.

// ---- Admin: the can-sell grant (the first gate) -----------------------------

// Grant a User the can-sell capability (Admin-only). Idempotent: a repeat is a
// no-op that never clobbers a Seller's saved bank details. The account must
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

// The granted Sellers, their readiness status, and their payout bank details,
// for the admin portal (Admin-only — the ONLY read that ever returns bank
// details; the operator needs them to pay out. Never logged.)
export const listSellers = query({
  args: {},
  returns: v.array(
    v.object({ email: v.string(), status: sellerStatusValidator, payout: v.union(payoutDetailsValidator, v.null()) }),
  ),
  handler: async (ctx) => {
    if (!(await isCallerAdmin(ctx))) throw new Error("forbidden");
    // Bounded scan: Sellers are hand-vetted (Admin-granted), so the table stays
    // small, but cap it rather than load an unbounded table for the portal list.
    const rows = await ctx.db.query("sellers").take(1000);
    const out = await Promise.all(
      rows.map(async (r) => {
        const user = await ctx.db.get(r.userId);
        return { email: user?.email ?? "(unknown)", status: sellerStatusOf(r), payout: r.payout ?? null };
      }),
    );
    return out.sort((a, b) => a.email.localeCompare(b.email));
  },
});

// ---- Self: payout bank details (the second gate) ----------------------------

// Save (or correct) the caller's payout bank details — the step that makes a
// granted Seller `ready`. Granted-only: without the can-sell grant there is
// nothing these details unlock. Light validation only (the operator eyeballs
// them before EFTing): every field non-blank, account number and branch code
// numeric (spaces tolerated and stripped). There is deliberately NO read-back —
// bank details leave the DB only via the Admin's listSellers.
export const savePayoutDetails = mutation({
  args: payoutDetailsValidator.fields,
  returns: v.null(),
  handler: async (ctx, { accountHolder, bank, accountNumber, branchCode }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("forbidden");
    const seller = await getSeller(ctx, userId);
    if (!seller) throw new Error("selling hasn't been enabled for your account");
    const payout = {
      accountHolder: accountHolder.trim(),
      bank: bank.trim(),
      accountNumber: accountNumber.replace(/\s+/g, ""),
      branchCode: branchCode.replace(/\s+/g, ""),
    };
    if (!payout.accountHolder || !payout.bank) throw new Error("every field is required");
    if (!/^\d{4,20}$/.test(payout.accountNumber)) throw new Error("account number must be 4–20 digits");
    if (!/^\d{6}$/.test(payout.branchCode)) throw new Error("branch code must be 6 digits");
    await ctx.db.patch(seller._id, { payout });
    return null;
  },
});

// ---- Self: readiness status (the second gate) ------------------------------

// The caller's own Seller status — drives the "set up selling" UI (ask the
// admin / save bank details / ready) and gates the pricing controls.
// Unauthenticated ⇒ not-granted. When the deployment's PayFast rail isn't
// configured, selling is off for everyone regardless of grants — the UI shows
// why instead of a price control that can only error.
export const sellerStatus = query({
  args: {},
  returns: sellerStatusValidator,
  handler: async (ctx): Promise<SellerStatus> => {
    if (!payfastConfigured()) return "payments-unconfigured";
    const userId = await getAuthUserId(ctx);
    if (!userId) return "not-granted";
    return sellerStatusOf(await getSeller(ctx, userId));
  },
});
