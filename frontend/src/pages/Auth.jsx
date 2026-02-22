import React, { useState, useRef, useEffect } from 'react'
import { supabase } from '../supabaseClient' // <-- adjust to '../supabase' if that's your actual file
import UpgradeButton from '../components/UpgradeButton'
import { useApp } from '../App'
import {
  TrendingUp,
  Shield,
  Globe,
  BarChart2,
  Sparkles,
  ChevronDown,
  Crown,
} from 'lucide-react'

const FEATURES = [
  {
    icon: TrendingUp,
    title: 'Net Worth Tracking',
    desc: 'Aggregate every account — ISAs, pensions, crypto, property — into one clear number.',
  },
  {
    icon: BarChart2,
    title: 'Growth Projections',
    desc: 'Compound interest modelling per account. See where your money will be in 5, 10, or 30 years.',
  },
  {
    icon: Globe,
    title: 'Multi-Currency',
    desc: 'Automatic FX conversion across GBP, USD, EUR, crypto and more. Live rates, daily cache.',
  },
  {
    icon: Shield,
    title: 'Goal Planning',
    desc: 'Set a retirement target, track milestones, and get strategic insights to stay on course.',
  },
]

function parseRecoveryFromHash() {
  // Supabase implicit recovery link format:
  // #access_token=...&refresh_token=...&type=recovery
  const raw = window.location.hash || ''
  const h = raw.startsWith('#') ? raw.slice(1) : raw
  const hp = new URLSearchParams(h)
  const type = hp.get('type')
  const access_token = hp.get('access_token')
  const refresh_token = hp.get('refresh_token')
  if (type === 'recovery' && access_token && refresh_token) {
    return { access_token, refresh_token }
  }
  return null
}

export default function AuthPage({ onLogin }) {
  const { showToast } = useApp()

  const [mode, setMode] = useState('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  // Recovery mode
  const [recovery, setRecovery] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(false)

  const formRef = useRef(null)

  // Stagger animation on mount
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    requestAnimationFrame(() => setMounted(true))
  }, [])

  const scrollToForm = () => {
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  /**
   * CRITICAL: If reset link is opened in a different browser (Safari) than the one
   * where user requested it (Chrome), we must establish a Supabase session in THIS tab
   * using the recovery token from the URL.
   */
  useEffect(() => {
    if (!supabase) return

    let cancelled = false

    const run = async () => {
      try {
        const url = new URL(window.location.href)
        const code = url.searchParams.get('code') // PKCE flow
        const implicit = parseRecoveryFromHash() // implicit flow
        const modeParam = url.searchParams.get('mode') // persistence flag

        if (!code && !implicit && modeParam !== 'recovery') return

        // Show recovery UI
        setRecovery(true)
        setMode('login')
        setError('')
        setNotice('')

        // 1) PKCE: exchange code for session
        if (code) {
          const { error: exErr } = await supabase.auth.exchangeCodeForSession(
            window.location.href
          )
          if (exErr) throw exErr

          // Clean URL, keep mode=recovery
          url.searchParams.delete('code')
          url.searchParams.set('mode', 'recovery')
          window.history.replaceState({}, '', url.pathname + '?' + url.searchParams.toString())
        }

        // 2) Implicit: set session from hash tokens
        if (implicit) {
          const { error: sessErr } = await supabase.auth.setSession(implicit)
          if (sessErr) throw sessErr

          // Clean URL (remove hash), keep mode=recovery
          url.searchParams.set('mode', 'recovery')
          window.history.replaceState({}, '', url.pathname + '?' + url.searchParams.toString())
        }

        if (!cancelled) requestAnimationFrame(() => scrollToForm())
      } catch (e) {
        if (cancelled) return
        setRecovery(true)
        setMode('login')
        setError(e?.message || 'Password recovery link is invalid or expired.')
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [])

  const submit = async () => {
    setError('')
    setNotice('')

    if (!username.trim() || !password) {
      setError('Please enter your email and password')
      return
    }
    if (!supabase) {
      setError('Supabase is not configured. Check your env vars.')
      return
    }

    setLoading(true)
    try {
      const email = username.trim()

      if (mode === 'register') {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        })
        if (signUpError) throw signUpError

        showToast?.('Account created!')

        // Some setups return session immediately; others require email confirmation
        if (data?.session) {
          const token = data.session.access_token

          // Backwards compatible: if your App expects token+email
          if (typeof onLogin === 'function') {
            if (onLogin.length >= 2) onLogin(token, email)
            else onLogin(email)
          }
          return
        }

        setNotice('Check your email to confirm your account, then sign in.')
        setMode('login')
        return
      }

      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (signInError) throw signInError

      const token = data?.session?.access_token

      if (typeof onLogin === 'function') {
        if (onLogin.length >= 2) onLogin(token, email)
        else onLogin(email)
      }
    } catch (e) {
      setError(e?.message || 'Sign in failed')
    } finally {
      setLoading(false)
    }
  }

  const handleResetPassword = async () => {
    setError('')
    setNotice('')

    const emailToUse = (username || '').trim()
    if (!emailToUse) {
      setNotice('Enter your email above, then tap “Forgot password?”.')
      return
    }

    try {
      setLoading(true)

      if (!supabase) {
        throw new Error('Supabase is not configured. Check your env vars.')
      }

      // IMPORTANT: do NOT use a custom hash like /#recovery.
      // Supabase uses the hash for tokens in the implicit flow.
      // This assumes your Auth page is at the ROOT (/).
      // If your Auth route is /auth, change to `${window.location.origin}/auth?mode=recovery`
      const redirectTo = `${window.location.origin}/?mode=recovery`

      const { error } = await supabase.auth.resetPasswordForEmail(emailToUse, { redirectTo })
      if (error) throw error

      setNotice('Password reset email sent. Check your inbox (and spam).')
      showToast?.('Password reset email sent.')
    } catch (e) {
      setError(e?.message || 'Could not send password reset email.')
    } finally {
      setLoading(false)
    }
  }

  const handleSetNewPassword = async () => {
    setError('')
    setNotice('')

    if (!newPassword || newPassword.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    try {
      setLoading(true)

      if (!supabase) {
        throw new Error('Supabase is not configured. Check your env vars.')
      }

      // Friendly guard: ensure the session exists in this browser tab
      const { data: sess } = await supabase.auth.getSession()
      if (!sess?.session) {
        throw new Error('Auth session missing. Please reopen the reset link (or request a new one).')
      }

      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error

      setRecovery(false)
      setNewPassword('')
      setConfirmPassword('')
      window.history.replaceState({}, '', window.location.pathname)

      setNotice('Password updated. Please sign in.')
      showToast?.('Password updated.')
    } catch (e) {
      setError(e?.message || 'Could not update password.')
    } finally {
      setLoading(false)
    }
  }

  const inp =
    'w-full px-4 py-3.5 rounded-2xl border border-black/[.08] dark:border-white/[.08] bg-white dark:bg-surface-dark text-ink dark:text-white text-base focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all'
  const lbl = 'block text-xs font-semibold text-ink-3 dark:text-white/50 mb-2 tracking-wide'

  return (
    <div className="min-h-screen bg-surface dark:bg-surface-dark overflow-x-hidden">
      {/* ─── Ambient background ─── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-15%] right-[-5%] w-[500px] h-[500px] bg-accent/[.04] dark:bg-accent/[.07] rounded-full blur-[140px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[400px] h-[400px] bg-amber-500/[.03] dark:bg-amber-500/[.05] rounded-full blur-[120px]" />
        <div className="absolute top-[40%] left-[30%] w-[300px] h-[300px] bg-emerald-500/[.02] dark:bg-emerald-500/[.03] rounded-full blur-[100px]" />
      </div>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* HERO — above the fold                                  */}
      {/* ═══════════════════════════════════════════════════════ */}
      <div className="relative min-h-screen flex flex-col">
        {/* Sticky nav bar */}
        <header className="relative z-10 flex items-center justify-between px-6 sm:px-10 py-5">
          <div className="font-display text-2xl text-ink dark:text-white tracking-tight">
            wealth<span className="text-accent">.</span>
          </div>
          <button
            onClick={scrollToForm}
            className="text-sm font-semibold text-ink dark:text-white hover:text-accent dark:hover:text-accent transition-colors"
          >
            Sign in
          </button>
        </header>

        {/* Hero content */}
        <div className="relative flex-1 flex items-center justify-center px-5 pb-16 sm:pb-20">
          <div className="w-full max-w-[1080px] grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left — headline */}
            <div
              className={`space-y-6 transition-all duration-700 ${
                mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
              }`}
            >
              <h1 className="font-display text-[2.75rem] sm:text-[3.5rem] lg:text-[4rem] leading-[1.05] text-ink dark:text-white tracking-tight">
                Your wealth, <span className="text-accent">one clear view</span>
              </h1>

              <p className="text-lg sm:text-xl text-ink-muted dark:text-white/45 leading-relaxed max-w-[480px]">
                Track every account, project your growth, and plan your financial future — all in
                one beautifully simple app.
              </p>

              <div className="flex flex-wrap items-center gap-4 pt-2">
                <button
                  onClick={scrollToForm}
                  className="text-base font-semibold px-7 py-3.5 rounded-2xl bg-accent text-white hover:bg-accent-dark transition-all active:scale-[.97] min-h-[52px]"
                >
                  Get started free
                </button>
                <span className="text-sm text-ink-muted/60 dark:text-white/25">
                  No credit card required
                </span>
              </div>

              {/* Trust markers */}
              <div className="flex items-center gap-5 pt-4 text-xs text-ink-muted/50 dark:text-white/20">
                <span className="flex items-center gap-1.5">
                  <Shield size={13} /> Bank-level encryption
                </span>
                <span className="flex items-center gap-1.5">
                  <Globe size={13} /> 15+ currencies
                </span>
              </div>
            </div>

            {/* Right — auth form */}
            <div
              ref={formRef}
              className={`transition-all duration-700 delay-150 ${
                mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
              }`}
            >
              <div className="bg-white dark:bg-surface-dark-2 rounded-3xl shadow-card-lg border border-black/[.05] dark:border-white/[.06] p-7 sm:p-9 max-w-[440px] mx-auto lg:mx-0 lg:ml-auto">
                {/* Tabs (disabled in recovery) */}
                {!recovery && (
                  <div className="flex border-b border-black/[.06] dark:border-white/[.06] mb-7">
                    {['login', 'register'].map((m) => (
                      <button
                        key={m}
                        onClick={() => {
                          setMode(m)
                          setError('')
                          setNotice('')
                        }}
                        className={`pb-3.5 px-5 text-sm font-semibold border-b-2 transition-colors -mb-px min-h-[44px] ${
                          mode === m
                            ? 'text-ink dark:text-white border-ink dark:border-white'
                            : 'text-ink-muted dark:text-white/35 border-transparent hover:text-ink dark:hover:text-white/60'
                        }`}
                      >
                        {m === 'login' ? 'Sign in' : 'Create account'}
                      </button>
                    ))}
                  </div>
                )}

                {recovery && (
                  <div className="mb-6">
                    <div className="text-sm font-semibold text-ink dark:text-white">
                      Reset password
                    </div>
                    <div className="text-xs text-ink-muted/60 dark:text-white/30 mt-1">
                      Enter a new password for your account.
                    </div>
                  </div>
                )}

                {notice && !error && (
                  <div className="text-sm text-ink bg-black/[.03] dark:bg-white/[.06] px-4 py-3 rounded-2xl mb-5 animate-fade-in">
                    {notice}
                  </div>
                )}

                {error && (
                  <div className="text-sm text-danger bg-danger-light dark:bg-danger/10 px-4 py-3 rounded-2xl mb-5 animate-fade-in">
                    {error}
                  </div>
                )}

                {/* Normal auth */}
                {!recovery ? (
                  <>
                    <div className="space-y-5">
                      <div>
                        <label className={lbl}>Email address</label>
                        <input
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && submit()}
                          className={inp}
                          placeholder="you@example.com"
                          autoComplete="email"
                          type="email"
                        />
                      </div>
                      <div>
                        <label className={lbl}>Password</label>
                        <input
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && submit()}
                          className={inp}
                          placeholder="••••••••"
                          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                        />
                      </div>

                      <button
                        onClick={submit}
                        disabled={loading}
                        className="w-full py-3.5 rounded-2xl bg-accent text-white font-semibold text-base transition-all hover:bg-accent-dark active:scale-[.98] disabled:opacity-50 min-h-[52px]"
                      >
                        {loading ? '...' : mode === 'login' ? 'Sign in' : 'Create account'}
                      </button>

                      {/* Forgot password link (login only) */}
                      {mode === 'login' && (
                        <button
                          type="button"
                          onClick={handleResetPassword}
                          disabled={loading}
                          className="w-full text-xs font-semibold text-ink-muted dark:text-white/35 hover:text-ink dark:hover:text-white/60 transition-colors"
                        >
                          Forgot password?
                        </button>
                      )}
                    </div>

                    {mode === 'register' && (
                      <p className="text-xs text-ink-muted/50 dark:text-white/20 text-center mt-4 leading-relaxed">
                        By signing up you agree to our Terms of Service.
                      </p>
                    )}
                  </>
                ) : (
                  /* Recovery UI */
                  <>
                    <div className="space-y-5">
                      <div>
                        <label className={lbl}>New password</label>
                        <input
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleSetNewPassword()}
                          className={inp}
                          placeholder="At least 8 characters"
                          autoComplete="new-password"
                        />
                      </div>
                      <div>
                        <label className={lbl}>Confirm password</label>
                        <input
                          type="password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleSetNewPassword()}
                          className={inp}
                          placeholder="Repeat password"
                          autoComplete="new-password"
                        />
                      </div>

                      <button
                        onClick={handleSetNewPassword}
                        disabled={loading}
                        className="w-full py-3.5 rounded-2xl bg-accent text-white font-semibold text-base transition-all hover:bg-accent-dark active:scale-[.98] disabled:opacity-50 min-h-[52px]"
                      >
                        {loading ? '...' : 'Set new password'}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setRecovery(false)
                          setNewPassword('')
                          setConfirmPassword('')
                          setError('')
                          setNotice('')
                          window.history.replaceState({}, '', window.location.pathname)
                        }}
                        disabled={loading}
                        className="w-full text-xs font-semibold text-ink-muted dark:text-white/35 hover:text-ink dark:hover:text-white/60 transition-colors"
                      >
                        Back to sign in
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 animate-pulse-soft">
          <ChevronDown size={20} className="text-ink-muted/30 dark:text-white/15" />
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* FEATURES — below the fold                              */}
      {/* ═══════════════════════════════════════════════════════ */}
      <section className="relative py-20 sm:py-28 px-5">
        <div className="max-w-[1080px] mx-auto">
          <div className="text-center mb-14 sm:mb-20">
            <h2 className="font-display text-3xl sm:text-4xl text-ink dark:text-white tracking-tight">
              Everything you need to <span className="text-accent">build wealth</span>
            </h2>
            <p className="text-base sm:text-lg text-ink-muted dark:text-white/40 mt-3 max-w-[520px] mx-auto">
              One app that replaces spreadsheets, calculators, and guesswork.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {FEATURES.map((f, i) => {
              const Icon = f.icon
              return (
                <div
                  key={i}
                  className="group relative bg-white dark:bg-surface-dark-2 rounded-3xl border border-black/[.05] dark:border-white/[.06] p-7 sm:p-8 shadow-card hover:shadow-card-hover transition-all duration-300"
                >
                  <div className="w-11 h-11 rounded-2xl bg-accent/10 dark:bg-accent/10 flex items-center justify-center mb-5 group-hover:scale-105 transition-transform">
                    <Icon size={20} className="text-accent" />
                  </div>
                  <h3 className="text-base font-bold text-ink dark:text-white mb-2">{f.title}</h3>
                  <p className="text-sm text-ink-muted dark:text-white/40 leading-relaxed">
                    {f.desc}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* WHO IT'S FOR                                           */}
      {/* ═══════════════════════════════════════════════════════ */}
      <section className="relative py-16 sm:py-24 px-5 border-t border-black/[.04] dark:border-white/[.04]">
        <div className="max-w-[720px] mx-auto text-center">
          <h2 className="font-display text-2xl sm:text-3xl text-ink dark:text-white tracking-tight mb-6">
            Built for people who take their future seriously
          </h2>
          <p className="text-base text-ink-muted dark:text-white/40 leading-relaxed mb-8">
            Whether you're just starting to invest, managing multiple pensions and ISAs, or tracking
            crypto alongside your savings — Wealth gives you the clarity to make confident decisions
            about your money.
          </p>

          <div className="inline-flex flex-wrap justify-center gap-3 text-sm text-ink-muted/70 dark:text-white/30">
            {['Young professionals', 'Multiple account holders', 'Global investors', 'Retirement planners'].map(
              (tag) => (
                <span
                  key={tag}
                  className="px-4 py-2 rounded-full border border-black/[.06] dark:border-white/[.06] bg-white/60 dark:bg-white/[.03]"
                >
                  {tag}
                </span>
              )
            )}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* PRO TEASER                                             */}
      {/* ═══════════════════════════════════════════════════════ */}
      <section className="relative py-16 sm:py-24 px-5 border-t border-black/[.04] dark:border-white/[.04]">
        <div className="max-w-[640px] mx-auto">
          <div className="bg-white dark:bg-surface-dark-2 rounded-3xl border border-amber-500/15 shadow-card p-8 sm:p-10 text-center relative overflow-hidden">
            <div className="absolute top-0 right-0 w-40 h-40 opacity-[.03] pointer-events-none">
              <Crown size={160} className="text-amber-500" />
            </div>

            <div className="relative">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 mb-5">
                <Sparkles size={14} className="text-amber-500" />
                <span className="text-sm font-bold text-amber-700 dark:text-amber-300">
                  Wealth Pro
                </span>
              </div>

              <h3 className="font-display text-2xl sm:text-3xl text-ink dark:text-white tracking-tight mb-3">
                Unlock the full picture
              </h3>
              <p className="text-sm text-ink-muted dark:text-white/40 leading-relaxed mb-6 max-w-[420px] mx-auto">
                Unlimited accounts, full-timeline projections, AI-powered insights, and strategic
                planning tools — from £6/month.
              </p>

              <UpgradeButton onClick={() => { /* keep your existing handler */ }} size="sm">
                Start free, upgrade anytime
              </UpgradeButton>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* FOOTER                                                 */}
      {/* ═══════════════════════════════════════════════════════ */}
      <footer className="relative py-10 px-5 border-t border-black/[.04] dark:border-white/[.04]">
        <div className="max-w-[1080px] mx-auto flex items-center justify-between">
          <div className="font-display text-lg text-ink dark:text-white tracking-tight">
            wealth<span className="text-accent">.</span>
          </div>
          <div className="text-xs text-ink-muted/40 dark:text-white/15">Built for clarity.</div>
        </div>
      </footer>
    </div>
  )
}