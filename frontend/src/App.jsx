// frontend/src/App.jsx
import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  createContext,
  useContext,
} from 'react'

import { supabase } from './supabase'
import { api, setAccessTokenProvider, SESSION_EXPIRED_EVENT } from './api'

import Landing from './pages/Landing'
import AuthPage from './pages/Auth'
import Privacy from './pages/Privacy'
import Security from './pages/Security'

import Home from './pages/Home'
import Outlook from './pages/Outlook'
import Insights from './pages/Insights'
import Accounts from './pages/Accounts'
import Settings from './pages/Settings'
import GoalSetup from './pages/GoalSetup'
import Upgrade from './pages/Upgrade'
import Admin from './pages/Admin'

import Toast from './components/Toast'
import Sidebar from './components/Sidebar'
import MobileNav from './components/MobileNav'
import BottomNav from './components/Bottomnav'

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

  const [themePref, setThemePref] = useState('system')
  const [baseCurrency, setBaseCurrency] = useState('GBP')
  const [isPro, setIsPro] = useState(false)

  const [toast, setToast] = useState(null)
  const showToast = useCallback((message, kind = 'success') => {
    setToast({ id: Date.now() + Math.random(), kind, message })
  }, [])

  // undefined = loading/not fetched yet, null = fetched and missing, object = exists
  const [primaryGoal, setPrimaryGoal] = useState(undefined)
  const [goalLoading, setGoalLoading] = useState(false)

  const [accountsCount, setAccountsCount] = useState(undefined) // undefined loading, number once known

  const [dataVersion, setDataVersion] = useState(0)
  const bumpData = useCallback(() => setDataVersion((v) => v + 1), [])

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

  // Theme
  useEffect(() => {
    applyThemeToDom(themePref)
  }, [themePref])

  useEffect(() => {
    console.log('BOOT STATE', { checking, authed, settingsReady, primaryGoal, accountsCount })
  }, [checking, authed, settingsReady, primaryGoal, accountsCount])

  useEffect(() => {
    if (themePref !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => applyThemeToDom('system')
    handler()
    mq.addEventListener?.('change', handler)
    return () => mq.removeEventListener?.('change', handler)
  }, [themePref])

  // Entitlements refresh (rate-limited with a ref to avoid loops)
  const entitlementsCheckedAtRef = useRef(0)
  const refreshSettings = useCallback(async ({ force = false } = {}) => {
    const now = Date.now()
    const STALE_MS = 60_000
    if (
      !force &&
      entitlementsCheckedAtRef.current &&
      now - entitlementsCheckedAtRef.current < STALE_MS
    ) {
      return null
    }

    entitlementsCheckedAtRef.current = now

    try {
      const s = await api('/settings')
      setThemePref(s.theme_preference || 'system')
      setBaseCurrency(s.base_currency || 'GBP')
      setIsPro(!!s.is_pro)
      return s
    } catch {
      return null
    }
  }, [])

  /**
   * ✅ FIX: Primary goal fetch must NOT clobber a real goal on transient errors.
   * Only a genuine 404 means "no goal".
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
        // Treat weird empty shapes as missing (rare), but this was a *successful* call.
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

      // ✅ transient error: DO NOT overwrite goal state.
      // If we were still loading (undefined), keep undefined (so pages show skeleton, not "missing").
      console.error('Primary goal load failed:', e)
      setPrimaryGoal((prev) => (prev === undefined ? undefined : prev))
      return null
    } finally {
      setGoalLoading(false)
    }
  }, [])

  /**
   * ✅ Same idea: don't turn transient failures into "0 accounts".
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
  }, [])

  const syncBilling = useCallback(async () => {
    try {
      await api('/billing/sync', { method: 'POST' })
      await refreshSettings({ force: true })
      return true
    } catch {
      return false
    }
  }, [refreshSettings])

  const logout = useCallback(async () => {
    try {
      await supabase?.auth?.signOut?.()
    } catch {}

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

  // Auth bootstrap (storm-proof + cached token)
  const bootIdRef = useRef(0)
  const tokenRef = useRef(null)

  useEffect(() => {
    if (!supabase) {
      setChecking(false)
      setAuthed(false)
      setSettingsReady(true)
      setPage('landing', { replace: true })
      return
    }

    // Cached token provider: fast path uses tokenRef, fallback pulls session once on refresh races
    setAccessTokenProvider(async () => {
      if (tokenRef.current) return tokenRef.current

      try {
        const { data } = await supabase.auth.getSession()
        const t = data?.session?.access_token || null
        tokenRef.current = t
        return t
      } catch {
        return null
      }
    })

    // Prime token quickly
    supabase.auth
      .getSession()
      .then(({ data }) => {
        tokenRef.current = data?.session?.access_token || null
      })
      .catch(() => {
        tokenRef.current = null
      })

    let cancelled = false

    const bootstrap = async (session) => {
      const myId = ++bootIdRef.current

      try {
        setChecking(true)
        setSettingsReady(false)

        const token = session?.access_token || null
        tokenRef.current = token

        if (!token) {
          setAuthed(false)
          setPrimaryGoal(undefined)
          setAccountsCount(undefined)
          setSettingsReady(true)
          setPage('landing', { replace: true })
          return
        }

        setAuthed(true)

        // Mark "unknown" so pages render loading skeletons, not "missing"
        setPrimaryGoal(undefined)
        setAccountsCount(undefined)

        // Settings first
        await refreshSettings({ force: true })
        if (cancelled || myId !== bootIdRef.current) return

        // Preload goal + accounts
        await Promise.allSettled([fetchPrimaryGoal(), fetchAccountsCount()])
        if (cancelled || myId !== bootIdRef.current) return

        const fromPath = pageFromPath(window.location.pathname)
        const isPublic =
          fromPath === 'landing' ||
          fromPath === 'auth' ||
          fromPath === 'privacy' ||
          fromPath === 'security'

        if (fromPath && !isPublic) {
          setPage(fromPath, { replace: true })
          setSettingsReady(true)
          return
        }

        setPage('home', { replace: true })
        setSettingsReady(true)
      } catch (e) {
        console.error('Bootstrap failed:', e)
        setSettingsReady(true)
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
        setAuthed(false)
        setSettingsReady(true)
        setChecking(false)
        setPage('landing', { replace: true })
      })

    // Auth change listener (keeps tokenRef hot)
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return
      tokenRef.current = session?.access_token || null
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

  // Onboarding signals for Home to render a “Next steps” card under the hero number
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
    setThemePref,
    dark,

    baseCurrency,
    setBaseCurrency,

    isPro,
    setIsPro,

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

    logout,
  }

  const renderPage = () => {
    // Public pages
    if (!authed) {
      if (page === 'privacy') return <Privacy />
      if (page === 'security') return <Security />
      if (page === 'auth') return <AuthPage />
      return <Landing />
    }

    // Authed pages
    switch (page) {
      case 'privacy':
        return <Privacy />
      case 'security':
        return <Security />
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

  return (
    <AppContext.Provider value={ctx}>
      <div className="min-h-screen bg-surface dark:bg-surface-dark text-ink dark:text-white">
        {authed ? (
          <div className="flex min-h-screen">
            <Sidebar />
            <div className="flex-1 min-w-0">
              <MobileNav />
              <main className="px-4 sm:px-6 lg:px-8 py-6 pb-[calc(7rem+env(safe-area-inset-bottom))] lg:pb-6">
                <div className="mx-auto w-full max-w-6xl">{renderPage()}</div>
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
  )
}