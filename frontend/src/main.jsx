// frontend/src/main.jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

/**
 * Apply theme ASAP (before React mounts) to avoid:
 * - “flash” of wrong theme
 * - refresh on /settings snapping back to system dark
 */
;(function applyInitialTheme() {
  try {
    const pref = localStorage.getItem('theme_preference') || 'system'

    const isDark =
      pref === 'dark'
        ? true
        : pref === 'light'
        ? false
        : window.matchMedia('(prefers-color-scheme: dark)').matches

    document.documentElement.classList.toggle('dark', isDark)
  } catch {
    // Safe no-op if localStorage is blocked
  }
})()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)