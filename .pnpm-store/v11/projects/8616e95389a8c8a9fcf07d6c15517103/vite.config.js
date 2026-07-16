import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const flaskPort = process.env.FLASK_PORT || "5000";

// During `npm run dev:web` the Vite server (5173) proxies /api calls to Flask.
// `npm run build` emits to dist/, which Flask serves directly in production.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": `http://localhost:${flaskPort}`,
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
