import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import { assertAdmin } from "./adminSecret";
import { isCallerAdmin } from "./whitelist";
import { tenantFlagsValidator, tenantThemeValidator } from "./schema";
import { DEFAULT_TENANT_FLAGS } from "./tenantFlags";
import { DEFAULT_TENANT_THEME, assertThemeTokens } from "./tenantTheme";

// The tenant row's own lifecycle: list, create, seed, and remove. What a tenant
// *is*, not what it looks like or what it holds. The rest of the old `tenants.ts`
// was split out by technical-foundation/18: the palette and brand assets are in
// `tenantTheme.ts`, the feature flags in `tenantFlags.ts`, the donation payee in
// `tenantDonations.ts`, and course/member allocation in `tenantAssignment.ts`.

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
