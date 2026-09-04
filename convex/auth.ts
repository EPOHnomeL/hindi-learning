import Google from "@auth/core/providers/google";
import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth, getAuthUserId } from "@convex-dev/auth/server";
import type { MutationCtx } from "./_generated/server";
import { AccessCode } from "./accessCodeAuth";
import { ACCESS_CODE_PROVIDER_ID } from "./accessCodeFormat";
import { env } from "./env";
import { oauthRedirectUrl } from "./authRedirect";
import { claimPendingShares } from "./shareGrants";
import { ResendOTPPasswordReset } from "./passwordReset";

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
      // **Forgot password**, the emailed 8-digit OTP (technical-foundation ticket
      // 21). Before this, a user who forgot their password was locked out for
      // good: sign-in throws `InvalidSecret`, sign-up throws "account already
      // exists", and the only way back in was the operator setting a temp password
      // by hand.
      //
      // **This does not touch the sign-up gate, by construction.** The reset flow
      // never reaches `createOrUpdateUser` below: it calls `retrieveAccount` for
      // the address and throws `InvalidAccountId` when there is no row, so it can
      // only ever repoint the secret on an account that already exists. It cannot
      // create a `users` row, so nothing about the Allowlist, the Seat branch or
      // the email-linking rules changes here. The seam test asserts exactly that,
      // on the row counts.
      reset: ResendOTPPasswordReset,
    }),
    // Credentials come off the environment — `setEnvDefaults` reads
    // AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET, set separately on dev and prod — so
    // there is nothing to configure here. Google is an **oidc** provider, not
    // `oauth`; anything branching on the type must accept both.
    Google,
    // A **Seat** on a shared Access Code: a code, a nickname of the member's own
    // choosing, and a PIN. No email, ever (ADR 0031). Built on
    // `ConvexCredentials` rather than `Password` precisely because `Password`
    // derives its account identity from an email and writes into the `email`
    // index; see `accessCodeAuth.ts`. It needs the branch at the top of
    // `createOrUpdateUser` below to be safe at all.
    AccessCode,
  ],
  callbacks: {
    // Send an OAuth sign-in back to the host it started on. The library's default
    // admits only SITE_URL, which under ADR 0025's host-only cookies would leave a
    // buyer who signed in on `ywampotch.my-course.app` signed in on the apex and
    // still signed out where they started. See `oauthRedirectUrl` in authRedirect.ts for the
    // host rule and why it is a security boundary.
    async redirect({ redirectTo }) {
      const siteUrl = env().SITE_URL;
      if (!siteUrl) throw new Error("SITE_URL is not set — provision it as a Convex env var");
      return oauthRedirectUrl(redirectTo, siteUrl);
    },
    async createOrUpdateUser(genericCtx, { existingUserId, provider, profile }) {
      // Convex Auth types this callback's ctx against `AnyDataModel`, so
      // `ctx.db.query("users")` would lose our tables and indexes and the
      // `email` index read below wouldn't typecheck. Narrow once, to the same
      // generated ctx `claimPendingShares` already takes.
      const ctx = genericCtx as MutationCtx;
      // Already an account row for *this* provider -> plain sign-in.
      if (existingUserId !== null) return existingUserId;

      // **A Seat has no email, and this branch must come FIRST** (ADR 0031,
      // shared-access-codes ticket 03; trap 1 from vouchers ticket 11,
      // re-verified against `@convex-dev/auth@0.0.80` on 2026-08-23).
      //
      // Everything below this point computes `email` from `profile.email` and
      // then reads the `email` index UNCONDITIONALLY. A provider that supplies no
      // email therefore inserts a row with `email: ""`, and the *second* member
      // to join a shared code matches that row on the index and signs in as the
      // first, inheriting their Entitlement and their progress; the third makes
      // `.unique()` throw. It fails silently and it looks correct with a single
      // tester, which is why the test for it drives three joins, not two.
      //
      // A fresh row with **no `email` field at all**, not `email: undefined` and
      // not an empty string: an absent field is absent from the index, so no two
      // Seats can ever collide there. `claimPendingShares` is skipped because a
      // Seat has no address for a Share to have been invited to.
      if (provider.id === ACCESS_CODE_PROVIDER_ID) return await ctx.db.insert("users", {});

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

      // **A Seat adopting an email and a password** (the Organisation Voucher rail,
      // ADR 0031 + its 2026-08-25 addendum). The spec listed this out of scope; the
      // operator asked for it after walking the rail, and it is built PASSWORD-ONLY
      // because the Google path genuinely cannot do it: that callback is an
      // httpAction with no Convex identity, so `getAuthUserId` returns null there
      // (vouchers ticket 11, trap 2).
      //
      // This is the narrow, guarded version of the remedy that ticket warned about,
      // and every clause of the guard is load-bearing:
      //
      //   - `getAuthUserId(ctx)` non-null: only a caller who is ALREADY signed in can
      //     adopt, so nothing here is reachable from a plain sign-up form.
      //   - the signed-in row has **no `email`**: only a Seat can be adopted. An
      //     ordinary account can never be silently repointed at another address.
      //   - the target address is **not already a `users` row**: adopting a taken
      //     address would merge two people into one account, which is the exact
      //     failure #111 was about.
      //
      // Fall through when any clause fails, so the ordinary sign-up path below is
      // untouched. The Seat row survives: the member keeps nickname-and-PIN AND gains
      // email-and-password, which is the whole point of the ask.
      if (!viaOAuth && email) {
        const signedInId = await getAuthUserId(ctx);
        const signedIn = signedInId === null ? null : await ctx.db.get(signedInId);
        if (signedIn && signedIn.email === undefined) {
          const taken = await ctx.db
            .query("users")
            .withIndex("email", (q) => q.eq("email", email))
            .unique();
          if (taken === null) {
            await ctx.db.patch(signedIn._id, { email });
            // Shares invited to this address before it existed on an account are
            // claimable now, exactly as they are for a fresh sign-up.
            await claimPendingShares(ctx, signedIn._id, email);
            return signedIn._id;
          }
        }
      }

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
