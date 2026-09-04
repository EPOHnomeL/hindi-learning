import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import { assertAdmin } from "./adminSecret";
import { isReadySeller } from "./sellerStatus";
import { normaliseEmail } from "./shareGrants";
import { isCallerAdmin } from "./whitelist";
import { tenantFlagsValidator, tenantThemeValidator } from "./schema";
import { DEFAULT_TENANT_THEME, assertThemeTokens } from "./tenantTheme";

// Flags default all on for a freshly-created tenant: the v1 no-regression
// posture (ticket 04).
const DEFAULT_TENANT_FLAGS = {
  certificates: true, translations: true, publicLinks: true, qa: true, seeding: true,
};

// The dashboard sidebar's tenant list (issue 19): every tenant's slug + display
// name, sorted by display name. **Sys-admin only** — a tenant admin has no picker
// (they're locked to their own tenant), so this list is never theirs to see. The
// `tenants` table is bounded by the operator (one row per branded subdomain), so
// a full scan is the right read here.
export const listTenants = query({
  args: {},
  returns: v.array(v.object({ slug: v.string(), displayName: v.string() })),
  handler: async (ctx) => {
    if (!(await isCallerAdmin(ctx))) throw new Error("forbidden");
    const rows = await ctx.db.query("tenants").collect();
    return rows
      .map((r) => ({ slug: r.slug, displayName: r.displayName }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  },
});

// Create a tenant from the dashboard's "+ New tenant" action (issue 19). **Sys
// admin only** — creating a tenant is a platform act, never a tenant admin's.
// The new row is seeded with the house default palette + all flags on so it's
// immediately resolvable (SSR/getTheme) and behaves like today; the operator then
// paints the real brand via the theme editor (ticket 20). Slug is normalised
// (trim + lower-case) and constrained to a subdomain-safe shape; a duplicate is
// refused (the slug is the tenant's identity on `by_slug`).
export const createTenant = mutation({
  args: { slug: v.string(), displayName: v.string() },
  returns: v.object({ slug: v.string() }),
  handler: async (ctx, { slug, displayName }) => {
    if (!(await isCallerAdmin(ctx))) throw new Error("forbidden");
    const normalisedSlug = slug.trim().toLowerCase();
    if (!/^[a-z0-9-]+$/.test(normalisedSlug)) {
      throw new Error("Slug must be lower-case letters, numbers, and hyphens only.");
    }
    const name = displayName.trim();
    if (!name) throw new Error("A display name is required.");

    const existing = await ctx.db
      .query("tenants")
      .withIndex("by_slug", (q) => q.eq("slug", normalisedSlug))
      .unique();
    if (existing) throw new Error("A tenant with that slug already exists.");

    await ctx.db.insert("tenants", {
      slug: normalisedSlug,
      displayName: name,
      theme: DEFAULT_TENANT_THEME,
      flags: DEFAULT_TENANT_FLAGS,
    });
    return { slug: normalisedSlug };
  },
});

// Seed one tenant row, idempotently (issue 07). PUBLISH_SECRET-guarded like the
// other operator-script mutations; the seed driver (scripts/seed-tenants.ts)
// calls it once per tenant with the mock-palette fixtures. Skips a slug that
// already exists — never duplicates, never overwrites — so re-running the seed
// is safe. Tenant *admin* assignment (marking whitelist rows) is a separate
// operator action with real emails; this only creates tenant rows.
export const seedTenant = mutation({
  args: {
    secret: v.string(),
    slug: v.string(),
    displayName: v.string(),
    theme: tenantThemeValidator,
    flags: tenantFlagsValidator,
  },
  returns: v.object({ created: v.boolean() }),
  handler: async (ctx, { secret, slug, displayName, theme, flags }) => {
    assertAdmin(secret);
    assertThemeTokens(theme);

    const existing = await ctx.db
      .query("tenants")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (existing) return { created: false };

    await ctx.db.insert("tenants", { slug, displayName, theme, flags });
    return { created: true };
  },
});

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

// Count everything that still references a tenant's slug — courses, Allowlist
// members, and user accounts — through indexed reads on the growable tables. The
// Remove section reads this to disable the control and explain what's still
// assigned; `removeTenant` re-derives it server-side as the real guard.
async function tenantReferences(
  ctx: QueryCtx,
  slug: string,
): Promise<{ courses: number; members: number; users: number }> {
  const courses = await ctx.db.query("topics").withIndex("by_tenant", (q) => q.eq("tenantSlug", slug)).collect();
  const users = await ctx.db.query("users").withIndex("by_tenant", (q) => q.eq("tenantSlug", slug)).collect();
  const members = await ctx.db.query("whitelist").withIndex("by_tenant", (q) => q.eq("tenantSlug", slug)).collect();
  return { courses: courses.length, members: members.length, users: users.length };
}

export const tenantReferenceCounts = query({
  args: { tenantSlug: v.string() },
  returns: v.object({ courses: v.number(), members: v.number(), users: v.number() }),
  handler: async (ctx, { tenantSlug }) => {
    if (!(await isCallerAdmin(ctx, tenantSlug))) throw new Error("forbidden");
    return tenantReferences(ctx, tenantSlug);
  },
});

// Remove a tenant — the destructive act, guarded like ADR 0011's refuse-to-remove
// pattern: **blocked outright** while any course, member, or user account still
// references the slug (no cascade delete exists in this codebase and this issue
// introduces none). Only an empty tenant is deletable. The UI disables the
// control on the same counts, but this server guard is the boundary.
//
// **Sys-admin only** — deleting a tenant is unprovisioning, never the tenant's own
// act. The reference guard *happened* to refuse a tenant admin anyway (their own
// Allowlist row always counts as a member of their slug), so this was a latent gate
// hole rather than a reachable one — but two guards deep is where it belongs, and the
// counts are a data rule, not an authorization boundary.
export const removeTenant = mutation({
  args: { tenantSlug: v.string() },
  returns: v.null(),
  handler: async (ctx, { tenantSlug }) => {
    if (!(await isCallerAdmin(ctx))) throw new Error("forbidden");
    const { courses, members, users } = await tenantReferences(ctx, tenantSlug);
    if (courses + members + users > 0) {
      throw new Error("This tenant still has courses or members assigned — clear them first.");
    }
    const tenant = await ctx.db
      .query("tenants")
      .withIndex("by_slug", (q) => q.eq("slug", tenantSlug))
      .unique();
    if (!tenant) throw new Error("tenant not found");
    await ctx.db.delete(tenant._id);
    return null;
  },
});
