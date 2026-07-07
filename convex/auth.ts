import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import { claimPendingEntitlements, claimPendingShares, hasPendingEntitlement } from "./lib";

// Convex Auth (PRD §6 — auth must "just work"). Email + password to start;
// add OAuth providers here later if wanted. No JWT/cookie plumbing of our own.

// The live site is still a private workspace, so sign-up is gated on the
// Allowlist (ADR 0011 — a Convex table the Admin edits at runtime, replacing the
// old `AUTH_ALLOWED_EMAILS` env var). The gate lives in `createOrUpdateUser`,
// not `profile()`: the Password provider calls `profile()` synchronously (it
// isn't awaited) so it can't read the DB, whereas this callback runs with a
// mutation ctx. The callback fires only on account *creation* for credentials,
// so this gates sign-up ONLY — an account that already exists signs in untouched
// (a deliberate change from the env era, which also blocked sign-in).
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
      // Normalise (trim + lower-case) the account identity here, where the
      // Password provider derives the credential id and the stored `users.email`
      // from this. It must match how the gate normalises (whitelist.isAdmitted),
      // or casing alone would let an admitted email mint a second account past
      // one Allowlist row, and sign-in would be case-sensitive.
      profile(params) {
        return { email: String(params.email ?? "").trim().toLowerCase() };
      },
    }),
  ],
  // NOTE: the gate fires only on account *creation* (createOrUpdateUser). If a
  // `reset` or `verify` provider is added to Password() later, those flows don't
  // route a new user through here — re-check the Allowlist semantics then.
  callbacks: {
    async createOrUpdateUser(ctx, { existingUserId, profile }) {
      // Existing account → sign-in/link, not a new sign-up: no gate.
      if (existingUserId !== null) return existingUserId;
      const email = String(profile.email ?? "").trim().toLowerCase();
      // Admission (ADR 0011 + ADR 0016): the Allowlist admits invited emails, and
      // a **paid purchase** admits a buyer even while sign-up is otherwise closed —
      // payment gates *existence*, the can-sell grant gates *selling*. Either opens
      // the door.
      const admitted =
        (await ctx.runQuery(internal.whitelist.isAdmitted, { email })) || (await hasPendingEntitlement(ctx, email));
      if (!admitted) {
        throw new Error("This workspace is private — sign-ups are closed.");
      }
      // New account admitted → claim anything waiting on this email before it
      // existed: pending Shares become real Shares, and pending Entitlements (paid
      // purchases) become real Entitlements.
      const userId = await ctx.db.insert("users", { email });
      await claimPendingShares(ctx, userId, email);
      await claimPendingEntitlements(ctx, userId, email);
      return userId;
    },
  },
});
