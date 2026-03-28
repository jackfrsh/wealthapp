import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  createContext,
  useContext,
  Suspense,
  useTransition,
} from 'react'

import { supabase, clearStoredAuthSession } from './supabase'
import {
  api,
  setAccessTokenProvider,
  setApiCacheScope,
  SESSION_EXPIRED_EVENT,
  invalidateCache,
  invalidatePath,
} from './api'

import Landing from './pages/Landing'
import AuthPage from './pages/Auth'
import Privacy from './pages/Privacy'
import Security from './pages/Security'
import Terms from './pages/Terms'

// ✅ Eager-load core authed pages (instant navigation, no suspense blank)
import Home from './pages/Home'
import Plan from './pages/Plan'
import Decisions from './pages/Decisions'
import Accounts from './pages/Accounts'
import Settings from './pages/Settings'
const GoalSetup = React.lazy(() => import('./pages/GoalSetup'))
import Upgrade from './pages/Upgrade'

// 💤 Keep rarely-visited pages lazy
const Insights = React.lazy(() => import('./pages/Insights'))
const Admin = React.lazy(() => import('./pages/Admin'))

import Toast from './components/Toast'
import Sidebar from './components/Sidebar'
import MobileNav from './components/MobileNav'
import BottomNav from './components/BottomNav'
import MultiCurrencyGuide from './pages/guides/MultiCurrency'
import LongTermProjectionGuide from './pages/guides/LongTermProjection'
import InflationAdjustedGuide from './pages/guides/InflationAdjusted'
import GuideIndex from './pages/guides/GuideIndex'
import NetWorthTracker from './pages/guides/NetWorthTracker'
import TrackISAsPensionsSavings from './pages/guides/TrackISAsPensionsSavings'
import SpreadsheetAlternative from './pages/guides/SpreadsheetAlternative'
import HowToTrackNetWorth from './pages/guides/HowToTrackNetWorth'
import AuthCallbackPage from './pages/AuthCallbackPage'

/* ────────────────────────────────────────────
   Error Boundary — catches render crashes
──────────────────────────────────────────── */
class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    try {
      console.error('ErrorBoundary caught:', error)
      console.error('Component stack:', info?.componentStack)
    } catch {}

    const msg = String(error?.message || '')
    const isChunkError =
      msg.includes('Failed to fetch dynamically imported module') ||
      msg.includes('Importing a module script failed') ||
      msg.includes('Loading chunk') ||
      msg.includes('ChunkLoadError')

    if (isChunkError) {
      try {
        const reloadKey = 'paddock:chunk-reload-once'
        const alreadyReloaded = sessionStorage.getItem(reloadKey) === '1'

        if (!alreadyReloaded) {
          sessionStorage.setItem(reloadKey, '1')
          window.location.reload()
          return
        }
      } catch {}
    }
  }

  render() {
    if (this.state.hasError) {
      const msg = String(this.state.error?.message || '')
      const isChunkError =
        msg.includes('Failed to fetch dynamically imported module') ||
        msg.includes('Importing a module script failed') ||
        msg.includes('Loading chunk') ||
        msg.includes('ChunkLoadError')

      return (
        <div className="min-h-screen flex items-center justify-center bg-surface dark:bg-[#0F141F] px-7">
          <div className="text-center max-w-md space-y-4">
            <div className="font-display text-3xl text-ink dark:text-white">
              {isChunkError ? 'Paddock has been updated' : 'Something went wrong'}
            </div>

            <p className="text-sm text-ink-muted dark:text-white/60">
              {isChunkError
                ? 'Please refresh to load the latest version and continue.'
                : 'An unexpected error occurred. Please refresh the page to continue.'}
            </p>

            {!isChunkError && this.state.error ? (
              <pre className="mt-3 text-left text-xs bg-black/5 dark:bg-white/5 p-3 rounded-xl overflow-auto max-h-[40vh]">
                {String(this.state.error?.stack || this.state.error?.message || this.state.error)}
              </pre>
            ) : null}

            <button
              onClick={() => {
                try {
                  sessionStorage.removeItem('paddock:chunk-reload-once')
                } catch {}
                window.location.reload()
              }}
              className="mt-4 px-5 py-2.5 rounded-xl bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors"
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
  'auth-callback': '/auth/callback',
  privacy: '/privacy',
  security: '/security',
  terms: '/terms',
  upgrade: '/upgrade',
  settings: '/settings',
  accounts: '/accounts',
  plan: '/plan',
  decisions: '/decisions',
  insights: '/insights',
  goal_setup: '/goal_setup',
  admin: '/admin',
  home: '/home',
  guide_multi_currency: '/guides/multi-currency-net-worth-tracker',
  guide_long_term_projection: '/guides/long-term-wealth-projection',
  guide_inflation_adjusted: '/guides/inflation-adjusted-net-worth',
  guides_index: '/guides',
  net_worth_tracker: '/net-worth-tracker',
  track_isas_pensions_savings: '/track-isas-pensions-savings',
  spreadsheet_alternative: '/spreadsheet-alternative-net-worth-tracking',
  how_to_track_net_worth: '/how-to-track-your-net-worth',
}

function pageFromPath(pathname) {
  const p = (pathname || '').toLowerCase()

  if (p === '/' || p === '') return 'landing'
  if (p.startsWith('/auth/callback')) return 'auth-callback'
  if (p.startsWith('/auth')) return 'auth'
  if (p.startsWith('/privacy')) return 'privacy'
  if (p.startsWith('/security')) return 'security'
  if (p.startsWith('/terms')) return 'terms'

  if (p.startsWith('/guides/multi-currency-net-worth-tracker')) return 'guide_multi_currency'
  if (p.startsWith('/guides/long-term-wealth-projection')) return 'guide_long_term_projection'
  if (p.startsWith('/guides/inflation-adjusted-net-worth')) return 'guide_inflation_adjusted'
  if (p === '/guides' || p === '/guides/') return 'guides_index'
  if (p.startsWith('/net-worth-tracker')) return 'net_worth_tracker'
  if (p.startsWith('/track-isas-pensions-savings')) return 'track_isas_pensions_savings'
  if (p.startsWith('/spreadsheet-alternative-net-worth-tracking')) return 'spreadsheet_alternative'
  if (p.startsWith('/how-to-track-your-net-worth')) return 'how_to_track_net_worth'

  if (p.startsWith('/upgrade')) return 'upgrade'
  if (p.startsWith('/settings')) return 'settings'
  if (p.startsWith('/accounts')) return 'accounts'
  if (p.startsWith('/plan') || p.startsWith('/outlook')) return 'plan'
  if (p.startsWith('/decisions') || p.startsWith('/strategy')) return 'decisions'
  if (p.startsWith('/insights')) return 'insights'
  if (p.startsWith('/goal_setup')) return 'goal_setup'
  if (p.startsWith('/admin')) return 'admin'
  if (p.startsWith('/home')) return 'home'

  return null
}

export default function App() {
  const [page, _setPage] = useState('landing')
  useEffect(() => {
    if (import.meta.env.DEV) console.log('Current page:', page)
  }, [page])

  const [authed, setAuthed] = useState(false)
  const [checking, setChecking] = useState(true)
  const [settingsReady, setSettingsReady] = useState(true)

  const [username, setUsername] = useState('')

  // Dark mode only — light mode is not yet supported.
  // Force dark regardless of OS preference or any stored setting.
  const resolveTheme = () => true

  const applyThemeToDom = () => {
    document.documentElement.classList.add('dark')
  }

  const [themePref, _setThemePref] = useState('dark')

  const [isNavPending, startNavTransition] = useTransition()

  const setThemePreference = useCallback(() => {}, [])

  useEffect(() => {
    applyThemeToDom()
  }, [])

  const [baseCurrency, setBaseCurrency] = useState('GBP')
  const [isPro, setIsPro] = useState(false)
  const [subscriptionStatus, setSubscriptionStatus] = useState(null)
  const [trialEnd, setTrialEnd] = useState(null)

  const [toast, setToast] = useState(null)
  const showToast = useCallback((message, kind = 'success') => {
    setToast({ id: Date.now() + Math.random(), kind, message })
  }, [])

  const [primaryGoal, setPrimaryGoal] = useState(undefined)
  const [goalLoading, setGoalLoading] = useState(false)
  const [accountsCount, setAccountsCount] = useState(undefined)

  const [dataVersion, setDataVersion] = useState(0)
  const bumpData = useCallback(() => {
    invalidateCache()
    setDataVersion((v) => v + 1)
  }, [])

  const dark = resolveTheme(themePref)

  const setPage = useCallback(
    (next, { replace = false } = {}) => {
      const n = next || 'landing'
      startNavTransition(() => _setPage(n))
      try {
        const path = PAGE_TO_PATH[n] || '/'
        const current = window.location.pathname || '/'
        if (current !== path) {
          if (replace) window.history.replaceState({}, '', path)
          else window.history.pushState({}, '', path)
        }
      } catch {}
    },
    [startNavTransition]
  )

  const navigateTo = useCallback(
    (path) => {
      const next = pageFromPath(path) || 'landing'
      setPage(next)
    },
    [setPage]
  )

  useEffect(() => {
    const initialRaw = pageFromPath(window.location.pathname)
    const initial = initialRaw || 'landing'
    startNavTransition(() => _setPage(initial))

    try {
      const path = PAGE_TO_PATH[initial] || '/'
      const search = window.location.search || ''
      if (window.location.pathname !== path) {
        window.history.replaceState({}, '', `${path}${search}`)
      }
    } catch {}

    const onPop = () => {
      const pRaw = pageFromPath(window.location.pathname)
      const p = pRaw || (authed ? 'home' : 'landing')
      startNavTransition(() => _setPage(p))
    }

    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [authed, startNavTransition])

  const PAGE_TITLES = {
    landing: 'Paddock — Private Net Worth Tracker & Wealth Dashboard',
    auth: 'Sign in — Paddock',
    home: 'Home — Paddock',
    plan: 'Plan — Paddock',
    decisions: 'Decisions — Paddock',
    insights: 'Insights — Paddock',
    accounts: 'Accounts — Paddock',
    settings: 'Settings — Paddock',
    upgrade: 'Upgrade — Paddock',
    goal_setup: 'Set your goal — Paddock',
    privacy: 'Privacy — Paddock',
    security: 'Security — Paddock',
    terms: 'Terms of Service — Paddock',
    guide_multi_currency: 'Multi-Currency Net Worth Tracking — Paddock',
    guide_long_term_projection: 'Long-Term Wealth Projections — Paddock',
    guide_inflation_adjusted: 'Inflation-Adjusted Net Worth — Paddock',
    guides_index: 'Guides — Paddock',
    net_worth_tracker: 'Net Worth Tracker — Paddock',
    track_isas_pensions_savings: 'Track ISAs, Pensions and Savings — Paddock',
    spreadsheet_alternative: 'Spreadsheet Alternative for Net Worth Tracking — Paddock',
    how_to_track_net_worth: 'How to Track Your Net Worth — Paddock',
    admin: 'Admin — Paddock',
  }
  useEffect(() => {
    document.title = PAGE_TITLES[page] || 'Paddock'
  }, [page])

  // Entitlements refresh
  const entitlementsCheckedAtRef = useRef(0)
  const refreshSettings = useCallback(async ({ force = false } = {}) => {
    const now = Date.now()
    const STALE_MS = 60_000
    if (!force && entitlementsCheckedAtRef.current && now - entitlementsCheckedAtRef.current < STALE_MS) {
      return null
    }
    entitlementsCheckedAtRef.current = now

    try {
      const s = await api('/settings')
      setBaseCurrency((s?.base_currency || 'GBP').toUpperCase())
      setIsPro(!!s?.is_pro)
      setSubscriptionStatus(s?.subscription_status || null)
      setTrialEnd(s?.trial_end || null)
      return s
    } catch {
      return null
    }
  }, [])

  const fetchPrimaryGoal = useCallback(async () => {
    setGoalLoading(true)
    try {
      const g = await api('/goals/primary')
      const looksLikeGoal =
        g && typeof g === 'object' && !Array.isArray(g) && (g.id != null || g.goal_id != null)

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
  }, [])

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

  useEffect(() => {
    if (!authed) return
  
    let running = false
  
    const run = async () => {
      if (running) return
      running = true
      try {
        await syncBilling()
      } finally {
        running = false
      }
    }
  
    const onFocus = () => {
      run()
    }
  
    const onVisibility = () => {
      if (document.visibilityState === 'visible') run()
    }
  
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibility)
  
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [authed, syncBilling])

  // Auth bootstrap
  const bootIdRef = useRef(0)
  const tokenRef = useRef(null)
  const bootTokenRef = useRef(null)
  const currentUserIdRef = useRef(null)

  const resetUserScopedState = useCallback(() => {
    entitlementsCheckedAtRef.current = 0
    invalidateCache()

    setUsername('')
    setBaseCurrency('GBP')
    setIsPro(false)
    setSubscriptionStatus(null)
    setTrialEnd(null)

    setPrimaryGoal(undefined)
    setAccountsCount(undefined)
  }, [])

  const logout = useCallback(async () => {
    try {
      await supabase?.auth?.signOut?.({ scope: 'local' })
    } catch {}
  
    try {
      clearStoredAuthSession()
    } catch {}
  
    bootTokenRef.current = null
    tokenRef.current = null
    currentUserIdRef.current = null
    setApiCacheScope('anon')
  
    resetUserScopedState()
  
    setAuthed(false)
    setSettingsReady(true)
    setChecking(false)
  
    try {
      localStorage.removeItem('force_pro')
      localStorage.removeItem('upgrade_reason')
    } catch {}

    // Clear user-specific sessionStorage caches to prevent cross-user data flash
    try {
      sessionStorage.removeItem('wealthapp:dash:3M:v1')
    } catch {}
  
    setPage('landing', { replace: true })
  }, [resetUserScopedState, setPage])

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
      setApiCacheScope('anon')
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
      const nextUserId = session?.user?.id || null
      tokenRef.current = token

      if (!token || !nextUserId) {
        bootTokenRef.current = null
        currentUserIdRef.current = null
        setApiCacheScope('anon')

        resetUserScopedState()
        setAuthed(false)
        setSettingsReady(true)
        setChecking(false)

        const fromPath = pageFromPath(window.location.pathname)
        const publicPage =
        fromPath === 'auth' ||
        fromPath === 'auth-callback' ||
        fromPath === 'privacy' ||
        fromPath === 'security' ||
        fromPath === 'terms' ||
        fromPath === 'guides_index' ||
        fromPath === 'guide_multi_currency' ||
        fromPath === 'guide_long_term_projection' ||
        fromPath === 'guide_inflation_adjusted' ||
        fromPath === 'net_worth_tracker' ||
        fromPath === 'track_isas_pensions_savings' ||
        fromPath === 'spreadsheet_alternative' ||
        fromPath === 'how_to_track_net_worth'
            ? fromPath
            : 'landing'

        setPage(publicPage, { replace: true })
        return
      }

      setApiCacheScope(nextUserId)

      const identityChanged = currentUserIdRef.current !== nextUserId

      if (identityChanged) {
        currentUserIdRef.current = nextUserId
        bootTokenRef.current = null
        resetUserScopedState()
      }

      if (bootTokenRef.current === token && !identityChanged) return
      bootTokenRef.current = token

      try {
        setChecking(true)
        setSettingsReady(false)
        setAuthed(true)

        await Promise.allSettled([
          syncBilling(),
          fetchPrimaryGoal(),
          fetchAccountsCount(),
        ])

        if (cancelled || myId !== bootIdRef.current) return

        const fromPath = pageFromPath(window.location.pathname)
        const resolvedFromPath = fromPath || 'home'

        const isPublic =
          resolvedFromPath === 'landing' ||
          resolvedFromPath === 'auth' ||
          resolvedFromPath === 'privacy' ||
          resolvedFromPath === 'security' ||
          resolvedFromPath === 'terms' ||
          resolvedFromPath === 'guide_multi_currency' ||
          resolvedFromPath === 'guide_long_term_projection' ||
          resolvedFromPath === 'guide_inflation_adjusted' ||
          resolvedFromPath === 'net_worth_tracker' ||
          resolvedFromPath === 'track_isas_pensions_savings' ||
          resolvedFromPath === 'spreadsheet_alternative' ||
          resolvedFromPath === 'how_to_track_net_worth'

        const isBlocked = resolvedFromPath === 'upgrade'

        if (resolvedFromPath && !isPublic && !isBlocked) {
          setPage(resolvedFromPath, { replace: true })
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

    supabase.auth
      .getSession()
      .then(({ data }) => bootstrap(data?.session || null))
      .catch(() => {
        if (cancelled) return

        tokenRef.current = null
        bootTokenRef.current = null
        currentUserIdRef.current = null
        setApiCacheScope('anon')

        resetUserScopedState()
        setAuthed(false)
        setSettingsReady(true)
        setChecking(false)

        const fromPath = pageFromPath(window.location.pathname)
        const publicPage =
        fromPath === 'auth' ||
        fromPath === 'privacy' ||
        fromPath === 'security' ||
        fromPath === 'terms' ||
        fromPath === 'guides_index' ||
        fromPath === 'guide_multi_currency' ||
        fromPath === 'guide_long_term_projection' ||
        fromPath === 'guide_inflation_adjusted' ||
        fromPath === 'net_worth_tracker' ||
        fromPath === 'track_isas_pensions_savings' ||
        fromPath === 'spreadsheet_alternative' ||
        fromPath === 'how_to_track_net_worth'
            ? fromPath
            : 'landing'

        setPage(publicPage, { replace: true })
      })

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return
      tokenRef.current = session?.access_token || null
      bootstrap(session || null)
    })

    return () => {
      cancelled = true
      data?.subscription?.unsubscribe?.()
    }
  }, [fetchAccountsCount, fetchPrimaryGoal, refreshSettings, syncBilling, showToast, logout, setPage, resetUserScopedState])

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

  const onboarding = {
    goalStatus: primaryGoal === undefined ? 'loading' : primaryGoal === null ? 'missing' : 'set',
    accountsStatus: accountsCount === undefined ? 'loading' : accountsCount === 0 ? 'missing' : 'set',
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
    setThemePref: setThemePreference,
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

    invalidatePath,

    logout,
  }

  // Small inline skeleton used ONLY for lazy rare pages
  const LazyFallback = () => (
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
      if (page === 'privacy') return <Privacy navigateTo={navigateTo} />
      if (page === 'security') return <Security navigateTo={navigateTo} />
      if (page === 'terms') return <Terms navigateTo={navigateTo} />
      if (page === 'auth') return <AuthPage />
      if (page === 'auth-callback') return <AuthCallbackPage />
      if (page === 'decisions') return <Decisions />
      if (page === 'guides_index') return <GuideIndex navigateTo={navigateTo} />
      if (page === 'guide_multi_currency') return <MultiCurrencyGuide />
      if (page === 'guide_long_term_projection') return <LongTermProjectionGuide />
      if (page === 'guide_inflation_adjusted') return <InflationAdjustedGuide />
      if (page === 'net_worth_tracker') return <NetWorthTracker navigateTo={navigateTo} />
      if (page === 'track_isas_pensions_savings') return <TrackISAsPensionsSavings navigateTo={navigateTo} />
      if (page === 'spreadsheet_alternative') return <SpreadsheetAlternative navigateTo={navigateTo} />
      if (page === 'how_to_track_net_worth') return <HowToTrackNetWorth navigateTo={navigateTo} />
      return <Landing />
    }

    switch (page) {
      case 'privacy':
        return <Privacy navigateTo={navigateTo} />
      case 'security':
        return <Security navigateTo={navigateTo} />
      case 'terms':
        return <Terms navigateTo={navigateTo} />
    
      case 'guides_index':
        return <GuideIndex navigateTo={navigateTo} />
      case 'guide_multi_currency':
        return <MultiCurrencyGuide />
      case 'guide_long_term_projection':
        return <LongTermProjectionGuide />
      case 'guide_inflation_adjusted':
        return <InflationAdjustedGuide />
    
      case 'net_worth_tracker':
        return <NetWorthTracker navigateTo={navigateTo} />
      case 'track_isas_pensions_savings':
        return <TrackISAsPensionsSavings navigateTo={navigateTo} />
      case 'spreadsheet_alternative':
        return <SpreadsheetAlternative navigateTo={navigateTo} />
      case 'how_to_track_net_worth':
        return <HowToTrackNetWorth navigateTo={navigateTo} />
    
      case 'home':
        return <Home />
      case 'plan':
        return <Plan />
      case 'accounts':
        return <Accounts />
      case 'upgrade':
        return <Upgrade />
      case 'decisions':
        return <Decisions />
      case 'settings':
        return <Settings />
      case 'goal_setup':
        return (
          <Suspense fallback={<LazyFallback />}>
            <GoalSetup
              onComplete={(goal) => {
                setPrimaryGoal(goal || null)
                setPage('home', { replace: true })
              }}
            />
          </Suspense>
        )
    
      case 'insights':
        return (
          <Suspense fallback={<LazyFallback />}>
            <Insights />
          </Suspense>
        )
      case 'admin':
        return (
          <Suspense fallback={<LazyFallback />}>
            <Admin />
          </Suspense>
        )
    
      default:
        return <Home />
    }
  }

  return (
    <ErrorBoundary>
      <AppContext.Provider value={ctx}>
      <div className="min-h-screen bg-surface dark:bg-[#0F141F] text-ink dark:text-white">
          {authed ? (
            <div className="flex min-h-screen">
              <Sidebar />
              <div className="flex-1 min-w-0">
                <MobileNav />
                <main className="px-4 sm:px-6 lg:px-8 py-7 pb-[calc(7rem+env(safe-area-inset-bottom))] lg:pb-8">
                  <div className="mx-auto w-full max-w-6xl">
                    <div className="animate-page-in">
                      {isNavPending ? (
                        <div className="fixed top-4 right-4 z-[950] text-[11px] font-semibold px-3 py-1.5 rounded-2xl bg-black/80 text-white">
                          Loading…
                        </div>
                      ) : null}
                      {renderPage()}
                    </div>
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