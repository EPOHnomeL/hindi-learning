import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// The reader SPA. In dev, /api is proxied to the local Worker (wrangler dev on
// 8787). In prod the same SPA is served by the Worker via static assets.
export default defineConfig({
  plugins: [react()],
  build: { outDir: "dist/client" },
  server: {
    host: true, // bind 0.0.0.0 so the reader is reachable on the LAN (phone)
    port: 5173,
    proxy: { "/api": "http://localhost:8787" },
  },
});
