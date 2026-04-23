import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// Renderer-only Vite build. The Electron main + preload are compiled separately
// via tsconfig.main.json (CommonJS, no bundler needed beyond tsc).
export default defineConfig({
  root: 'src/renderer',
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      // Allow Pet.tsx to import '@hana-icon/active.svg?url' regardless of
      // where the renderer root sits relative to the repo root.
      '@hana-icon': path.resolve(__dirname, '../hana-icon'),
    },
  },
  build: {
    outDir: '../../dist-renderer',
    emptyOutDir: true,
  },
  server: {
    port: 5174,
  },
})
