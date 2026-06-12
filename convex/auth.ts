import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";

// Convex Auth (PRD §6 — auth must "just work"). Email + password to start;
// add OAuth providers here later if wanted. No JWT/cookie plumbing of our own.

// While the live site is still a private workspace, gate sign-up AND sign-in to
// an allowlist. Comma-separated, set with:
//   npx convex env set AUTH_ALLOWED_EMAILS "jvorster63@gmail.com" --prod
// Unset/empty → open (so local dev stays frictionless). Compared case-insensitively.
const ALLOWED_EMAILS = (process.env.AUTH_ALLOWED_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
      profile(params) {
        const email = String(params.email ?? "").trim();
        if (ALLOWED_EMAILS.length > 0 && !ALLOWED_EMAILS.includes(email.toLowerCase())) {
          throw new Error("This workspace is private — sign-ups are closed.");
        }
        return { email };
      },
    }),
  ],
});
