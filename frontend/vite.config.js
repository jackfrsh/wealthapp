import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'fs'

// Single source of truth: package.json version, overridable via VITE_APP_VERSION env
const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'))
const APP_VERSION = process.env.VITE_APP_VERSION || pkg.version || '0.0.0'

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION),
  },
  server: {
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
})
