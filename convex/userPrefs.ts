import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";

// The signed-in user's app-language preference (app-language-i18n ticket 03 §1).
// This is the durable, cross-device ACCOUNT truth — deliberately NOT the render
// source. The render source is the `hindi:locale` cookie that getRequestConfig
// reads (ticket 04); these functions only persist the account truth so the
// client can sync it into the cookie at login (cookie-writer #2, ticket 03 §3).
// A guest has no account row — the cookie itself is a guest's only store.

// The caller's stored app-language, or null when they've never picked one (or
// are a guest). Read once at login to seed the cookie on a fresh device.
export const getMyLocale = query({
  args: {},
  returns: v.union(v.string(), v.null()),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const row = await ctx.db
      .query("userPrefs")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    return row?.locale ?? null;
  },
});

// Persist the caller's explicit app-language pick (cookie-writer #1's account
// half). Mints the row on first pick, patches it thereafter — one row per user.
// The code is stored as a free-form BCP-47 string (ticket 03): the picker only
// ever offers codes with a message file, so no validation rail is needed here.
export const setMyLocale = mutation({
  args: { locale: v.string() },
  returns: v.null(),
  handler: async (ctx, { locale }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("unauthenticated");
    const existing = await ctx.db
      .query("userPrefs")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { locale });
    } else {
      await ctx.db.insert("userPrefs", { userId, locale });
    }
  },
});
