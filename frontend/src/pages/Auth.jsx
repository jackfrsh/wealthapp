import React, { useState, useRef, useEffect } from 'react'
import UpgradeButton from '../components/UpgradeButton'
import { supabase } from '../supabaseClient'
import { useApp } from '../App'
import {
  TrendingUp,
  Shield,
  Globe,
  BarChart2,
  Sparkles,
  ChevronDown,
  Crown,
  Lock,
  Trash2,
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
    desc: 'Compound modelling per account. See where your money will be in 5, 10, or 30 years.',
  },
  {
    icon: Globe,
    title: 'Multi-Currency',
    desc: 'Automatic FX conversion across GBP, USD, EUR, crypto and more. Live rates, daily cache.',
  },
  {
    icon: Shield,
    title: 'Goal Planning',
    desc: 'Set a target, track milestones, and get strategic insights to stay on course.',
  },
]

export default function AuthPage({ onLogin, onBack }) {
  const { showToast, setPage } = useApp()

  const [mode, setMode] = useState('login') // 'login' | 'register'
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  // Recovery mode (password reset)
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

  // Detect recovery mode via hash
  useEffect(() => {
    const hash = window.location.hash || ''
    if (hash.includes('recovery')) {
      setRecovery(true)
      setMode('login')
      setError('')
      setNotice('')
      requestAnimationFrame(() => scrollToForm())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const submit = async () => {
    const email = (username || '').trim()

    try {
      setLoading(true)
      setError('')
      setNotice('')

      if (!supabase) {
        throw new Error('Auth is not configured (missing Supabase env vars).')
      }

      if (!email) throw new Error('Please enter your email.')
      if (!password) throw new Error('Please enter your password.')

      if (mode === 'register') {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        })

        if (signUpError) {
          const msg = String(signUpError.message || '').toLowerCase()
          if (msg.includes('already registered')) {
            setMode('login')
            setNotice('Account already exists — please sign in.')
            return
          }
          throw signUpError
        }

        if (data?.session) {
          onLogin(email)
          return
        }

        setNotice('Check your email to confirm your account, then sign in.')
        showToast?.('Check your email to confirm your account.')
        setMode('login')
        return
      }

      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (signInError) throw signInError

      onLogin(data?.user?.email || email)
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
        throw new Error('Auth is not configured (missing Supabase env vars).')
      }

      // SPA: keep it simple; hash-based recovery works anywhere
      const redirectTo = `${window.location.origin}/#recovery`
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
        throw new Error('Auth is not configured (missing Supabase env vars).')
      }

      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error

      setRecovery(false)
      setNewPassword('')
      setConfirmPassword('')
      window.history.replaceState(null, '', window.location.pathname)

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

  const setModeSafe = (m) => {
    setMode(m)
    setError('')
    setNotice('')
  }

  return (
    <div className="min-h-screen bg-surface dark:bg-surface-dark overflow-x-hidden">
      {/* ─── Ambient background ─── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-15%] right-[-5%] w-[500px] h-[500px] bg-accent/[.04] dark:bg-accent/[.07] rounded-full blur-[140px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[400px] h-[400px] bg-amber-500/[.03] dark:bg-amber-500/[.05] rounded-full blur-[120px]" />
        <div className="absolute top-[40%] left-[30%] w-[300px] h-[300px] bg-white/[.02] dark:bg-white/[.03] rounded-full blur-[100px]" />
      </div>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* HERO — above the fold                                  */}
      {/* ═══════════════════════════════════════════════════════ */}
      <div className="relative min-h-screen flex flex-col">
        {/* Sticky nav bar */}
        <header className="relative z-10 flex items-center justify-between px-6 sm:px-10 py-5">
          <button
            onClick={onBack}
            className="font-display text-2xl text-ink dark:text-white tracking-tight font-semibold hover:opacity-70 transition-opacity"
          >
            [Brand]<span className="text-accent">.</span>
          </button>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setPage?.('privacy')}
              className="hidden sm:inline text-sm font-medium text-ink-muted/70 hover:text-ink dark:text-white/35 dark:hover:text-white/60 transition-colors"
              type="button"
            >
              Privacy
            </button>
            <button
              onClick={() => setPage?.('security')}
              className="hidden sm:inline text-sm font-medium text-ink-muted/70 hover:text-ink dark:text-white/35 dark:hover:text-white/60 transition-colors"
              type="button"
            >
              Security
            </button>
            <button
              onClick={() => {
                setRecovery(false)
                setModeSafe('login')
                scrollToForm()
              }}
              className="text-sm font-medium text-ink dark:text-white hover:text-accent dark:hover:text-accent transition-colors"
              type="button"
            >
              Sign in
            </button>
          </div>
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
              <h1 className="font-display text-[2.75rem] sm:text-[3.5rem] lg:text-[4rem] leading-[1.05] text-ink dark:text-white tracking-tight font-semibold">
                Build serious wealth.
                <span className="block text-ink-muted/70 dark:text-white/45 text-[2.35rem] sm:text-[3rem] lg:text-[3.5rem]">
                  With clarity.
                </span>
              </h1>

              <p className="text-lg sm:text-xl text-ink-muted dark:text-white/45 leading-relaxed max-w-[520px]">
                A private dashboard for tracking your net worth, measuring monthly progress, and
                staying on course toward your long-term goals.
              </p>

              <div className="flex flex-wrap items-center gap-4 pt-2">
                <button
                  onClick={() => {
                    setModeSafe('register')
                    scrollToForm()
                  }}
                  className="text-base font-medium px-7 py-3.5 rounded-2xl bg-accent text-white hover:bg-accent-dark transition-all active:scale-[.97] min-h-[52px]"
                  type="button"
                >
                  Start building
                </button>
                <span className="text-sm text-ink-muted/60 dark:text-white/25">
                  No credit card required
                </span>
              </div>

              {/* Trust markers (keep claims conservative) */}
              <div className="flex flex-wrap items-center gap-5 pt-4 text-xs text-ink-muted/50 dark:text-white/20">
                <span className="flex items-center gap-1.5">
                  <Lock size={13} /> Encrypted in transit
                </span>
                <span className="flex items-center gap-1.5">
                  <Trash2 size={13} /> Delete your account anytime
                </span>
                <span className="flex items-center gap-1.5">
                  <Globe size={13} /> Multi-currency
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
                {/* Tabs (hidden during recovery) */}
                {!recovery && (
                  <div className="flex border-b border-black/[.06] dark:border-white/[.06] mb-7">
                    {['login', 'register'].map((m) => (
                      <button
                        key={m}
                        onClick={() => setModeSafe(m)}
                        className={`pb-3.5 px-5 text-sm font-semibold border-b-2 transition-colors -mb-px min-h-[44px] ${
                          mode === m
                            ? 'text-ink dark:text-white border-ink dark:border-white'
                            : 'text-ink-muted dark:text-white/35 border-transparent hover:text-ink dark:hover:text-white/60'
                        }`}
                        type="button"
                      >
                        {m === 'login' ? 'Sign in' : 'Create account'}
                      </button>
                    ))}
                  </div>
                )}

                {notice && (
                  <div className="text-sm text-ink dark:text-white bg-black/[.03] dark:bg-white/[.06] px-4 py-3 rounded-2xl mb-5 animate-fade-in">
                    {notice}
                  </div>
                )}

                {error && (
                  <div className="text-sm text-danger bg-danger-light dark:bg-danger/10 px-4 py-3 rounded-2xl mb-5 animate-fade-in">
                    {error}
                  </div>
                )}

                {/* Forms */}
                {recovery ? (
                  <div className="space-y-5">
                    <div>
                      <label className={lbl}>New password</label>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => {
                          setNewPassword(e.target.value)
                          if (error) setError('')
                          if (notice) setNotice('')
                        }}
                        onKeyDown={(e) => e.key === 'Enter' && handleSetNewPassword()}
                        className={inp}
                        placeholder="••••••••"
                        autoComplete="new-password"
                      />
                    </div>

                    <div>
                      <label className={lbl}>Confirm new password</label>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => {
                          setConfirmPassword(e.target.value)
                          if (error) setError('')
                          if (notice) setNotice('')
                        }}
                        onKeyDown={(e) => e.key === 'Enter' && handleSetNewPassword()}
                        className={inp}
                        placeholder="••••••••"
                        autoComplete="new-password"
                      />
                    </div>

                    <button
                      onClick={handleSetNewPassword}
                      disabled={loading}
                      className="w-full py-3.5 rounded-2xl bg-accent text-white font-medium text-base transition-all hover:bg-accent-dark active:scale-[.98] disabled:opacity-50 min-h-[52px]"
                      type="button"
                    >
                      {loading ? '...' : 'Update password'}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setRecovery(false)
                        setNewPassword('')
                        setConfirmPassword('')
                        setError('')
                        setNotice('')
                        window.history.replaceState(null, '', window.location.pathname)
                        setModeSafe('login')
                      }}
                      className="w-full py-3 rounded-2xl text-sm font-semibold text-ink-muted hover:text-ink dark:text-white/40 dark:hover:text-white/70 transition-colors"
                    >
                      Back to sign in
                    </button>
                  </div>
                ) : (
                  <div className="space-y-5">
                    <div>
                      <label className={lbl}>Email address</label>
                      <input
                        value={username}
                        onChange={(e) => {
                          setUsername(e.target.value)
                          if (error) setError('')
                          if (notice) setNotice('')
                        }}
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
                        onChange={(e) => {
                          setPassword(e.target.value)
                          if (error) setError('')
                          if (notice) setNotice('')
                        }}
                        onKeyDown={(e) => e.key === 'Enter' && submit()}
                        className={inp}
                        placeholder="••••••••"
                        autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                      />

                      {/* Forgot password link — directly under password (clean mobile UX) */}
                      {mode === 'login' && (
                        <div className="flex justify-end mt-2">
                          <button
                            type="button"
                            onClick={handleResetPassword}
                            disabled={loading || !(username || '').trim()}
                            className="text-xs font-semibold text-ink-muted hover:text-ink dark:text-white/40 dark:hover:text-white/70 transition-colors disabled:opacity-40"
                          >
                            Forgot password?
                          </button>
                        </div>
                      )}
                    </div>

                    <button
                      onClick={submit}
                      disabled={loading}
                      className="w-full py-3.5 rounded-2xl bg-accent text-white font-medium text-base transition-all hover:bg-accent-dark active:scale-[.98] disabled:opacity-50 min-h-[52px]"
                      type="button"
                    >
                      {loading ? '...' : mode === 'login' ? 'Sign in' : 'Create account'}
                    </button>

                    <div className="text-xs text-ink-muted/55 dark:text-white/25">
                      No ads. No budgeting. No noise.
                    </div>
                  </div>
                )}
                {/* End forms */}
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
                  <h3 className="text-base font-semibold text-ink dark:text-white mb-2">
                    {f.title}
                  </h3>
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
            crypto alongside your savings — this gives you the clarity to make confident decisions
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
                <span className="text-sm font-medium text-amber-700 dark:text-amber-300">
                  Pro
                </span>
              </div>

              <h3 className="font-display text-2xl sm:text-3xl text-ink dark:text-white tracking-tight mb-3">
                Unlock the full picture
              </h3>
              <p className="text-sm text-ink-muted dark:text-white/40 leading-relaxed mb-6 max-w-[440px] mx-auto">
                Unlimited accounts, full-timeline projections, advanced insights, and strategic
                planning tools — from £6/month.
              </p>

              <UpgradeButton onClick={() => setModeSafe('register') || scrollToForm()} size="sm">
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
        <div className="max-w-[1080px] mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="font-display text-lg text-ink dark:text-white tracking-tight font-semibold">
            [Brand]<span className="text-accent">.</span>
          </div>

          <div className="flex items-center gap-5 text-xs text-ink-muted/50 dark:text-white/20">
            <button
              type="button"
              onClick={() => setPage?.('privacy')}
              className="hover:text-ink dark:hover:text-white/50 transition-colors"
            >
              Privacy
            </button>
            <button
              type="button"
              onClick={() => setPage?.('security')}
              className="hover:text-ink dark:hover:text-white/50 transition-colors"
            >
              Security
            </button>
            <span className="hidden sm:inline">Built for clarity.</span>
          </div>
        </div>
      </footer>
    </div>
  )
}