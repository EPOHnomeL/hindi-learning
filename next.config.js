// Validate the Next.js app's env vars at build/startup (fails the build on a
// missing/invalid var). Convex's own env vars are validated in convex/env.ts.
import "./env.js";

/** @type {import("next").NextConfig} */
const config = {
  // Pin the workspace root — there is another pnpm-lock.yaml in the home dir,
  // and Next otherwise infers the wrong root for output file tracing.
  outputFileTracingRoot: import.meta.dirname,
};

export default config;
