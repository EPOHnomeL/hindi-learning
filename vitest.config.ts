import { defineConfig } from "vitest/config";

// Convex functions run in the edge runtime under test (convex-test).
export default defineConfig({
  test: {
    environment: "edge-runtime",
    server: { deps: { inline: ["convex-test"] } },
  },
});
