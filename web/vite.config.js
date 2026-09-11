import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The API runs on port 5000 (see ../backend). Vite proxies /api, /socket.io
// and /uploads so the browser only ever talks to one origin - which is also
// how it works in production behind a reverse proxy.
const API = process.env.VITE_API_URL || "http://127.0.0.1:5000";

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    strictPort: false,
    allowedHosts: true,
    proxy: {
      "/api": { target: API, changeOrigin: true },
      "/socket.io": { target: API, ws: true, changeOrigin: true },
      "/uploads": { target: API, changeOrigin: true },
      "/health": { target: API, changeOrigin: true },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: false,
  },
});
