import { ConvexError, v } from "convex/values";
import type { Infer } from "convex/values";
import { mutation } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import { tenantFlagsValidator } from "./schema";
import { isReadySeller } from "./sellerStatus";
import { isCallerAdmin } from "./whitelist";

// Whitelabel feature flags (issue 04 / 17). Split out of `edition.ts` (then `lib.ts`) by
// architecture-deepening/02: flag gating is unrelated to the Edition access
// stack that file exists for. The dashboard's flag write and the defaults a new
// tenant starts from joined it from `tenants.ts` in technical-foundation/18, so
// the gate and the switch that feeds it now sit together.

// One of a tenant's five feature flags (schema `tenantFlagsValidator`).
export type TenantFlag = keyof Infer<typeof tenantFlagsValidator>;

// The server-side flag gate: throws when `flag` is off for `tenantSlug`. Called
// inline in the five create-side mutations so a disabled feature is enforced at
// the API boundary, not merely hidden in the UI (issue 17). `tenantSlug`
// undefined = default site / not-yet-tenanted content, where every flag is
// implicitly on — matching today's always-on behaviour exactly (no regression).
// Read paths never call this: only the CREATE path is gated, so anything already
// granted keeps resolving after a flag flips off (flag-off is frozen, not
// revoked, ADR/issue 04). A slug with no `tenants` row is denied (fail-closed).
// The `by_slug` read hits the bounded, indexed tenants table.
export async function assertTenantFlag(
  ctx: QueryCtx,
  tenantSlug: string | undefined,
  flag: TenantFlag,
): Promise<void> {
  if (tenantSlug === undefined) return;
  const tenant = await ctx.db
    .query("tenants")
    .withIndex("by_slug", (q) => q.eq("slug", tenantSlug))
    .unique();
  if (!tenant?.flags[flag]) throw new Error("This feature isn't available on this site.");
}

// Flags default all on for a freshly-created tenant: the v1 no-regression
// posture (ticket 04).
export const DEFAULT_TENANT_FLAGS = {
  certificates: true, translations: true, publicLinks: true, qa: true, seeding: true,
};

// Toggle a tenant's feature flags from the dashboard (issue 21). A **patch**: only
// the flags given are changed, the rest are left as-is — so the UI can send one
// flag per switch without re-sending the whole set. **Sys-admin only** — gated by
// `isCallerAdmin(ctx)` unscoped, not the scoped check: the flags decide what the
// tenant may do *at all*, so flipping one widens the tenant's own grant, which is
// provisioning and never a tenant admin's (the scoped gate used to admit them).
// There's no confirm dialog and no destructive edit here — flag-off is
// frozen-not-revoked (issue 04): the flip only changes what `assertTenantFlag`
// (issue 17) permits on the CREATE path, granting nothing and deleting nothing.
// Each flag is optional so a caller sends just the one it flips.
export const setTenantFlags = mutation({
  args: {
    tenantSlug: v.string(),
    flags: v.object({
      certificates: v.optional(v.boolean()),
      translations: v.optional(v.boolean()),
      publicLinks: v.optional(v.boolean()),
      qa: v.optional(v.boolean()),
      seeding: v.optional(v.boolean()),
      donations: v.optional(v.boolean()),
    }),
  },
  returns: v.null(),
  handler: async (ctx, { tenantSlug, flags }) => {
    if (!(await isCallerAdmin(ctx))) throw new Error("forbidden");
    const tenant = await ctx.db
      .query("tenants")
      .withIndex("by_slug", (q) => q.eq("slug", tenantSlug))
      .unique();
    if (!tenant) throw new Error("tenant not found");
    // `donations` is the one flag with a precondition (ADR 0027): it may not be
    // switched ON unless a `donationPayee` is set AND that payee is a ready
    // Seller (can-sell grant + SA bank details on file). This makes it
    // structurally impossible to accrue donation debt with nowhere to send it —
    // the same reasoning that stops an Edition being priced by an unready
    // Seller. Switching it OFF is always allowed.
    if (flags.donations === true) {
      if (!tenant.donationPayee || !(await isReadySeller(ctx, tenant.donationPayee))) {
        // ConvexError, not Error: a **production** deployment redacts a plain
        // Error's message before it reaches the client and the operator gets a
        // bare "Server Error" — which is what this precondition looked like the
        // first time it fired for real. Only ConvexError's `data` crosses the
        // wire in prod, so an instruction the operator is meant to act on has to
        // be thrown as one.
        throw new ConvexError(
          "Set a donation payee who is an approved seller with payout details before enabling donations.",
        );
      }
    }
    await ctx.db.patch(tenant._id, { flags: { ...tenant.flags, ...flags } });
    return null;
  },
});
