import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { isCallerAdmin } from "./whitelist";

// The Ledger admin seam (.scratch/payfast-payments): every sale lands in the
// operator's single PayFast account, and the `ledger` table (written by the
// verified ITN) records the Seller's 50% of net as `owed`. The operator pays
// Sellers out by EFT out of band; these two functions are the in-app half —
// see what's owed to whom (with the bank details to send it to), and record
// the payout so a row is never double-counted. Both Admin-only.

// What the operator owes each payee right now: the `owed` Ledger rows grouped
// per payee, their payout bank details (from their sellers row), the total, and
// the contributing rows (ids feed markPaid). Payees with nothing owed don't
// appear. **Donations are included, untouched** (ADR 0027): this rollup groups
// by `sellerId` and never looks at a course, so a donation owed to a tenant's
// `donationPayee` lands here for free — that reuse is exactly why the donation
// rail shares the Ledger instead of getting a table of its own. Bounded scan: `owed` rows only live until the next manual
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
          // The Edition sold — **null on a donation** (ADR 0027), which bought no
          // Edition. Nullable rather than a stand-in string: "Donation" is not a
          // language code, and inventing one here would put presentation text in
          // a Convex query and collide with the language-code namespace. `kind`
          // beside it is what the UI actually branches on.
          lang: v.union(v.string(), v.null()),
          kind: v.union(v.literal("sale"), v.literal("donation")),
          buyerEmail: v.string(),
          sellerShare: v.number(),
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
          // the details cleared; the debt still shows (ask the Seller).
          payout: seller?.payout ?? null,
          totalOwed: sales.reduce((sum, s) => sum + s.sellerShare, 0),
          sales: sales.map((s) => ({
            id: s._id,
            lang: s.lang ?? null,
            // A row written before `kind` existed is a sale (donations postdate
            // the field), so absent reads as "sale" — same reasoning as
            // sales.ts's salesOnly.
            kind: s.kind ?? ("sale" as const),
            buyerEmail: s.buyerEmail,
            sellerShare: s.sellerShare,
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
