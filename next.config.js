/** @type {import("next").NextConfig} */
const config = {
  // Pin the workspace root — there is another pnpm-lock.yaml in the home dir,
  // and Next otherwise infers the wrong root for output file tracing.
  outputFileTracingRoot: import.meta.dirname,
};

export default config;
