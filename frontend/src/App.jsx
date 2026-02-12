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

export default function App() {
  const [authed, setAuthed] = useState(false)
  const [checking, setChecking] = useState(true)
  const [username, setUsername] = useState('')
  const [page, setPage] = useState('dashboard')
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem('theme')
    if (saved) return saved === 'dark'
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })
  const [baseCurrency, setBaseCurrency] = useState('GBP')
  const [toast, setToast] = useState(null)

  // Apply dark mode class
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('theme', dark ? 'dark' : 'light')
  }, [dark])

  const showToast = useCallback((msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
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
      })
      .catch(() => {
        clearToken()
      })
      .finally(() => setChecking(false))
  }, [])

  const handleLogin = (tok, uname) => {
    setToken(tok)
    setUsername(uname)
    setAuthed(true)
    setPage('dashboard')
  }

  const handleLogout = () => {
    clearToken()
    setAuthed(false)
    setUsername('')
    setPage('dashboard')
  }

  const ctx = {
    username, baseCurrency, setBaseCurrency,
    dark, setDark, showToast, page, setPage,
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
