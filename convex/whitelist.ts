import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";

// The Allowlist backend (ADR 0011, semantics revised by ADR 0021). Sign-up is
// open; the Allowlist answers "who may create courses" — the Admin edits it at
// runtime and `seedTopic` asks `isEmailAdmitted`. Emails are normalised on the
// way in and stored normalised, so every comparison is a plain equality on the
// `by_email` index.

// Trim + lower-case — the one normalisation used on both store and lookup.
function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

// The single membership decision, shared by the course-creation gate
// (content.seedTopic), `amIAllowlisted`, and the tests. An empty Allowlist
// returns false (closed by design). Case- and whitespace-insensitive: the input
// is normalised the same way the stored row was.
export async function isEmailAdmitted(ctx: QueryCtx, email: string): Promise<boolean> {
  const row = await ctx.db
    .query("whitelist")
    .withIndex("by_email", (q) => q.eq("email", normaliseEmail(email)))
    .unique();
  return row !== null;
}

export const isAdmitted = internalQuery({
  args: { email: v.string() },
  returns: v.boolean(),
  handler: async (ctx, { email }) => isEmailAdmitted(ctx, email),
});

// Admit a (normalised) email, idempotently. Inserts the row if absent; if it
// already exists it's a no-op, except that `isAdmin: true` is applied so the
// migration/seed can promote an already-admitted email to Admin. `tenantSlug`
// scopes a new row (issue 08 / ADR 0022); on an existing row it's left alone
// (re-scoping an account's tenant is not an idempotent-admit concern). Shared by
// `seedEmail`, `addEmail`, and the migration so they normalise identically.
async function admitEmail(
  ctx: MutationCtx,
  email: string,
  isAdmin?: boolean,
  tenantSlug?: string,
): Promise<void> {
  const normalised = normaliseEmail(email);
  const existing = await ctx.db
    .query("whitelist")
    .withIndex("by_email", (q) => q.eq("email", normalised))
    .unique();
  if (existing) {
    if (isAdmin && !existing.isAdmin) await ctx.db.patch(existing._id, { isAdmin: true });
    return;
  }
  await ctx.db.insert("whitelist", {
    email: normalised,
    ...(isAdmin ? { isAdmin: true } : {}),
    ...(tenantSlug ? { tenantSlug } : {}),
  });
}

// A basic email shape — enough to reject obvious garbage on add, not a full
// RFC validator (the gate, not the address, is what matters here).
function looksLikeEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normaliseEmail(email));
}

// The scope-aware Admin test (whitelabel issue 08 / ADR 0022, superseding ADR
// 0011's one-Admin invariant). Roles are encoded on the `whitelist` row: an
// `isAdmin` row with no `tenantSlug` is a **sys admin** (global reach); an
// `isAdmin` row with a `tenantSlug` is a **tenant admin** (that tenant only).
//   - No `tenantSlug` arg → "is the caller a sys admin". This is the meaning
//     every existing call site already relies on (Routine/content/market/…
//     operator gates), so their behaviour is unchanged.
//   - `tenantSlug` given → "may the caller act on this tenant" — true for a sys
//     admin (passes every tenant) or a tenant admin whose own slug matches.
// Identity is derived server-side (never a client arg), so the route guard stays
// UX-only and the API can't be bypassed. Exported so other domains (e.g. the
// generation gate's Admin cooldown bypass) can ask the same question.
export async function isCallerAdmin(
  ctx: MutationCtx | QueryCtx,
  tenantSlug?: string,
): Promise<boolean> {
  const userId = await getAuthUserId(ctx);
  if (!userId) return false;
  const user = await ctx.db.get(userId);
  if (!user?.email) return false;
  const row = await ctx.db
    .query("whitelist")
    .withIndex("by_email", (q) => q.eq("email", normaliseEmail(user.email!)))
    .unique();
  if (!row?.isAdmin) return false;
  // Sys admin (no tenantSlug on the row) passes every check, scoped or not.
  if (!row.tenantSlug) return true;
  // Tenant admin: only their own tenant, and never an unscoped (sys-level) check.
  return tenantSlug !== undefined && row.tenantSlug === tenantSlug;
}

// The Admin authorization boundary: every Admin-only function calls this first.
// Unscoped, so it gates on sys admin (its historical meaning).
async function requireAdmin(ctx: MutationCtx | QueryCtx): Promise<void> {
  if (!(await isCallerAdmin(ctx))) throw new Error("forbidden");
}

// The admitted emails and their Admin flag, for the portal (Admin-only).
export const list = query({
  args: {},
  returns: v.array(v.object({ email: v.string(), isAdmin: v.boolean() })),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const rows = await ctx.db.query("whitelist").collect();
    return rows.map((r) => ({ email: r.email, isAdmin: r.isAdmin ?? false }));
  },
});

// Whether the caller is a sys admin — backs the /admin route guard (UX only).
// Returns false when unauthenticated rather than throwing, so the page can
// render a not-authorised view instead of erroring.
export const amIAdmin = query({
  args: {},
  returns: v.boolean(),
  handler: async (ctx) => isCallerAdmin(ctx),
});

// Whether the caller may administer a specific tenant (issue 08 / ADR 0022):
// true for a sys admin (any tenant) or that tenant's own tenant admin. Backs a
// tenant dashboard's route guard (UX only; every mutation re-checks server-side).
// Kept separate from `amIAdmin` so the common unscoped sys-admin guard stays a
// no-arg call at its many existing sites.
export const amITenantAdmin = query({
  args: { tenantSlug: v.string() },
  returns: v.boolean(),
  handler: async (ctx, { tenantSlug }) => isCallerAdmin(ctx, tenantSlug),
});

// The caller's admin scope in one read — backs the /admin dashboard shell (issue
// 19), which admits both tiers: a sys admin gets the tenant picker + Allowlist, a
// tenant admin is locked to their own tenant's panel. `role` is the row shape
// (sys = isAdmin, no slug; tenant = isAdmin + slug; none = everyone else),
// `tenantSlug` is the tenant admin's own slug (null otherwise). Identity is
// derived server-side; UX only — every mutation re-checks via isCallerAdmin.
export const myAdminScope = query({
  args: {},
  returns: v.object({
    role: v.union(v.literal("sys"), v.literal("tenant"), v.literal("none")),
    tenantSlug: v.union(v.string(), v.null()),
  }),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { role: "none" as const, tenantSlug: null };
    const user = await ctx.db.get(userId);
    if (!user?.email) return { role: "none" as const, tenantSlug: null };
    const row = await ctx.db
      .query("whitelist")
      .withIndex("by_email", (q) => q.eq("email", normaliseEmail(user.email!)))
      .unique();
    if (!row?.isAdmin) return { role: "none" as const, tenantSlug: null };
    if (!row.tenantSlug) return { role: "sys" as const, tenantSlug: null };
    return { role: "tenant" as const, tenantSlug: row.tenantSlug };
  },
});

// Whether the caller's account email is on the Allowlist — backs the dashboard's
// "new course" affordance (UX only; seedTopic's server gate is the boundary).
// Identity is derived server-side, false when unauthenticated, like `amIAdmin`.
export const amIAllowlisted = query({
  args: {},
  returns: v.boolean(),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return false;
    const user = await ctx.db.get(userId);
    if (!user?.email) return false;
    return isEmailAdmitted(ctx, user.email);
  },
});

// Admit an email (Admin-only). Normalises, validates a basic shape, inserts if
// absent, no-ops if already present.
export const addEmail = mutation({
  args: { email: v.string() },
  returns: v.null(),
  handler: async (ctx, { email }) => {
    await requireAdmin(ctx);
    if (!looksLikeEmail(email)) throw new Error("That doesn't look like an email address.");
    await admitEmail(ctx, email);
    return null;
  },
});

// Remove an email from the Allowlist (Admin-only). The lockout guard is now
// scoped (issue 08 / ADR 0022): a sys-admin row can't be removed while it's the
// *only* sys admin (the equivalent of the old one-Admin guard, now tier-scoped),
// but tenant-admin and member rows are freely removable. Removing revokes
// creating *new* courses; it does not evict the account or touch the courses
// they already own (ADR 0021).
export const removeEmail = mutation({
  args: { email: v.string() },
  returns: v.null(),
  handler: async (ctx, { email }) => {
    await requireAdmin(ctx);
    const row = await ctx.db
      .query("whitelist")
      .withIndex("by_email", (q) => q.eq("email", normaliseEmail(email)))
      .unique();
    if (!row) return null;
    // A sys admin is `isAdmin` with no `tenantSlug`; refuse to drop the last one.
    if (row.isAdmin && !row.tenantSlug) {
      const sysAdmins = (await ctx.db.query("whitelist").collect()).filter(
        (r) => r.isAdmin && !r.tenantSlug,
      );
      if (sysAdmins.length <= 1) throw new Error("The last sys admin can't be removed from the Allowlist.");
    }
    await ctx.db.delete(row._id);
    return null;
  },
});

// Bootstrap an admitted (optionally Admin) row from the CLI: `npx convex run`.
// The expected first step in local dev/tests, where the table starts empty and
// is therefore closed. Idempotent. `tenantSlug` scopes the row (issue 08 / ADR
// 0022): omit for a sys admin / default-site member, pass a slug to bootstrap a
// tenant admin or tenant member.
export const seedEmail = internalMutation({
  args: { email: v.string(), isAdmin: v.optional(v.boolean()), tenantSlug: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, { email, isAdmin, tenantSlug }) => {
    await admitEmail(ctx, email, isAdmin, tenantSlug);
    return null;
  },
});

// Re-scope one or more emails to **tenant admins** of a given tenant (issue 08 /
// ADR 0022) — the "separate operator action" seed-tenants.ts defers. Unlike
// `admitEmail` (which leaves `tenantSlug` alone on an existing row), this upserts
// the role: it PATCHES an existing sys-admin/member row to `{ isAdmin, tenantSlug }`,
// demoting a sys admin (isAdmin + no slug) to that tenant's admin, and INSERTS a
// tenant-admin row for an email not yet on the Allowlist. Idempotent. Internal —
// run via `npx convex run whitelist:scopeToTenant`, so it has no auth identity and
// never enforces the last-sys-admin guard (the caller is the operator by
// deploy-key). Returns what happened to each email for the run log.
export const scopeToTenant = internalMutation({
  args: { emails: v.array(v.string()), tenantSlug: v.string() },
  returns: v.array(
    v.object({
      email: v.string(),
      action: v.union(v.literal("patched"), v.literal("inserted")),
    }),
  ),
  handler: async (ctx, { emails, tenantSlug }) => {
    const results: { email: string; action: "patched" | "inserted" }[] = [];
    for (const email of emails) {
      const normalised = normaliseEmail(email);
      const existing = await ctx.db
        .query("whitelist")
        .withIndex("by_email", (q) => q.eq("email", normalised))
        .unique();
      if (existing) {
        await ctx.db.patch(existing._id, { isAdmin: true, tenantSlug });
        results.push({ email: normalised, action: "patched" });
      } else {
        await ctx.db.insert("whitelist", { email: normalised, isAdmin: true, tenantSlug });
        results.push({ email: normalised, action: "inserted" });
      }
    }
    return results;
  },
});

// The single fixed Admin (PRD/ADR 0011). Flagged by the migration; the portal
// shows but won't remove this row.
const ADMIN_EMAIL = "jvorster63@gmail.com";

// One-time migration off `AUTH_ALLOWED_EMAILS` (ADR 0011): admit each email the
// env var listed, flag the Admin, and ensure the Admin is admitted even if the
// env list omitted them. Idempotent — re-running admits nothing new. Run once in
// prod via `npx convex run whitelist:migrateFromEnv`, then unset the env var.
export const migrateFromEnv = internalMutation({
  args: {},
  returns: v.object({ admitted: v.number() }),
  handler: async (ctx) => {
    const emails = (process.env.AUTH_ALLOWED_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean);
    for (const email of emails) {
      await admitEmail(ctx, email, normaliseEmail(email) === ADMIN_EMAIL);
    }
    await admitEmail(ctx, ADMIN_EMAIL, true);
    return { admitted: emails.length };
  },
});
