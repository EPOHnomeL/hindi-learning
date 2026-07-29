import Google from "@auth/core/providers/google";
import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";
import type { MutationCtx } from "./_generated/server";
import { claimPendingShares } from "./lib";

// Convex Auth (PRD §6 — auth must "just work"). Email + password, plus Google.
// No JWT/cookie plumbing of our own.

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
    // Credentials come off the environment — `setEnvDefaults` reads
    // AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET, set separately on dev and prod — so
    // there is nothing to configure here. Google is an **oidc** provider, not
    // `oauth`; anything branching on the type must accept both.
    Google,
  ],
  callbacks: {
    async createOrUpdateUser(genericCtx, { existingUserId, provider, profile }) {
      // Convex Auth types this callback's ctx against `AnyDataModel`, so
      // `ctx.db.query("users")` would lose our tables and indexes and the
      // `email` index read below wouldn't typecheck. Narrow once, to the same
      // generated ctx `claimPendingShares` already takes.
      const ctx = genericCtx as MutationCtx;
      // Already an account row for *this* provider → plain sign-in.
      if (existingUserId !== null) return existingUserId;
      const email = String(profile.email ?? "").trim().toLowerCase();

      // Convex Auth's own email-linking is unreachable once a custom
      // `createOrUpdateUser` is supplied, and `existingUserId` is populated only
      // from an `authAccounts` row for the *same* provider. So without the lookup
      // below, a password user's first Google click would insert a **second users
      // row on the same email** — stranding their purchases, progress,
      // certificates and Shares in the account they can no longer reach (#111).
      // An OAuth/OIDC provider has verified the address itself, which is what
      // makes linking on it safe. (Accepted risk, decided in the PRD: someone who
      // pre-registers a password account on an address they don't own will
      // receive its owner's later Google sign-in.)
      const viaOAuth = provider.type === "oauth" || provider.type === "oidc";
      const existing = await ctx.db
        .query("users")
        .withIndex("email", (q) => q.eq("email", email))
        .unique();
      if (existing !== null) {
        // Link. Deliberately patch nothing but the verification stamp: `users.name`
        // doubles as the Certificate display name (users.ts) and may have been set
        // on purpose, so taking Google's version would silently change what future
        // Certificates print. `claimPendingShares` also stays off this path — it
        // runs at sign-up, and repeating it here would add an index read to every
        // Google sign-in for no gain.
        if (viaOAuth && existing.emailVerificationTime === undefined) {
          await ctx.db.patch(existing._id, { emailVerificationTime: Date.now() });
        }
        return existing._id;
      }

      // New account → claim any Shares invited to this email before it existed.
      // A fresh OAuth account has no chosen name to lose, so take the profile's.
      const userId = await ctx.db.insert("users", {
        email,
        ...(viaOAuth
          ? {
              emailVerificationTime: Date.now(),
              name: profile.name as string | undefined,
              image: profile.image as string | undefined,
            }
          : {}),
      });
      await claimPendingShares(ctx, userId, email);
      return userId;
    },
  },
});
