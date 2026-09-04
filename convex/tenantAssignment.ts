import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { normaliseEmail } from "./shareGrants";
import { isCallerAdmin } from "./whitelist";

// Allocating courses and members to a tenant: the tenant panel's Courses and
// Members sections, and the tenant-admin grant. Split out of `tenants.ts` by
// technical-foundation/18; the tenant row itself, its theme and its donation
// payee are their own modules.

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
