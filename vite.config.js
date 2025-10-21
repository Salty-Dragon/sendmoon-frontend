import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

export default defineConfig({
  plugins: [react(), tailwindcss(), nodePolyfills()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000',  // Direct to Node backend (bypasses Nginx)
        changeOrigin: true,
        secure: false,                   // HTTP for local
        rewrite: (path) => path.replace(/^\/api/, '/api')
      }
    }
  },
})
