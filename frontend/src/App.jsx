import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  createContext,
  useContext,
} from 'react'

import {
  api,
  ApiError,
  getToken,
  setToken,
  clearToken,
  resetSessionGuard,
  SESSION_EXPIRED_EVENT,
} from './api'

import AuthPage from './pages/Auth'
import Home from './pages/Home'
import Outlook from './pages/Outlook'
import Insights from './pages/Insights'
import Accounts from './pages/Accounts'
import Settings from './pages/Settings'
import GoalSetup from './pages/GoalSetup'
import Upgrade from './pages/Upgrade'
import Snapshots from './pages/Snapshots'

import Toast from './components/Toast'
import Sidebar from './components/Sidebar'
import MobileNav from './components/MobileNav'

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
  const [page, setPage] = useState('home')

  const [themePref, setThemePref] = useState(
    () => localStorage.getItem('theme_pref') || 'system'
  )
  const [dark, setDarkRaw] = useState(() =>
    resolveTheme(localStorage.getItem('theme_pref') || 'system')
  )

  const [baseCurrency, setBaseCurrency] = useState('GBP')
  const [toast, setToast] = useState(null)

  const [primaryGoal, setPrimaryGoal] = useState(undefined)
  const [goalLoading, setGoalLoading] = useState(true)

  const [isPro, setIsPro] = useState(false) // default false
  const [settingsReady, setSettingsReady] = useState(false)

  const APP_VERSION = import.meta.env.VITE_APP_VERSION || 'dev'

  const [dataVersion, setDataVersion] = useState(0)
  const bumpData = useCallback(() => setDataVersion((v) => v + 1), [])

  /* ──────────────────────────────────────────── */
  /* Theme                                       */
  /* ──────────────────────────────────────────── */

  useEffect(() => {
    setDarkRaw(resolveTheme(themePref))
    localStorage.setItem('theme_pref', themePref)
  }, [themePref])

  useEffect(() => {
    if (themePref !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e) => setDarkRaw(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [themePref])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
  }, [dark])

  const setThemePreference = useCallback((pref) => {
    setThemePref(pref)

    api('/settings', {
      method: 'PUT',
      body: JSON.stringify({ theme_preference: pref }),
    }).catch(() => {})
  }, [])

  const setDark = useCallback(
    (val) => setThemePreference(val ? 'dark' : 'light'),
    [setThemePreference]
  )

  const showToast = useCallback((msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }, [])

  /* ──────────────────────────────────────────── */
  /* Data Loaders                                */
  /* ──────────────────────────────────────────── */

  const loadPrimaryGoal = useCallback(async () => {
  try {
    const g = await api('/goals/primary')
    setPrimaryGoal(g)
  } catch (e) {
    if (e?.status === 404) {
      setPrimaryGoal(null)
    } else {
      console.error('Primary goal load failed:', e)
      setPrimaryGoal(null)
    }
  } finally {
    setGoalLoading(false)
  }
}, [])

const IS_DEV = import.meta.env.DEV

const loadUserTheme = useCallback(async () => {
  try {
    const s = await api('/settings')

    setThemePref(s?.theme_preference || 'system')
    setBaseCurrency(s?.base_currency || 'GBP')

    const forcePro =
      IS_DEV && localStorage.getItem('force_pro') === 'true'

    setIsPro(!!s?.is_pro || forcePro)
  } catch (e) {
    console.error('Settings load failed:', e)

    const forcePro =
      IS_DEV && localStorage.getItem('force_pro') === 'true'

    setIsPro(!!forcePro)
  } finally {
    setSettingsReady(true)
  }
}, [])

  /* ──────────────────────────────────────────── */
  /* Session Reset                               */
  /* ──────────────────────────────────────────── */

  const resetSessionRef = useRef(null)

  const resetSession = useCallback(() => {
    clearToken()
    setAuthed(false)
    setUsername('')
    setPage('home')
    setPrimaryGoal(undefined)
    setGoalLoading(false)
    setBaseCurrency('GBP')
    setThemePref('system')
    setIsPro(false)
    setSettingsReady(false) // 🔒 ensure we re-gate after logout/reset
    setDataVersion(0)
    localStorage.removeItem('theme_pref')
    localStorage.removeItem('force_pro')
  }, [])

  resetSessionRef.current = resetSession

  useEffect(() => {
    const handler = () => resetSessionRef.current()
    window.addEventListener(SESSION_EXPIRED_EVENT, handler)
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handler)
  }, [])

  /* ──────────────────────────────────────────── */
  /* Bootstrap                                   */
  /* ──────────────────────────────────────────── */

  const bootstrapRan = useRef(false)

  useEffect(() => {
    if (bootstrapRan.current) return
    bootstrapRan.current = true

    const run = async () => {
      // Prefer Supabase session; fall back to legacy token
      let hasToken = false
      try {
        const { supabase } = await import('./supabase')
        if (supabase) {
          const {
            data: { session },
          } = await supabase.auth.getSession()
          if (session?.access_token) {
            setToken(session.access_token)
            hasToken = true
          }
        }
      } catch {
        // Supabase unavailable
      }

      if (!hasToken) {
        hasToken = !!getToken()
      }

      if (!hasToken) {
        setChecking(false)
        setGoalLoading(false)
        setSettingsReady(true) // ✅ no auth = no settings fetch needed
        return
      }

      try {
        const me = await api('/auth/me')
        setUsername(me.username)
        setAuthed(true)
        // ✅ wait for both so UI never renders with wrong theme/pro/currency
        await Promise.all([loadUserTheme(), loadPrimaryGoal()])
      } catch (e) {
        if (e?.status === 401) resetSession()
      } finally {
        setChecking(false)
      }
    }

    run()
  }, [loadUserTheme, loadPrimaryGoal, resetSession])

  /* ──────────────────────────────────────────── */
  /* Auth Actions                                */
  /* ──────────────────────────────────────────── */

  const handleLogin = async (tok, uname) => {
  resetSessionGuard()
  setToken(tok)
  setUsername(uname)
  setAuthed(true)
  setGoalLoading(true)
  setSettingsReady(false) // 🔒 gate until settings load
  setPage('home')
  await Promise.all([loadUserTheme(), loadPrimaryGoal()])
}

const handleLogout = useCallback(() => {
  // 1) UI first: instantly reset state + route
  resetSession()

  // 2) Best-effort Supabase sign out (do NOT block UI)
  ;(async () => {
    try {
      const { supabase } = await import('./supabase')
      await supabase.auth.signOut()
    } catch {}
  })()
}, [resetSession])

const handleGoalCreated = (goal) => {
  setPrimaryGoal(goal)
  bumpData()
  setPage('home')
}

  /* ──────────────────────────────────────────── */
  /* Context                                     */
  /* ──────────────────────────────────────────── */

  const ctx = {
    username,
    baseCurrency,
    setBaseCurrency,
    dark,
    setDark,
    showToast,
    page,
    setPage,
    themePref,
    setThemePreference,
    primaryGoal,
    setPrimaryGoal,
    loadPrimaryGoal,
    dataVersion,
    bumpData,
    isPro,
    setIsPro,
    settingsReady,
    handleLogout,
  }

  /* ──────────────────────────────────────────── */
  /* Render                                      */
  /* ──────────────────────────────────────────── */

  // ✅ Gate *all* rendering until settings are applied (prevents theme/pro/currency flash)
  if (checking || !settingsReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface dark:bg-surface-dark">
        <div className="animate-pulse-soft">
          <span className="font-display text-4xl text-ink dark:text-white">
            wealth<span className="text-accent">.</span>
          </span>
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

  const needsGoalSetup =
    !goalLoading &&
    primaryGoal === null &&
    page !== 'accounts' &&
    page !== 'settings' &&
    page !== 'upgrade' &&
    page !== 'snapshots'

  const pages = {
    home: Home,
    outlook: Outlook,
    insights: Insights,
    accounts: Accounts,
    settings: Settings,
    upgrade: Upgrade,
    snapshots: Snapshots,
  }

  const PageComponent = pages[page] || Home

  return (
    <AppContext.Provider value={ctx}>
      <div className="flex min-h-screen bg-surface dark:bg-surface-dark transition-colors duration-300">
        <Sidebar />
        <main className="flex-1 min-w-0 pb-28 lg:pb-0 relative">
          <span className="absolute top-4 right-6 text-[10px] font-mono text-ink-muted/25 dark:text-white/15 select-none">
            v{APP_VERSION}
          </span>

          <div
            className="max-w-[960px] mx-auto px-5 sm:px-8 lg:px-10 py-8 sm:py-12 animate-fade-in"
            key={needsGoalSetup ? 'setup' : page}
          >
            {needsGoalSetup ? (
              <GoalSetup onComplete={handleGoalCreated} />
            ) : (
              <PageComponent />
            )}
          </div>
        </main>
        <MobileNav />
      </div>

      {toast && <Toast message={toast.msg} type={toast.type} />}
    </AppContext.Provider>
  )
}
