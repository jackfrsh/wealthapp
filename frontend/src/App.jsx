import React, { useState, useEffect, useCallback, createContext, useContext } from 'react'
import { api, getToken, setToken, clearToken } from './api'
import AuthPage from './pages/Auth'
import Dashboard from './pages/Dashboard'
import Accounts from './pages/Accounts'
import Snapshots from './pages/Snapshots'
import Projections from './pages/Projections'
import Settings from './pages/Settings'
import Toast from './components/Toast'
import Sidebar from './components/Sidebar'
import MobileNav from './components/MobileNav'

// ─── Contexts ────────────────────────────────────────────
export const AppContext = createContext()
export const useApp = () => useContext(AppContext)

function resolveTheme(pref) {
  if (pref === 'dark') return true
  if (pref === 'light') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export default function App() {
  const [authed, setAuthed] = useState(false)
  const [checking, setChecking] = useState(true)
  const [username, setUsername] = useState('')
  const [page, setPage] = useState('dashboard')
  const [themePref, setThemePref] = useState(() => {
    return localStorage.getItem('theme_pref') || 'system'
  })
  const [dark, setDarkRaw] = useState(() => resolveTheme(localStorage.getItem('theme_pref') || 'system'))
  const [baseCurrency, setBaseCurrency] = useState('GBP')
  const [toast, setToast] = useState(null)

  // Resolve dark from themePref
  useEffect(() => {
    setDarkRaw(resolveTheme(themePref))
    localStorage.setItem('theme_pref', themePref)
  }, [themePref])

  // Listen for system theme changes when pref is 'system'
  useEffect(() => {
    if (themePref !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e) => setDarkRaw(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [themePref])

  // Apply dark mode class
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
  }, [dark])

  const setThemePreference = useCallback((pref) => {
    setThemePref(pref)
    // Fire and forget save to backend
    api('/settings', { method: 'PUT', body: { theme_preference: pref } }).catch(() => {})
  }, [])

  // For backward compat: setDark(bool) → set pref
  const setDark = useCallback((val) => {
    setThemePreference(val ? 'dark' : 'light')
  }, [setThemePreference])

  const showToast = useCallback((msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }, [])

  // Load user theme from settings
  const loadUserTheme = useCallback(async () => {
    try {
      const s = await api('/settings')
      const pref = s.theme_preference || 'system'
      setThemePref(pref)
      setBaseCurrency(s.base_currency || 'GBP')
    } catch (e) { /* ignore */ }
  }, [])

  // Check auth on mount
  useEffect(() => {
    const tok = getToken()
    if (!tok) {
      setChecking(false)
      return
    }
    api('/auth/me')
      .then(me => {
        setUsername(me.username)
        setAuthed(true)
        return loadUserTheme()
      })
      .catch(() => {
        clearToken()
      })
      .finally(() => setChecking(false))
  }, [loadUserTheme])

  const handleLogin = async (tok, uname) => {
    setToken(tok)
    setUsername(uname)
    setAuthed(true)
    setPage('dashboard')
    // Load per-user theme after login
    await loadUserTheme()
  }

  const handleLogout = () => {
    clearToken()
    setAuthed(false)
    setUsername('')
    setPage('dashboard')
    // Reset to system theme
    setThemePref('system')
    localStorage.removeItem('theme_pref')
  }

  const ctx = {
    username, baseCurrency, setBaseCurrency,
    dark, setDark, showToast, page, setPage,
    themePref, setThemePreference,
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface dark:bg-surface-dark">
        <div className="animate-pulse-soft">
          <span className="font-display text-3xl text-ink dark:text-white">wealth<span className="text-accent">.</span></span>
        </div>
      </div>
    )
  }

  if (!authed) {
    return (
      <AppContext.Provider value={ctx}>
        <AuthPage onLogin={handleLogin} />
        {toast && <Toast message={toast.msg} type={toast.type} />}
      </AppContext.Provider>
    )
  }

  const pages = {
    dashboard: Dashboard,
    accounts: Accounts,
    snapshots: Snapshots,
    projections: Projections,
    settings: Settings,
  }
  const PageComponent = pages[page] || Dashboard

  return (
    <AppContext.Provider value={ctx}>
      <div className="flex min-h-screen bg-surface dark:bg-surface-dark transition-colors duration-300">
        <Sidebar onLogout={handleLogout} />
        <main className="flex-1 min-w-0 pb-24 lg:pb-0">
          <div className="max-w-[960px] mx-auto px-5 sm:px-8 py-8 sm:py-10 animate-fade-in" key={page}>
            <PageComponent />
          </div>
        </main>
        <MobileNav />
      </div>
      {toast && <Toast message={toast.msg} type={toast.type} />}
    </AppContext.Provider>
  )
}
