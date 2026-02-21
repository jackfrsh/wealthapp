// App.jsx
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
  setAccessTokenProvider,
  SESSION_EXPIRED_EVENT,
} from './api'

import { supabase } from './supabaseClient'

import AuthPage from './pages/Auth'
import Landing from './pages/Landing'
import Privacy from './pages/Privacy'
import Security from './pages/Security'
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

// If you have this util already, keep using yours. Otherwise this is safe.
function resolveTheme(pref) {
  if (pref === 'dark') return true
  if (pref === 'light') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

// If you already have this, keep yours. This is a safe no-op fallback.
function clearCelebrationStorage() {
  try {
    localStorage.removeItem('milestone_celebration_seen')
    localStorage.removeItem('milestone_celebration_last_shown')
  } catch {}
}

export const AppContext = createContext()
export const useApp = () => useContext(AppContext)

export default function App() {
  const [checking, setChecking] = useState(true)

  const [authed, setAuthed] = useState(false)
  const [username, setUsername] = useState('')

  const [page, setPage] = useState('auth') // auth | home | outlook | insights | accounts | settings | ...
  const [toast, setToast] = useState(null)

  const [themePref, setThemePref] = useState('system')
  const [isDark, setIsDark] = useState(resolveTheme('system'))

  const [baseCurrency, setBaseCurrency] = useState('GBP')
  const [isPro, setIsPro] = useState(false)

  // Primary goal state machine:
  //   undefined = not loaded yet
  //   null      = loaded, no goal (new user)
  //   object    = loaded, has goal
  const [primaryGoal, setPrimaryGoal] = useState(undefined)
  const [goalLoading, setGoalLoading] = useState(false)

  const [settingsReady, setSettingsReady] = useState(false)
  const [dataVersion, setDataVersion] = useState(0)
  const bumpData = useCallback(() => setDataVersion((v) => v + 1), [])

  // One-time per authed session bootstrap guard (prevents reloading on token refresh)
  const bootstrappedRef = useRef(false)

  /* ──────────────────────────────────────────── */
  /* Toast                                       */
  /* ──────────────────────────────────────────── */

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type, id: Date.now() })
  }, [])

  /* ──────────────────────────────────────────── */
  /* Theme                                       */
  /* ──────────────────────────────────────────── */

  useEffect(() => {
    const dark = resolveTheme(themePref)
    setIsDark(dark)
    document.documentElement.classList.toggle('dark', dark)
  }, [themePref])

  /* ──────────────────────────────────────────── */
  /* Data Loaders                                */
  /* ──────────────────────────────────────────── */

  const loadPrimaryGoal = useCallback(async () => {
    setGoalLoading(true)
    try {
      const g = await api('/goals/primary')
      setPrimaryGoal(g)
    } catch (e) {
      if (e?.status === 404) {
        // New user: no goal yet — normal
        setPrimaryGoal(null)
      } else {
        console.error('Primary goal load failed:', e)
        // Safe fallback: treat as no goal so the app stays usable
        setPrimaryGoal(null)
      }
    } finally {
      setGoalLoading(false)
    }
  }, [])

  const loadUserTheme = useCallback(async () => {
    try {
      const s = await api('/settings')
      setThemePref(s?.theme_preference || 'system')
      setBaseCurrency(s?.base_currency || 'GBP')

      setIsPro(
        !!s?.is_pro ||
          (import.meta.env.DEV &&
            localStorage.getItem('force_pro') === 'true')
      )
    } catch (e) {
      console.error('Settings load failed:', e)
    }
  }, [])

  /* ──────────────────────────────────────────── */
  /* Session Reset                               */
  /* ──────────────────────────────────────────── */

  const resetSession = useCallback(() => {
    bootstrappedRef.current = false

    setAuthed(false)
    setUsername('')

    setPrimaryGoal(undefined)
    setGoalLoading(false)

    setBaseCurrency('GBP')
    // Keep theme pref sticky by design
    setIsPro(false)

    setSettingsReady(true)
    setPage('auth')

    setDataVersion(0)

    // Legacy keys only; Supabase handles session storage itself.
    try {
      localStorage.removeItem('wealthapp-access-token')
      localStorage.removeItem('access_token')
      localStorage.removeItem('force_pro')
    } catch {}
  }, [])

  const resetSessionRef = useRef(null)
  resetSessionRef.current = resetSession

  /* ──────────────────────────────────────────── */
  /* Session Expiry                              */
  /* ──────────────────────────────────────────── */

  useEffect(() => {
    const onExpired = async () => {
      clearCelebrationStorage()
      try {
        await supabase.auth.signOut()
      } catch {}
      resetSessionRef.current?.()
    }

    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired)
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired)
  }, [])

  /* ──────────────────────────────────────────── */
  /* Auth Actions                                */
  /* ──────────────────────────────────────────── */

  const handleLogin = useCallback((email) => {
    setUsername(email || '')
    setAuthed(true)
    // Do NOT load data here — onAuthStateChange owns that flow.
    setPage('home')
  }, [])

  const handleLogout = useCallback(
    async () => {
      clearCelebrationStorage()
      resetSession()
      try {
        await supabase.auth.signOut()
      } catch (e) {
        console.warn('signOut failed:', e?.message || e)
      }
    },
    [resetSession]
  )

  const handleGoalCreated = useCallback(
    (goal) => {
      setPrimaryGoal(goal)
      bumpData()
      setPage('home')
    },
    [bumpData]
  )

  /* ──────────────────────────────────────────── */
  /* Bootstrap + Auth Sync                        */
  /* ──────────────────────────────────────────── */

  useEffect(() => {
  // Wire API to Supabase access tokens once
  setAccessTokenProvider(async () => {
    const { data } = await supabase.auth.getSession()
    return data?.session?.access_token || null
  })

  let cancelled = false

  const handleSession = async (session) => {
    try {
      const isAuthedNow = !!session?.access_token
      if (cancelled) return

      setAuthed(isAuthedNow)
      setUsername(session?.user?.email || '')

      if (!isAuthedNow) {
        bootstrappedRef.current = false
        setPrimaryGoal(undefined)
        setGoalLoading(false)
        setSettingsReady(true)
        setPage('auth')
        return
      }

      if (!bootstrappedRef.current) {
        bootstrappedRef.current = true
        setSettingsReady(false)
        await Promise.allSettled([loadUserTheme(), loadPrimaryGoal()])
        if (cancelled) return
        setSettingsReady(true)
      }

      setPage((p) =>
        p === 'privacy' || p === 'security' || p === 'auth' ? 'home' : p
      )
    } catch (e) {
      console.error('Bootstrap failed:', e)
      // Never hang the app on refresh
      setSettingsReady(true)
    } finally {
      // Safety: always clear the initial loading gate
      setChecking(false)
    }
  }

  ;(async () => {
    // Initial hydration on refresh
    const { data, error } = await supabase.auth.getSession()
    if (error) console.warn('getSession failed:', error)
    await handleSession(data?.session)
  })()

  // Subscribe for ongoing changes
  const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
    handleSession(session)
  })

  return () => {
    cancelled = true
    sub.subscription.unsubscribe()
  }
}, [loadUserTheme, loadPrimaryGoal])

  /* ──────────────────────────────────────────── */
  /* Routing                                     */
  /* ──────────────────────────────────────────── */

  const effectivePage =
    authed && (page === 'auth' || page === 'privacy' || page === 'security')
      ? 'home'
      : page

  // Gate: show GoalSetup if authed + primary goal explicitly missing
  const needsGoal = authed && primaryGoal === null

  const ctx = {
    authed,
    username,
    page: effectivePage,
    setPage,
    themePref,
    setThemePref,
    isDark,
    baseCurrency,
    setBaseCurrency,
    isPro,
    setIsPro,
    primaryGoal,
    setPrimaryGoal,
    goalLoading,
    settingsReady,
    dataVersion,
    bumpData,
    showToast,
    handleLogout,
  }

  /* ──────────────────────────────────────────── */
  /* Render                                      */
  /* ──────────────────────────────────────────── */

  // Initial boot gate
  if (checking || (authed && !settingsReady)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface dark:bg-surface-dark">
        <div className="animate-pulse-soft">
          <span className="font-display text-4xl text-ink dark:text-white">
            wealth<span className="text-accent">.</span>
          </span>
          <div className="mt-3 text-center text-xs text-ink-muted/50 dark:text-white/20">
            Loading…
          </div>
        </div>
      </div>
    )
  }

  // Auth gate
  if (!authed) {
    return (
      <AppContext.Provider value={ctx}>
        {effectivePage === 'privacy' ? (
          <Privacy onBack={() => setPage('auth')} />
        ) : effectivePage === 'security' ? (
          <Security onBack={() => setPage('auth')} />
        ) : effectivePage === 'landing' ? (
          <Landing onStart={() => setPage('auth')} />
        ) : (
          <AuthPage
            onLogin={handleLogin}
            onGoPrivacy={() => setPage('privacy')}
            onGoSecurity={() => setPage('security')}
          />
        )}

        <Toast toast={toast} onClose={() => setToast(null)} />
      </AppContext.Provider>
    )
  }

  // New-user goal gate
  if (needsGoal) {
    return (
      <AppContext.Provider value={ctx}>
        <div className="min-h-screen bg-surface dark:bg-surface-dark px-4 py-10">
          <GoalSetup onComplete={handleGoalCreated} />
        </div>
        <Toast toast={toast} onClose={() => setToast(null)} />
      </AppContext.Provider>
    )
  }

  // Main app shell
  return (
    <AppContext.Provider value={ctx}>
      <div className="min-h-screen bg-surface dark:bg-surface-dark lg:flex">
  <Sidebar page={effectivePage} setPage={setPage} isPro={isPro} />
  <MobileNav page={effectivePage} setPage={setPage} isPro={isPro} />

  <main className="flex-1 px-4 sm:px-6 py-6 pb-28 lg:pb-6">
    {effectivePage === 'home' ? (
      <Home />
    ) : effectivePage === 'outlook' ? (
      <Outlook />
    ) : effectivePage === 'insights' ? (
      <Insights />
    ) : effectivePage === 'accounts' ? (
      <Accounts />
    ) : effectivePage === 'snapshots' ? (
      <Snapshots />
    ) : effectivePage === 'upgrade' ? (
      <Upgrade />
    ) : effectivePage === 'settings' ? (
      <Settings />
    ) : (
      <Home />
    )}
  </main>

  <Toast toast={toast} onClose={() => setToast(null)} />
</div>
    </AppContext.Provider>
  )
}