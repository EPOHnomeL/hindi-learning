// Validate the Next.js app's env vars at build/startup (fails the build on a
// missing/invalid var). Convex's own env vars are validated in convex/env.ts.
import "./env.js";
import createNextIntlPlugin from "next-intl/plugin";

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

export default withNextIntl(config);
