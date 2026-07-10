import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { isCallerAdmin } from "./whitelist";

// The Ledger admin seam (.scratch/payfast-payments): every sale lands in the
// operator's single PayFast account, and the `ledger` table (written by the
// verified ITN) records the author's 50% of net as `owed`. The operator pays
// authors out by EFT out of band; these two functions are the in-app half —
// see what's owed to whom (with the bank details to send it to), and record
// the payout so a row is never double-counted. Both Admin-only.

// What the operator owes each author right now: the `owed` Ledger rows grouped
// per Seller, each author's payout bank details (from their sellers row), the
// total, and the contributing sales (ids feed markPaid). Authors with nothing
// owed don't appear. Bounded scan: `owed` rows only live until the next manual
// payout run, so the working set stays small — capped defensively regardless.
export const owedPayouts = query({
  args: {},
  returns: v.array(
    v.object({
      email: v.string(),
      payout: v.union(
        v.object({
          accountHolder: v.string(),
          bank: v.string(),
          accountNumber: v.string(),
          branchCode: v.string(),
        }),
        v.null(),
      ),
      totalOwed: v.number(),
      sales: v.array(
        v.object({
          id: v.id("ledger"),
          lang: v.string(),
          buyerEmail: v.string(),
          authorShare: v.number(),
          at: v.number(),
        }),
      ),
    }),
  ),
  handler: async (ctx) => {
    if (!(await isCallerAdmin(ctx))) throw new Error("forbidden");
    const rows = await ctx.db
      .query("ledger")
      .withIndex("by_status", (q) => q.eq("status", "owed"))
      .take(1000);
    const bySeller = new Map<Id<"users">, typeof rows>();
    for (const r of rows) {
      const list = bySeller.get(r.sellerId) ?? [];
      list.push(r);
      bySeller.set(r.sellerId, list);
    }
    const out = await Promise.all(
      [...bySeller.entries()].map(async ([sellerId, sales]) => {
        const user = await ctx.db.get(sellerId);
        const seller = await ctx.db
          .query("sellers")
          .withIndex("by_user", (q) => q.eq("userId", sellerId))
          .unique();
        return {
          email: user?.email ?? "(unknown)",
          // The bank details to EFT to — null if the grant was since revoked or
          // the details cleared; the debt still shows (ask the author).
          payout: seller?.payout ?? null,
          totalOwed: sales.reduce((sum, s) => sum + s.authorShare, 0),
          sales: sales.map((s) => ({
            id: s._id,
            lang: s.lang,
            buyerEmail: s.buyerEmail,
            authorShare: s.authorShare,
            at: s._creationTime,
          })),
        };
      }),
    );
    return out.sort((a, b) => a.email.localeCompare(b.email));
  },
});

// Record a manual EFT: flip the selected rows `owed` → `paid` with the payout
// reference (the EFT reference, for reconciliation). Already-`paid` rows are
// left untouched — their original reference is the record of when the money
// actually moved, so a sloppy re-selection can't rewrite history or double-count.
export const markPaid = mutation({
  args: { ids: v.array(v.id("ledger")), reference: v.string() },
  returns: v.null(),
  handler: async (ctx, { ids, reference }) => {
    if (!(await isCallerAdmin(ctx))) throw new Error("forbidden");
    const payoutRef = reference.trim();
    if (!payoutRef) throw new Error("a payout reference is required");
    for (const id of ids) {
      const row = await ctx.db.get(id);
      if (row && row.status === "owed") {
        await ctx.db.patch(id, { status: "paid", payoutRef });
      }
    }
    return null;
  },
});
