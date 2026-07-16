import { defineConfig } from "vitest/config";

// Convex functions run in the edge runtime under test (convex-test).
export default defineConfig({
  test: {
    environment: "edge-runtime",
    server: { deps: { inline: ["convex-test"] } },
    // convex-test globs and loads every convex module, including the ones that
    // statically import the Stripe SDK (payments actions). That first cold load is
    // heavy and is paid inside whichever test triggers module setup first, so the
    // default 5s per-test timeout can flake on a cold run — give it ample margin.
    testTimeout: 30_000,
  },
});
