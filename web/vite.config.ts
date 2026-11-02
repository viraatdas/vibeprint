import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

const here = import.meta.dirname

const daemon = `http://127.0.0.1:${process.env.VIBEPRINT_PORT ?? 4747}`

export default defineConfig({
  root: path.resolve(here),
  plugins: [react()],
  resolve: {
    alias: { '@shared': path.resolve(here, '../src/shared') },
  },
  server: {
    host: true,
    port: 5173,
    proxy: {
      // Keep the browser's Host so the daemon's same-origin check passes.
      '/api/sync': { target: daemon.replace('http', 'ws'), ws: true, changeOrigin: false },
      '/api': { target: daemon, changeOrigin: false },
      '/files': { target: daemon, changeOrigin: false },
    },
  },
  // Asset URL imports (fonts, icons) must stay as Vite ?url imports.
  optimizeDeps: { exclude: ['@tldraw/assets'] },
  build: {
    outDir: path.resolve(here, '../dist/web'),
    emptyOutDir: true,
    chunkSizeWarningLimit: 4000,
  },
})
