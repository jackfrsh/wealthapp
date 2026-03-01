// frontend/src/App.jsx
import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  createContext,
  useContext,
  Suspense,
} from 'react'

import { supabase } from './supabase'
import {
  api,
  setAccessTokenProvider,
  SESSION_EXPIRED_EVENT,
  invalidateCache,
  invalidatePath,
} from './api'

import Landing from './pages/Landing'
import AuthPage from './pages/Auth'
import Privacy from './pages/Privacy'
import Security from './pages/Security'
import Terms from './pages/Terms'

// Lazy-load authed pages — Landing/Auth ship in main bundle, everything else is code-split
const Home = React.lazy(() => import('./pages/Home'))
const Outlook = React.lazy(() => import('./pages/Outlook'))
const Insights = React.lazy(() => import('./pages/Insights'))
const Accounts = React.lazy(() => import('./pages/Accounts'))
const Settings = React.lazy(() => import('./pages/Settings'))
const GoalSetup = React.lazy(() => import('./pages/GoalSetup'))
const Upgrade = React.lazy(() => import('./pages/Upgrade'))
const Admin = React.lazy(() => import('./pages/Admin'))

import Toast from './components/Toast'
import Sidebar from './components/Sidebar'
import MobileNav from './components/MobileNav'
import BottomNav from './components/BottomNav'

/* ────────────────────────────────────────────
   Error Boundary — catches render crashes
──────────────────────────────────────────── */
class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-surface dark:bg-surface-dark px-6">
          <div className="text-center max-w-md space-y-4">
            <div className="font-display text-3xl text-ink dark:text-white">
              Something went wrong
            </div>
            <p className="text-sm text-ink-muted dark:text-white/60">
              An unexpected error occurred. Please refresh the page to continue.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-5 py-2.5 rounded-xl bg-accent text-white text-sm font-medium
                         hover:bg-accent/90 transition-colors"
              type="button"
            >
              Refresh
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

export const AppContext = createContext()
export const useApp = () => useContext(AppContext)

/* ────────────────────────────────────────────
   Routing helpers
──────────────────────────────────────────── */
const PAGE_TO_PATH = {
  landing: '/',
  auth: '/auth',
  privacy: '/privacy',
  security: '/security',
  terms: '/terms',
  upgrade: '/upgrade',
  settings: '/settings',
  accounts: '/accounts',
  outlook: '/outlook',
  insights: '/insights',
  goal_setup: '/goal_setup',
  admin: '/admin',
  home: '/home',
}

function pageFromPath(pathname) {
  const p = (pathname || '').toLowerCase()
  if (p === '/' || p === '') return 'landing'
  if (p.startsWith('/auth')) return 'auth'
  if (p.startsWith('/privacy')) return 'privacy'
  if (p.startsWith('/security')) return 'security'
  if (p.startsWith('/terms')) return 'terms'
  if (p.startsWith('/upgrade')) return 'upgrade'
  if (p.startsWith('/settings')) return 'settings'
  if (p.startsWith('/accounts')) return 'accounts'
  if (p.startsWith('/outlook')) return 'outlook'
  if (p.startsWith('/insights')) return 'insights'
  if (p.startsWith('/goal_setup')) return 'goal_setup'
  if (p.startsWith('/admin')) return 'admin'
  if (p.startsWith('/home')) return 'home'
  return 'landing'
}

function resolveTheme(pref) {
  if (pref === 'dark') return true
  if (pref === 'light') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}
function applyThemeToDom(pref) {
  document.documentElement.classList.toggle('dark', resolveTheme(pref))
}

/* ────────────────────────────────────────────
   App
──────────────────────────────────────────── */
export default function App() {
  const [page, _setPage] = useState('landing')

  const [authed, setAuthed] = useState(false)
  const [checking, setChecking] = useState(true)
  const [settingsReady, setSettingsReady] = useState(true)

  const [username, setUsername] = useState('')

// ────────────────────────────────────────────
// Theme (single source of truth)
// ────────────────────────────────────────────
const THEME_KEY = 'theme_preference'

const resolveTheme = (pref) => {
  if (pref === 'dark') return true
  if (pref === 'light') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

const applyThemeToDom = (pref) => {
  document.documentElement.classList.toggle('dark', resolveTheme(pref))
}

const [themePref, _setThemePref] = useState(() => {
  try {
    return localStorage.getItem(THEME_KEY) || 'system'
  } catch {
    return 'system'
  }
})

// ✅ the only setter anyone should use
const setThemePreference = useCallback((pref) => {
  const next = pref || 'system'
  _setThemePref(next)        // state
  applyThemeToDom(next)      // DOM instantly
  try {
    localStorage.setItem(THEME_KEY, next)
  } catch {}
}, [])

// Ensure DOM is correct on first paint + whenever state changes
useEffect(() => {
  applyThemeToDom(themePref)
}, [themePref])

// Live system theme changes only when pref === 'system'
useEffect(() => {
  if (themePref !== 'system') return
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  const handler = () => applyThemeToDom('system')
  mq.addEventListener?.('change', handler)
  return () => mq.removeEventListener?.('change', handler)
}, [themePref])

  const [baseCurrency, setBaseCurrency] = useState('GBP')
  const [isPro, setIsPro] = useState(false)
  const [subscriptionStatus, setSubscriptionStatus] = useState(null)
  const [trialEnd, setTrialEnd] = useState(null)

  const [toast, setToast] = useState(null)
  const showToast = useCallback((message, kind = 'success') => {
    setToast({ id: Date.now() + Math.random(), kind, message })
  }, [])

  // undefined = loading/not fetched yet, null = fetched and missing, object = exists
  const [primaryGoal, setPrimaryGoal] = useState(undefined)
  const [goalLoading, setGoalLoading] = useState(false)

  const [accountsCount, setAccountsCount] = useState(undefined)

  const [dataVersion, setDataVersion] = useState(0)
  const bumpData = useCallback(() => {
    invalidateCache()
    setDataVersion((v) => v + 1)
  }, [])

  const dark = resolveTheme(themePref)

  // Stable history-aware setPage
  const setPage = useCallback((next, { replace = false } = {}) => {
    const n = next || 'landing'
    _setPage(n)
    try {
      const path = PAGE_TO_PATH[n] || '/'
      const current = window.location.pathname || '/'
      if (current !== path) {
        if (replace) window.history.replaceState({}, '', path)
        else window.history.pushState({}, '', path)
      }
    } catch {}
  }, [])

  // Initial route + back button
  useEffect(() => {
    const initial = pageFromPath(window.location.pathname)
    _setPage(initial)
    try {
      window.history.replaceState({}, '', PAGE_TO_PATH[initial] || '/')
    } catch {}

    const onPop = () => {
      const p = pageFromPath(window.location.pathname)
      _setPage(p)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  // Theme apply
  useEffect(() => {
    applyThemeToDom(themePref)
  }, [themePref])

  // If system theme + OS changes, reflect instantly
  useEffect(() => {
    if (themePref !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => applyThemeToDom('system')
    handler()
    mq.addEventListener?.('change', handler)
    return () => mq.removeEventListener?.('change', handler)
  }, [themePref])

  // Document title per page
  const PAGE_TITLES = {
    landing: 'Paddock — Private Net Worth Tracker & Wealth Dashboard',
    auth: 'Sign in — Paddock',
    home: 'Dashboard — Paddock',
    outlook: 'Outlook — Paddock',
    insights: 'Insights — Paddock',
    accounts: 'Accounts — Paddock',
    settings: 'Settings — Paddock',
    upgrade: 'Upgrade — Paddock',
    goal_setup: 'Set your goal — Paddock',
    privacy: 'Privacy — Paddock',
    security: 'Security — Paddock',
    terms: 'Terms of Service — Paddock',
    admin: 'Admin — Paddock',
  }
  useEffect(() => {
    document.title = PAGE_TITLES[page] || 'Paddock'
  }, [page])

  // Entitlements refresh (rate-limited)
  const entitlementsCheckedAtRef = useRef(0)
  const refreshSettings = useCallback(
    async ({ force = false } = {}) => {
      const now = Date.now()
      const STALE_MS = 60_000
      if (!force && entitlementsCheckedAtRef.current && now - entitlementsCheckedAtRef.current < STALE_MS) {
        return null
      }
      entitlementsCheckedAtRef.current = now

      try {
        const s = await api('/settings')
        // 🍎 Do NOT touch theme here.
        setBaseCurrency((s?.base_currency || 'GBP').toUpperCase())
        setIsPro(!!s?.is_pro)
        setSubscriptionStatus(s?.subscription_status || null)
        setTrialEnd(s?.trial_end || null)
        return s
      } catch {
        return null
      }
    },
    [api]
  )

  /**
   * Primary goal fetch: only 404 means "missing".
   */
  const fetchPrimaryGoal = useCallback(async () => {
    setGoalLoading(true)
    try {
      const g = await api('/goals/primary')

      const looksLikeGoal =
        g &&
        typeof g === 'object' &&
        !Array.isArray(g) &&
        (g.id != null || g.goal_id != null)

      if (!looksLikeGoal) {
        setPrimaryGoal(null)
        return null
      }

      setPrimaryGoal(g)
      return g
    } catch (e) {
      if (e?.status === 404) {
        setPrimaryGoal(null)
        return null
      }
      console.error('Primary goal load failed:', e)
      setPrimaryGoal((prev) => (prev === undefined ? undefined : prev))
      return null
    } finally {
      setGoalLoading(false)
    }
  }, [api])

  /**
   * Accounts count fetch: don't turn transient failure into 0.
   */
  const fetchAccountsCount = useCallback(async () => {
    try {
      const rows = await api('/accounts')
      const n = Array.isArray(rows) ? rows.length : 0
      setAccountsCount(n)
      return n
    } catch (e) {
      console.error('Accounts count load failed:', e)
      setAccountsCount((prev) => (prev === undefined ? undefined : prev))
      return null
    }
  }, [api])

  const syncBilling = useCallback(async () => {
    try {
      await api('/billing/sync', { method: 'POST' })
      await refreshSettings({ force: true })
      return true
    } catch {
      return false
    }
  }, [api, refreshSettings])

  // Auth bootstrap (single-load per token)
  const bootIdRef = useRef(0)
  const tokenRef = useRef(null)
  const bootTokenRef = useRef(null) // remembers the token we already bootstrapped

  const logout = useCallback(async () => {
    try {
      await supabase?.auth?.signOut?.()
    } catch {}

    // reset bootstrap guard
    bootTokenRef.current = null
    tokenRef.current = null

    setAuthed(false)
    setUsername('')
    setIsPro(false)

    setPrimaryGoal(undefined)
    setAccountsCount(undefined)

    setSettingsReady(true)
    setChecking(false)

    try {
      localStorage.removeItem('force_pro')
      localStorage.removeItem('upgrade_reason')
    } catch {}

    setPage('landing', { replace: true })
  }, [setPage])

  // Session expired handling
  useEffect(() => {
    const onExpired = () => {
      showToast('Session expired — please sign in again.', 'error')
      logout()
    }
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired)
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired)
  }, [logout, showToast])

  useEffect(() => {
    if (!supabase) {
      setChecking(false)
      setAuthed(false)
      setSettingsReady(true)
      setPage('landing', { replace: true })
      return
    }

    setAccessTokenProvider(async () => tokenRef.current)

    let cancelled = false

    const bootstrap = async (session) => {
      const myId = ++bootIdRef.current

      const token = session?.access_token || null
      tokenRef.current = token

      // No token = public
      if (!token) {
        bootTokenRef.current = null
        setAuthed(false)
        setPrimaryGoal(undefined)
        setAccountsCount(undefined)
        setSettingsReady(true)
        setChecking(false)
        setPage('landing', { replace: true })
        return
      }

      // Load-once guard (skip duplicate bootstrap for same token)
      if (bootTokenRef.current === token) {
        return
      }
      bootTokenRef.current = token

      try {
        setChecking(true)
        setSettingsReady(false)

        setAuthed(true)
        setPrimaryGoal(undefined)
        setAccountsCount(undefined)

        // Parallel load (single pass)
        await Promise.allSettled([
          refreshSettings({ force: true }),
          fetchPrimaryGoal(),
          fetchAccountsCount(),
        ])
        if (cancelled || myId !== bootIdRef.current) return

        const fromPath = pageFromPath(window.location.pathname)
        const isPublic =
          fromPath === 'landing' ||
          fromPath === 'auth' ||
          fromPath === 'privacy' ||
          fromPath === 'security' ||
          fromPath === 'terms'

        const isBlocked = fromPath === 'upgrade'

        if (fromPath && !isPublic && !isBlocked) {
          setPage(fromPath, { replace: true })
        } else {
          setPage('home', { replace: true })
        }
      } catch (e) {
        console.error('Bootstrap failed:', e)
      } finally {
        if (!cancelled) setSettingsReady(true)
        if (!cancelled) setChecking(false)
      }
    }

    // Initial session check
    supabase.auth
      .getSession()
      .then(({ data }) => bootstrap(data?.session || null))
      .catch(() => {
        if (cancelled) return
        tokenRef.current = null
        bootTokenRef.current = null
        setAuthed(false)
        setSettingsReady(true)
        setChecking(false)
        setPage('landing', { replace: true })
      })

    // Auth change listener
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return
      tokenRef.current = session?.access_token || null

      // Important: if token changes, allow a new bootstrap
      if (bootTokenRef.current !== tokenRef.current) {
        // allow bootstrap to run
      }
      bootstrap(session || null)
    })

    return () => {
      cancelled = true
      data?.subscription?.unsubscribe?.()
    }
  }, [fetchAccountsCount, fetchPrimaryGoal, refreshSettings, setPage])

  // Loading gate
  if (checking || (authed && !settingsReady)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface dark:bg-surface-dark">
        <div className="flex flex-col items-center gap-6 animate-fade-in">
          <div className="font-display text-5xl sm:text-6xl tracking-[-0.04em] text-ink dark:text-white">
            Paddock<span className="text-accent">.</span>
          </div>
          <div className="paddock-loader-bar" />
          <div className="text-[11px] tracking-[0.14em] uppercase text-ink-muted/60 dark:text-white/30">
            Preparing your dashboard
          </div>
        </div>
      </div>
    )
  }

  // Onboarding signals for Home
  const onboarding = {
    goalStatus:
      primaryGoal === undefined ? 'loading' : primaryGoal === null ? 'missing' : 'set',
    accountsStatus:
      accountsCount === undefined ? 'loading' : accountsCount === 0 ? 'missing' : 'set',
    accountsCount: typeof accountsCount === 'number' ? accountsCount : 0,
    needsGoal: primaryGoal === null,
    needsAccounts: typeof accountsCount === 'number' ? accountsCount === 0 : false,
  }

  const ctx = {
    api,
    page,
    setPage,
    authed,
    username,

    settingsReady,
    setSettingsReady,

    themePref,
    setThemePreference,
    setThemePref: setThemePreference, // back-compat alias ONLY
    dark,

    baseCurrency,
    setBaseCurrency,

    isPro,
    setIsPro,
    subscriptionStatus,
    trialEnd,

    primaryGoal,
    goalLoading,
    setPrimaryGoal,
    loadPrimaryGoal: fetchPrimaryGoal,

    accountsCount,
    setAccountsCount,
    loadAccountsCount: fetchAccountsCount,

    onboarding,

    dataVersion,
    bumpData,

    toast,
    setToast,
    showToast,

    refreshSettings,
    syncBilling,

    invalidatePath, // expose for targeted invalidation if needed

    logout,
  }

  // Suspense fallback
  const PageFallback = () => (
    <div className="space-y-6 animate-fade-in">
      <div className="h-8 w-48 rounded-lg bg-ink/5 dark:bg-white/5" />
      <div className="h-40 rounded-2xl bg-ink/5 dark:bg-white/5" />
      <div className="grid grid-cols-2 gap-4">
        <div className="h-24 rounded-xl bg-ink/5 dark:bg-white/5" />
        <div className="h-24 rounded-xl bg-ink/5 dark:bg-white/5" />
      </div>
    </div>
  )

  const renderPage = () => {
    if (!authed) {
      if (page === 'privacy') return <Privacy />
      if (page === 'security') return <Security />
      if (page === 'terms') return <Terms />
      if (page === 'auth') return <AuthPage />
      return <Landing />
    }

    switch (page) {
      case 'privacy':
        return <Privacy />
      case 'security':
        return <Security />
      case 'terms':
        return <Terms />
      case 'home':
        return <Home />
      case 'outlook':
        return <Outlook />
      case 'insights':
        return <Insights />
      case 'accounts':
        return <Accounts />
      case 'settings':
        return <Settings />
      case 'goal_setup':
        return (
          <GoalSetup
            onComplete={(goal) => {
              setPrimaryGoal(goal || null)
              setPage('accounts')
            }}
          />
        )
      case 'upgrade':
        return <Upgrade />
      case 'admin':
        return <Admin />
      default:
        return <Home />
    }
  }

  // Page transition wrapper (keep; it’s premium)
  const PageTransition = ({ children }) => (
    <div key={page} className="animate-page-in">
      {children}
    </div>
  )

  return (
    <ErrorBoundary>
      <AppContext.Provider value={ctx}>
        <div className="min-h-screen bg-surface dark:bg-surface-dark text-ink dark:text-white">
          {authed ? (
            <div className="flex min-h-screen">
              <Sidebar />
              <div className="flex-1 min-w-0">
                <MobileNav />
                <main className="px-4 sm:px-6 lg:px-8 py-6 pb-[calc(7rem+env(safe-area-inset-bottom))] lg:pb-6">
                  <div className="mx-auto w-full max-w-6xl">
                    <PageTransition>
                      <Suspense fallback={<PageFallback />}>
                        {renderPage()}
                      </Suspense>
                    </PageTransition>
                  </div>
                </main>
                <BottomNav />
              </div>
            </div>
          ) : (
            <main className="px-0">{renderPage()}</main>
          )}

          <Toast toast={toast} onClose={() => setToast(null)} />
        </div>
      </AppContext.Provider>
    </ErrorBoundary>
  )
}