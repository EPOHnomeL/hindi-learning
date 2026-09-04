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

// ---- Course & member assignment + removal guard (issue 22) ----------------
// The tenant panel's Courses / Members / Remove sections. Assignment is
// tenant-centric — a course/member "belongs" to a tenant by carrying its slug on
// `topics.tenantSlug` / `whitelist.tenantSlug` (ADR 0021 §3 / 0022 §4), so
// assigning is a one-field patch and unassigning clears it back to the default
// site.
//
// **Allocation is provisioning, so every write here is sys-admin only** —
// `isCallerAdmin(ctx)` unscoped. A tenant admin manages what the sys admin
// allocated to them; they don't help themselves to the global default pool, hand a
// course back, claim another platform member, or delete their own tenant. It's
// symmetric on purpose: if assigning is the sys admin's call, so is unassigning.
// (These handlers were written for a sys-admin-only panel but gated with the scoped
// `isCallerAdmin(ctx, tenantSlug)`, which admits a tenant admin on their own slug
// by design — so each was a live hole until this gate.) The `tenantSlug` arg stays
// the *target* of the write, no longer the caller's scope.
//
// Reads are gated per their content: `courseAssignment` stays scope-gated (a tenant
// admin may see their own assigned courses) but returns the assignable pool to a sys
// admin only; `memberAssignment` is sys-admin only outright, since its pool is
// platform-wide personal data. Reads that touch the growable `topics`/`users` tables
// go through the `by_tenant` index — never a full scan.

// The Courses section's read: a tenant's own courses plus the pool it may still
// assign from (default-only courses — those carrying no tenant). A course owned
// by *another* tenant appears in neither list (it isn't this tenant's to touch).
// Both lists are sorted by title for a stable picker.
//
// Scope-gated, so a tenant admin may read their **own** tenant's assigned courses —
// but `available` is the global default pool (every untenanted course on the
// platform, including other people's), which is the sys admin's allocation surface.
// A tenant admin gets it **empty from the server**, not hidden in the UI: the titles
// would otherwise leak to anyone who read the query's response. That also matches
// `assignCourse` being sys-admin only — an empty pool is exactly the set they may act
// on.
export const courseAssignment = query({
  args: { tenantSlug: v.string() },
  returns: v.object({
    assigned: v.array(v.object({ topicId: v.id("topics"), title: v.string() })),
    available: v.array(v.object({ topicId: v.id("topics"), title: v.string() })),
  }),
  handler: async (ctx, { tenantSlug }) => {
    if (!(await isCallerAdmin(ctx, tenantSlug))) throw new Error("forbidden");
    const assignedRows = await ctx.db
      .query("topics")
      .withIndex("by_tenant", (q) => q.eq("tenantSlug", tenantSlug))
      .collect();
    const availableRows = (await isCallerAdmin(ctx))
      ? await ctx.db
          .query("topics")
          .withIndex("by_tenant", (q) => q.eq("tenantSlug", undefined))
          .collect()
      : [];
    const shape = (r: { _id: (typeof assignedRows)[number]["_id"]; title: string }) => ({ topicId: r._id, title: r.title });
    const byTitle = (a: { title: string }, b: { title: string }) => a.title.localeCompare(b.title);
    return {
      assigned: assignedRows.map(shape).sort(byTitle),
      available: availableRows.map(shape).sort(byTitle),
    };
  },
});

// Assign a course to this tenant: patch `topics.tenantSlug`. **Sys-admin only** —
// pulling from the global pool is allocation. Idempotent for a course already on
// this tenant; still refuses to move one already owned by another tenant, so a
// mis-typed slug can't silently re-home someone else's course.
export const assignCourse = mutation({
  args: { tenantSlug: v.string(), topicId: v.id("topics") },
  returns: v.null(),
  handler: async (ctx, { tenantSlug, topicId }) => {
    if (!(await isCallerAdmin(ctx))) throw new Error("forbidden");
    const topic = await ctx.db.get(topicId);
    if (!topic) throw new Error("course not found");
    if (topic.tenantSlug && topic.tenantSlug !== tenantSlug) {
      throw new Error("That course belongs to another tenant.");
    }
    await ctx.db.patch(topicId, { tenantSlug });
    return null;
  },
});

// Unassign a course: clear `tenantSlug` back to unset (default-only). **Sys-admin
// only**, the symmetric twin of assignCourse — handing a course back to the pool is
// as much the allocator's call as taking one out. Refuses a course that isn't this
// tenant's, so the slug arg (the target) and the row agree.
export const unassignCourse = mutation({
  args: { tenantSlug: v.string(), topicId: v.id("topics") },
  returns: v.null(),
  handler: async (ctx, { tenantSlug, topicId }) => {
    if (!(await isCallerAdmin(ctx))) throw new Error("forbidden");
    const topic = await ctx.db.get(topicId);
    if (!topic) throw new Error("course not found");
    if (topic.tenantSlug !== tenantSlug) throw new Error("That course isn't assigned to this tenant.");
    await ctx.db.patch(topicId, { tenantSlug: undefined });
    return null;
  },
});

// The Members section's read: a tenant's own members (any `whitelist` row
// carrying its slug — plain members and the tenant admin, badged by `isAdmin`)
// plus the assignable pool: unassigned, non-admin Allowlist emails. A sys-admin
// row (isAdmin, no slug) is deliberately excluded from `available` — scoping it
// to a tenant would silently demote a sys admin. Both reads go through the
// `by_tenant` index (own rows by slug, the pool by the unset slug), never a full
// Allowlist scan.
//
// **Sys-admin only** — this is the allocator's picker, and its `available` pool is
// every unassigned non-admin Allowlist email *platform-wide* (other tenants'
// prospective members, default-site users), so a tenant admin reading it is a
// cross-tenant personal-data disclosure. Unlike `courseAssignment` the whole query
// is closed rather than pool-emptied: a tenant admin's own roster is a different
// read (accounts, not invitations) still to be built, so there's nothing here worth
// keeping for them.
export const memberAssignment = query({
  args: { tenantSlug: v.string() },
  returns: v.object({
    assigned: v.array(v.object({ email: v.string(), isAdmin: v.boolean() })),
    available: v.array(v.object({ email: v.string() })),
  }),
  handler: async (ctx, { tenantSlug }) => {
    if (!(await isCallerAdmin(ctx))) throw new Error("forbidden");
    const byEmail = (a: { email: string }, b: { email: string }) => a.email.localeCompare(b.email);
    const ownRows = await ctx.db
      .query("whitelist")
      .withIndex("by_tenant", (q) => q.eq("tenantSlug", tenantSlug))
      .collect();
    const unscopedRows = await ctx.db
      .query("whitelist")
      .withIndex("by_tenant", (q) => q.eq("tenantSlug", undefined))
      .collect();
    return {
      assigned: ownRows.map((r) => ({ email: r.email, isAdmin: r.isAdmin ?? false })).sort(byEmail),
      available: unscopedRows.filter((r) => !r.isAdmin).map((r) => ({ email: r.email })).sort(byEmail),
    };
  },
});

// Assign an Allowlisted email to this tenant: patch `whitelist.tenantSlug`. The
// email must already be on the Allowlist (you scope an existing member, you don't
// admit one here — that's the Allowlist tab). **Sys-admin only** — claiming a
// platform member into a tenant is allocation, and the email being claimed is
// someone the tenant admin has no standing over. Refuses to scope a sys admin (a
// silent demotion) or to move a member already owned by another tenant.
export const assignMember = mutation({
  args: { tenantSlug: v.string(), email: v.string() },
  returns: v.null(),
  handler: async (ctx, { tenantSlug, email }) => {
    if (!(await isCallerAdmin(ctx))) throw new Error("forbidden");
    const row = await ctx.db
      .query("whitelist")
      .withIndex("by_email", (q) => q.eq("email", normaliseEmail(email)))
      .unique();
    if (!row) throw new Error("That email isn't on the Allowlist — admit it first.");
    if (row.isAdmin && !row.tenantSlug) throw new Error("That's a sys admin — they can't be scoped to a tenant.");
    if (row.tenantSlug && row.tenantSlug !== tenantSlug) throw new Error("That member belongs to another tenant.");
    await ctx.db.patch(row._id, { tenantSlug });
    return null;
  },
});

// Unassign a member: clear `tenantSlug` back to unset. **Sys-admin only**, the
// symmetric twin of assignMember — a tenant admin evicting one of their own members
// is still a write to a person's platform-level row. Refuses a tenant *admin* row —
// clearing its slug would promote it to a sys admin (isAdmin, no slug), a privilege
// change that must go through the Allowlist, not this picker.
export const unassignMember = mutation({
  args: { tenantSlug: v.string(), email: v.string() },
  returns: v.null(),
  handler: async (ctx, { tenantSlug, email }) => {
    if (!(await isCallerAdmin(ctx))) throw new Error("forbidden");
    const row = await ctx.db
      .query("whitelist")
      .withIndex("by_email", (q) => q.eq("email", normaliseEmail(email)))
      .unique();
    if (!row || row.tenantSlug !== tenantSlug) throw new Error("That member isn't assigned to this tenant.");
    if (row.isAdmin) throw new Error("That's a tenant admin — remove them from the Allowlist instead.");
    await ctx.db.patch(row._id, { tenantSlug: undefined });
    return null;
  },
});

// Grant or revoke tenant-admin on a member (issue 24). **Sys-admin only** — minting
// a tenant admin is a platform privilege, never a tenant admin's own (matches the
// Allowlist "Admit email" being sys-admin-only); gated by `isCallerAdmin(ctx)`
// unscoped, not the scoped check the other member mutations use.
//   - `makeAdmin: true` — promote to tenant admin (`isAdmin` + `tenantSlug`),
//     assigning the tenant in the same step if the row was an unassigned member.
//     Refuses a sys admin (isAdmin, no slug — promoting would be meaningless /
//     a demotion) and a member already owned by another tenant.
//   - `makeAdmin: false` — demote to a plain member of the *same* tenant: clear
//     `isAdmin`, keep `tenantSlug`. Refuses anyone not currently an admin of this
//     tenant. (The inverse of promote; unassigning the member is then the normal
//     picker action.)
export const setTenantAdmin = mutation({
  args: { tenantSlug: v.string(), email: v.string(), makeAdmin: v.boolean() },
  returns: v.null(),
  handler: async (ctx, { tenantSlug, email, makeAdmin }) => {
    if (!(await isCallerAdmin(ctx))) throw new Error("forbidden");
    const row = await ctx.db
      .query("whitelist")
      .withIndex("by_email", (q) => q.eq("email", normaliseEmail(email)))
      .unique();
    if (!row) throw new Error("That email isn't on the Allowlist — admit it first.");
    if (row.isAdmin && !row.tenantSlug) throw new Error("That's a sys admin — they can't be scoped to a tenant.");

    if (makeAdmin) {
      if (row.tenantSlug && row.tenantSlug !== tenantSlug) throw new Error("That member belongs to another tenant.");
      await ctx.db.patch(row._id, { isAdmin: true, tenantSlug });
    } else {
      if (!(row.isAdmin && row.tenantSlug === tenantSlug)) throw new Error("That member isn't an admin of this tenant.");
      await ctx.db.patch(row._id, { isAdmin: undefined });
    }
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
