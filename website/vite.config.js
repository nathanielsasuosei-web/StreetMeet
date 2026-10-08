import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const djangoTarget = process.env.DJANGO_API_URL || 'http://127.0.0.1:8000'
const djangoProxy = { target: djangoTarget, changeOrigin: true, secure: false }

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    allowedHosts: true,
    proxy: {
      '/api': djangoProxy,
      '/admin': djangoProxy,
      '/media': djangoProxy,
      '/static': djangoProxy,
    },
  },
})
