import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";

// The signed-in account's profile, read + written by the settings dialog. `name`
// is the account name AND the certificate display name — the claim form defaults
// to it (Certificate.tsx), so editing it here changes what *future* certificates
// print. Already-earned certificates froze their name at claim time and are left
// untouched; invite/notification emails that read `name` pick up the new value.
export const me = query({
  args: {},
  returns: v.union(
    v.object({
      id: v.id("users"),
      name: v.union(v.string(), v.null()),
      email: v.union(v.string(), v.null()),
    }),
    v.null(),
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const user = await ctx.db.get(userId);
    if (!user) return null;
    return { id: userId, name: user.name ?? null, email: user.email ?? null };
  },
});

// Longer than any real name; guards the doc-size limit against a pasted essay.
const MAX_NAME = 80;

// Set the account/display name. Trims and caps; an empty value clears the field
// so certificates fall back to the account email's local-part (claimCertificate).
export const setName = mutation({
  args: { name: v.string() },
  returns: v.null(),
  handler: async (ctx, { name }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not signed in");
    const trimmed = name.trim().slice(0, MAX_NAME);
    await ctx.db.patch(userId, { name: trimmed === "" ? undefined : trimmed });
    return null;
  },
});
