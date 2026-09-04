import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { isReadySeller } from "./sellerStatus";
import { normaliseEmail } from "./shareGrants";
import { isCallerAdmin } from "./whitelist";

// Who a tenant's donation income is owed to (ADR 0027): the sys admin's read
// and write of `tenants.donationPayee`. Split out of `tenants.ts` by
// technical-foundation/18. The `donations` flag's own precondition still lives
// with the flag write, since that is a flag rule.
// The email of the user this tenant's donation income is owed to, for the
// sys-admin's Donations section — null when none is set. Sys-admin only, for the
// same reason writing it is: who receives a tenant's money is operator business.
// Separate from `getTheme` (which is public, and serves the skin) deliberately.
export const donationPayeeEmail = query({
  args: { tenantSlug: v.string() },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, { tenantSlug }) => {
    if (!(await isCallerAdmin(ctx))) throw new Error("forbidden");
    const tenant = await ctx.db
      .query("tenants")
      .withIndex("by_slug", (q) => q.eq("slug", tenantSlug))
      .unique();
    if (!tenant?.donationPayee) return null;
    return (await ctx.db.get(tenant.donationPayee))?.email ?? null;
  },
});

// Nominate (or clear) the user this tenant's donation income is owed to (ADR
// 0027). **Sys-admin only** — `isCallerAdmin(ctx)` unscoped, deliberately NOT
// the tenant-scoped check that guards the theme editor: a money destination is
// not a subdomain administrator's call, and letting a tenant admin set it would
// open a self-dealing surface — redirecting the tenant's donation income to any
// member account they control. Same reasoning as ADR 0026's operator-only bank
// details.
//
// The payee must already be a ready Seller, for the same reason the flag gate
// checks it: the payout rides `sellers.payout`, so a payee with no bank details
// is a debt with nowhere to send it. Clearing the payee (email omitted) also
// switches the flag off — leaving `donations: true` with no payee would let the
// checkout query fail at donor time instead of at configuration time.
export const setDonationPayee = mutation({
  args: { tenantSlug: v.string(), email: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, { tenantSlug, email }) => {
    if (!(await isCallerAdmin(ctx))) throw new Error("forbidden");
    const tenant = await ctx.db
      .query("tenants")
      .withIndex("by_slug", (q) => q.eq("slug", tenantSlug))
      .unique();
    if (!tenant) throw new Error("tenant not found");

    if (!email?.trim()) {
      await ctx.db.patch(tenant._id, {
        donationPayee: undefined,
        flags: { ...tenant.flags, donations: false },
      });
      return null;
    }

    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", normaliseEmail(email)))
      .unique();
    // ConvexError for the same reason the flag gate uses one: these two are
    // instructions to the operator, and prod redacts a plain Error's message.
    if (!user) throw new ConvexError(`No account for ${email.trim()} — the payee must have signed up.`);
    if (!(await isReadySeller(ctx, user._id))) {
      throw new ConvexError("That payee must be an approved seller with payout bank details on file.");
    }
    await ctx.db.patch(tenant._id, { donationPayee: user._id });
    return null;
  },
});
