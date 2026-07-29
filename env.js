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
    // NEXT_PUBLIC_COOKIE_DOMAIN is gone: cookies are host-only so each tenant
    // subdomain has its own session, language and theme (ADR 0025). Don't add it
    // back — a parent `Domain` is exactly what shared one account across brands.
  },
  runtimeEnv: {
    NEXT_PUBLIC_CONVEX_URL: process.env.NEXT_PUBLIC_CONVEX_URL,
  },
  // Let Docker/CI image builds opt out of validation (create-t3-app convention).
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
