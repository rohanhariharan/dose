import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// GitHub Pages serves this repo from /dose/, so the production build is based
// there. Dev stays at the root: a changing port and path is a papercut nobody
// needs while working.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/dose/' : '/',
  plugins: [react()],
  server: { port: 5181, strictPort: true },
}))
