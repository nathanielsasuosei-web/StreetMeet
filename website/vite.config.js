import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * The browser only ever talks to this dev server; `/api` and `/uploads` are
 * proxied to the backend. That keeps every URL in the app relative, so the SPA
 * works behind any host (localhost, a tunnel, a preview domain) without
 * hard-coding an origin.
 *
 * Override the backend location with BACKEND_URL if it is not on :5000.
 */
const backend = process.env.BACKEND_URL || 'http://127.0.0.1:5000'

const proxy = {
  '/api': { target: backend, changeOrigin: true },
  '/uploads': { target: backend, changeOrigin: true },
}

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: Number(process.env.PORT) || 5173,
    strictPort: false,
    allowedHosts: true,
    proxy,
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    allowedHosts: true,
    proxy,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
})
