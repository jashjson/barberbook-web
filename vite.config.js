import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  root: '.',
  publicDir: 'public',
  server: { 
    port: 3000,
    open: '/app.html',
    strictPort: true
  },
  build: { 
    outDir: 'dist/app',
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      input: resolve(__dirname, 'app.html')
    }
  }
})
