import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";

// The Allowlist backend (ADR 0011, PRD §"Implementation Decisions"). The Admin
// edits who may sign up at runtime; the sign-up gate asks `isAdmitted`. Emails
// are normalised on the way in and stored normalised, so every comparison is a
// plain equality on the `by_email` index.

// Trim + lower-case — the one normalisation used on both store and lookup.
function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

// The single admission decision, shared by the auth sign-up gate and the tests.
// An empty Allowlist returns false (closed by design). Case- and whitespace-
// insensitive: the input is normalised the same way the stored row was.
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
// migration/seed can promote an already-admitted email to Admin. Shared by
// `seedEmail`, `addEmail`, and the migration so they normalise identically.
async function admitEmail(ctx: MutationCtx, email: string, isAdmin?: boolean): Promise<void> {
  const normalised = normaliseEmail(email);
  const existing = await ctx.db
    .query("whitelist")
    .withIndex("by_email", (q) => q.eq("email", normalised))
    .unique();
  if (existing) {
    if (isAdmin && !existing.isAdmin) await ctx.db.patch(existing._id, { isAdmin: true });
    return;
  }
  await ctx.db.insert("whitelist", { email: normalised, ...(isAdmin ? { isAdmin: true } : {}) });
}

// A basic email shape — enough to reject obvious garbage on add, not a full
// RFC validator (the gate, not the address, is what matters here).
function looksLikeEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normaliseEmail(email));
}

// The Admin test, shared by the throwing guard and the non-throwing query:
// the caller is the Admin iff their account email has an `isAdmin` Allowlist
// row. Identity is derived server-side (never a client arg), so the route guard
// stays UX-only and the API can't be bypassed.
async function isCallerAdmin(ctx: MutationCtx | QueryCtx): Promise<boolean> {
  const userId = await getAuthUserId(ctx);
  if (!userId) return false;
  const user = await ctx.db.get(userId);
  if (!user?.email) return false;
  const row = await ctx.db
    .query("whitelist")
    .withIndex("by_email", (q) => q.eq("email", normaliseEmail(user.email!)))
    .unique();
  return row?.isAdmin ?? false;
}

// The Admin authorization boundary: every Admin-only function calls this first.
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

// Whether the caller is the Admin — backs the /admin route guard (UX only).
// Returns false when unauthenticated rather than throwing, so the page can
// render a not-authorised view instead of erroring.
export const amIAdmin = query({
  args: {},
  returns: v.boolean(),
  handler: async (ctx) => isCallerAdmin(ctx),
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

// Remove an email from the Allowlist (Admin-only). Refuses to remove an Admin
// row — the non-removable-Admin guard that stops the Admin locking themselves
// out. Removing closes off *new* sign-ups; it does not evict an existing
// account (sign-up gate only — ADR 0011).
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
    if (row.isAdmin) throw new Error("The Admin can't be removed from the Allowlist.");
    await ctx.db.delete(row._id);
    return null;
  },
});

// Bootstrap an admitted (optionally Admin) row from the CLI: `npx convex run`.
// The expected first step in local dev/tests, where the table starts empty and
// is therefore closed. Idempotent.
export const seedEmail = internalMutation({
  args: { email: v.string(), isAdmin: v.optional(v.boolean()) },
  returns: v.null(),
  handler: async (ctx, { email, isAdmin }) => {
    await admitEmail(ctx, email, isAdmin);
    return null;
  },
});

// The single fixed Admin (PRD/ADR 0011). Flagged by the migration; the portal
// shows but won't remove this row.
const ADMIN_EMAIL = "jonathan@y-knot.io";

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
