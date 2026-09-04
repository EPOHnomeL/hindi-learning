// Validate the Next.js app's env vars at build/startup (fails the build on a
// missing/invalid var). Convex's own env vars are validated in convex/env.ts.
import "./env.js";
import createNextIntlPlugin from "next-intl/plugin";
import { withPostHogConfig } from "@posthog/nextjs-config";

// next-intl "without i18n routing" (ticket 04): the plugin wires the request
// config at ./src/i18n/request.ts (auto-detected) — no locale routing, no
// middleware. The locale comes from a cookie, resolved server-side.
const withNextIntl = createNextIntlPlugin();

/** @type {import("next").NextConfig} */
const config = {
  // Pin the workspace root — there is another pnpm-lock.yaml in the home dir,
  // and Next otherwise infers the wrong root for output file tracing.
  outputFileTracingRoot: import.meta.dirname,
};

// Generate browser source maps at build and upload them to PostHog, so client
// exceptions symbolicate to real call sites instead of minified frames.
//
// withPostHogConfig must stay the OUTERMOST wrapper: wrapped by withNextIntl it
// would receive a plain object and its build hooks would be dropped.
//
// The wrapper throws at config load when source maps are enabled without a
// personal API key, so gate `enabled` on the two build-time secrets. This keeps
// the build green wherever they are absent (local dev, and Vercel before they
// are set); set POSTHOG_API_KEY and POSTHOG_PROJECT_ID in the Vercel project to
// turn upload on. Host is the EU app (project 264778), not the ingestion proxy.
export default withPostHogConfig(withNextIntl(config), {
  personalApiKey: process.env.POSTHOG_API_KEY ?? "",
  projectId: process.env.POSTHOG_PROJECT_ID,
  host: "https://eu.posthog.com",
  sourcemaps: {
    enabled: Boolean(process.env.POSTHOG_API_KEY && process.env.POSTHOG_PROJECT_ID),
  },
});
