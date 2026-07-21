import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

/**
 * Type-safe environment variables for the Next.js app, validated at build time.
 * Convex-runtime vars (PAYFAST_*, etc.) live in convex/env.ts — a separate
 * runtime and deployment that this module can't see, so don't add them here.
 */
export const env = createEnv({
  server: {},
  client: {
    // The Convex deployment URL the browser client connects to.
    NEXT_PUBLIC_CONVEX_URL: z.string().url(),
    // The registrable parent domain to scope the session/theme/locale cookies to
    // (e.g. "my-course.app"), so one sign-in and the chosen theme/language span
    // every tenant subdomain. Optional: leave unset in dev/preview to keep cookies
    // host-only (a *.vercel.app Domain would be rejected as a public suffix). Also
    // read by the @convex-dev/auth cookie patch and src/lib/cookieDomain.ts.
    NEXT_PUBLIC_COOKIE_DOMAIN: z.string().optional(),
  },
  runtimeEnv: {
    NEXT_PUBLIC_CONVEX_URL: process.env.NEXT_PUBLIC_CONVEX_URL,
    NEXT_PUBLIC_COOKIE_DOMAIN: process.env.NEXT_PUBLIC_COOKIE_DOMAIN,
  },
  // Let Docker/CI image builds opt out of validation (create-t3-app convention).
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
