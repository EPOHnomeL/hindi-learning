import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// The reader SPA. In dev, /api is proxied to the local Worker (wrangler dev on
// 8787). In prod the same SPA is served by the Worker via static assets.
export default defineConfig({
  plugins: [react()],
  build: { outDir: "dist/client" },
  server: {
    port: 5173,
    proxy: { "/api": "http://localhost:8787" },
  },
});
