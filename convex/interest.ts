import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { normaliseEmail } from "./shareGrants";
import { isCallerAdmin } from "./whitelist";

// The **interest list** (ADR 0028) — the landing pages' second conversion, for a
// visitor who won't sign in yet. Modelled on spoorpet.com's interest page, which
// converts strangers with exactly one field and one button, and which was the
// brief behind this work.
//
// `register` is the **only public mutation in the codebase**, and ADR 0028
// records why that is acceptable here when ADR 0013 refused an anonymous write
// for the Guest reader: a lead grants nothing, touches nothing in the content
// graph, and cannot accrue rows (see the idempotency below). Everything an
// anonymous caller can influence is bounded in this file — the address (validated
// and length-capped), the CTA that converted (checked against a closed list), and
// the tenant it belongs to.

// The longest address we'll store. RFC 5321 caps a path at 254 characters, so a
// longer string is not a real address and we say so rather than truncating it
// into a different person's mailbox.
export const MAX_EMAIL_LENGTH = 254;

// Every CTA that may write a lead, as a **closed set**. Not a free `v.string()`:
// `source` exists so the operator can tell which ask converted, and an open field
// makes that number untrustworthy the moment anything writes an unplanned value —
// and hands an anonymous caller a place to stuff arbitrary text. Adding a CTA is
// a deliberate edit here.
export const LEAD_SOURCES = [
  "landing-footer",
  "landing-hero",
  "ywampotch-footer",
  "ywampotch-hero",
] as const;

const sourceValidator = v.union(...LEAD_SOURCES.map((s) => v.literal(s)));

// Deliberately loose, and deliberately not a regex borrowed from the internet.
// The only thing worth rejecting client- and server-side is a string that plainly
// cannot be delivered to; anything stricter rejects real addresses, and the true
// test of an address is whether mail to it arrives.
export function isDeliverableShape(email: string): boolean {
  if (email.length === 0 || email.length > MAX_EMAIL_LENGTH) return false;
  const at = email.indexOf("@");
  // Exactly one "@", with something before it and a dotted domain after it.
  if (at <= 0 || email.indexOf("@", at + 1) !== -1) return false;
  const domain = email.slice(at + 1);
  if (!domain.includes(".") || domain.startsWith(".") || domain.endsWith(".")) return false;
  return !/\s/.test(email);
}

// Record an interest lead. **Idempotent per (email, tenant)**: a second submit
// bumps `submissions` and the timestamp instead of inserting, so hammering the
// button cannot grow the table and re-subscribing is not an error the visitor has
// to understand. Returns null — the caller learns only that it worked, which is
// also all the success card says.
export const register = mutation({
  args: {
    email: v.string(),
    tenantSlug: v.string(),
    source: sourceValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const email = normaliseEmail(args.email);
    // Validated again here even though the form checks first: the form's check is
    // for the visitor's benefit, this one is the actual gate.
    if (!isDeliverableShape(email)) throw new Error("Please enter a valid email address.");

    const existing = await ctx.db
      .query("interestLeads")
      .withIndex("by_email_and_tenant", (q) => q.eq("email", email).eq("tenantSlug", args.tenantSlug))
      .unique();

    if (existing) {
      await ctx.db.patch("interestLeads", existing._id, {
        submissions: existing.submissions + 1,
        lastSubmittedAt: Date.now(),
        // The latest CTA wins: it's the one that made them try again.
        source: args.source,
      });
      return null;
    }

    await ctx.db.insert("interestLeads", {
      email,
      tenantSlug: args.tenantSlug,
      source: args.source,
      submissions: 1,
      lastSubmittedAt: Date.now(),
    });
    return null;
  },
});

// The operator's read of the list. Admin-only and bounded — an interest list is a
// pile of strangers' email addresses, so nothing unauthenticated may read it back,
// and the mutation above never returns it either. Scoped through `isCallerAdmin`
// with the slug, so a sys admin sees any tenant's list and a tenant admin sees
// exactly their own: a ministry's leads are the ministry's, not the platform's.
// Row-shaped rather than returned whole, so a future field on the table can't
// leak by accident.
export const listLeads = query({
  args: { tenantSlug: v.string(), limit: v.optional(v.number()) },
  returns: v.array(
    v.object({
      email: v.string(),
      source: v.string(),
      submissions: v.number(),
      lastSubmittedAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    if (!(await isCallerAdmin(ctx, args.tenantSlug))) throw new Error("forbidden");
    const rows = await ctx.db
      .query("interestLeads")
      .withIndex("by_tenant", (q) => q.eq("tenantSlug", args.tenantSlug))
      .order("desc")
      .take(Math.min(args.limit ?? 200, 500));
    return rows.map((r) => ({
      email: r.email,
      source: r.source,
      submissions: r.submissions,
      lastSubmittedAt: r.lastSubmittedAt,
    }));
  },
});
