import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// During `npm run dev` the Vite server (5173) proxies /api calls to Flask (5000).
// `npm run build` emits to dist/, which Flask serves directly in production.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:5000",
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
