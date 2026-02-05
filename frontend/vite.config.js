import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

// If you don't have the polyfill plugin yet, run: npm install vite-plugin-node-polyfills

export default defineConfig({
  plugins: [
    react(),
    // This handles the "global is not defined" error for WebRTC
    nodePolyfills({
      global: true,
      process: true,
      buffer: true,
    }),
  ],
  define: {
    global: 'globalThis',
  },
})