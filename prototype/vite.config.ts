import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// THROWAWAY prototype config — serves prototype/index.html only.
export default defineConfig({
  plugins: [react()],
  server: { port: 5174, open: false },
});
