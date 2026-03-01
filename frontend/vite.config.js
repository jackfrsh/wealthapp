import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'fs'

// Single source of truth: package.json version, overridable via VITE_APP_VERSION env
const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'))
const APP_VERSION = process.env.VITE_APP_VERSION || pkg.version || '0.0.0'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000', // FastAPI
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    // Strip console.log/warn/error in production (keeps console.info for intentional messages)
    minify: 'esbuild',
    target: 'es2020',
    rollupOptions: {
      output: {
        // Separate vendor chunks for better caching
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-charts': ['recharts'],
        },
      },
    },
  },
  esbuild: {
    // Strip all console.* and debugger statements in production
    drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : [],
  },
})