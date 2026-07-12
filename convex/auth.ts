import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";
import { claimPendingEntitlements, claimPendingShares } from "./lib";

// Convex Auth (PRD §6 — auth must "just work"). Email + password to start;
// add OAuth providers here later if wanted. No JWT/cookie plumbing of our own.

// Sign-up is open (ADR 0021): anyone may create an account — the Allowlist
// gates course *creation*, not existence. Password-only means an email is
// unverified at sign-up; email OTP verification is a planned later bolt-on.
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
      // Normalise (trim + lower-case) the account identity here, where the
      // Password provider derives the credential id and the stored `users.email`
      // from this. Everything comparing emails (Allowlist rows, checkout
      // intents, pending Shares) normalises the same way, and sign-in stays
      // case-insensitive.
      profile(params) {
        return { email: String(params.email ?? "").trim().toLowerCase() };
      },
    }),
  ],
  callbacks: {
    async createOrUpdateUser(ctx, { existingUserId, profile }) {
      // Existing account → sign-in/link, not a new sign-up.
      if (existingUserId !== null) return existingUserId;
      const email = String(profile.email ?? "").trim().toLowerCase();
      // New account → claim anything waiting on this email before it existed:
      // pending Shares become real Shares, and pending Entitlements (paid
      // purchases) become real Entitlements.
      const userId = await ctx.db.insert("users", { email });
      await claimPendingShares(ctx, userId, email);
      await claimPendingEntitlements(ctx, userId, email);
      return userId;
    },
  },
});
