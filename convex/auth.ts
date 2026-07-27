import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";
import { claimPendingShares } from "./lib";

// Convex Auth (PRD §6 — auth must "just work"). Email + password to start;
// add OAuth providers here later if wanted. No JWT/cookie plumbing of our own.

// Sign-up is open (ADR 0021): anyone may create an account — the Allowlist
// gates course *creation*, not existence. Password-only means an email is
// unverified at sign-up; email OTP verification is a planned later bolt-on.
// How long a sign-in lasts. Convex Auth defaults both of these to 30 days, which
// is short for a course worked through over months. The cookie that carries the
// session must be given a matching `maxAge` in src/middleware.ts or the shorter of
// the two wins — these literals are duplicated there (convex/ has its own tsconfig
// and never imports from src/), so change them together. See
// src/lib/sessionLifetime.ts for the full reasoning.
const DAY_MS = 24 * 60 * 60 * 1000;
const SESSION_TOTAL_DURATION_MS = 365 * DAY_MS;
const SESSION_INACTIVE_DURATION_MS = 60 * DAY_MS;

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  session: {
    totalDurationMs: SESSION_TOTAL_DURATION_MS,
    inactiveDurationMs: SESSION_INACTIVE_DURATION_MS,
  },
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
      // New account → claim any Shares invited to this email before it existed.
      const userId = await ctx.db.insert("users", { email });
      await claimPendingShares(ctx, userId, email);
      return userId;
    },
  },
});
