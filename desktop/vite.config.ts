import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Renderer-only Vite build. The Electron main + preload are compiled separately
// via tsconfig.main.json (CommonJS, no bundler needed beyond tsc).
export default defineConfig({
  root: 'src/renderer',
  base: './',
  plugins: [react()],
  build: {
    outDir: '../../dist-renderer',
    emptyOutDir: true,
  },
  server: {
    port: 5174,
  },
})
