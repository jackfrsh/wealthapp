import React, { useState, useRef, useEffect } from 'react'
import { supabase } from '../supabase'
import UpgradeButton from '../components/UpgradeButton'
import { useApp } from '../App'
import { Shield, Globe, BarChart2, ChevronDown, Crown, Lock } from 'lucide-react'

const FEATURES = [
  {
    icon: BarChart2,
    title: 'Net worth dashboard',
    desc: 'See accounts, assets, and liabilities in one calm, consistent view.',
  },
  {
    icon: BarChart2,
    title: 'Long-term projections',
    desc: 'Model your outlook across 5, 10, and 30 years with clear assumptions.',
  },
  {
    icon: Globe,
    title: 'Multi-currency tracking',
    desc: 'Track GBP, USD, EUR and more with automatic conversion.',
  },
  {
    icon: Shield,
    title: 'Private by design',
    desc: 'No ads. No trackers. Built for calm financial planning.',
  },
]

function parseRecoveryFromHash() {
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
  const { showToast, setPage } = useApp()

  const [mode, setMode] = useState('login') // 'login' | 'register'
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  const [recovery, setRecovery] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(false)

  const formRef = useRef(null)

  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    requestAnimationFrame(() => setMounted(true))
  }, [])

  const scrollToForm = () => {
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  useEffect(() => {
    if (!supabase) return

    let cancelled = false

    const run = async () => {
      try {
        const url = new URL(window.location.href)
        const code = url.searchParams.get('code')
        const implicit = parseRecoveryFromHash()
        const modeParam = url.searchParams.get('mode')

        if (!code && !implicit && modeParam !== 'recovery') return

        setRecovery(true)
        setMode('login')
        setError('')
        setNotice('')

        if (code) {
          const { error: exErr } = await supabase.auth.exchangeCodeForSession(
            window.location.href
          )
          if (exErr) throw exErr

          url.searchParams.delete('code')
          url.searchParams.set('mode', 'recovery')
          window.history.replaceState({}, '', url.pathname + '?' + url.searchParams.toString())
        }

        if (implicit) {
          const { error: sessErr } = await supabase.auth.setSession(implicit)
          if (sessErr) throw sessErr

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
      setError('Please enter your email and password.')
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

        showToast?.('Account created.', 'success')

        // If confirmations are off, you might have a session immediately.
        if (data?.session) {
          const token = data.session.access_token
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
      setError(e?.message || 'Sign in failed.')
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
      if (!supabase) throw new Error('Supabase is not configured. Check your env vars.')

      // IMPORTANT: match your /auth route
      const redirectTo = `${window.location.origin}/auth?mode=recovery`
      const { error } = await supabase.auth.resetPasswordForEmail(emailToUse, {
        redirectTo,
      })
      if (error) throw error

      setNotice('Password reset email sent. Check your inbox (and spam).')
      showToast?.('Password reset email sent.', 'success')
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
      if (!supabase) throw new Error('Supabase is not configured. Check your env vars.')

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
      showToast?.('Password updated.', 'success')
    } catch (e) {
      setError(e?.message || 'Could not update password.')
    } finally {
      setLoading(false)
    }
  }

  const inp =
    'w-full px-4 py-3.5 rounded-2xl border border-black/[.08] dark:border-white/[.08] ' +
    'bg-white dark:bg-surface-dark-2 text-ink dark:text-white text-base ' +
    'focus:outline-none focus:ring-4 focus:ring-accent/15 focus:border-accent/60 ' +
    'transition-all duration-180 ease-smooth'

  const lbl =
    'block text-xs font-semibold text-ink-3 dark:text-white/50 mb-2 tracking-[0.02em]'

  return (
    <div className="min-h-screen bg-surface dark:bg-surface-dark overflow-x-hidden">
      {/* Ambient background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-18%] right-[-10%] w-[560px] h-[560px] bg-accent/[.05] dark:bg-accent/[.08] rounded-full blur-[160px]" />
        <div className="absolute bottom-[-16%] left-[-14%] w-[520px] h-[520px] bg-accent/[.025] dark:bg-accent/[.05] rounded-full blur-[180px]" />
      </div>

      <div className="relative min-h-screen flex flex-col">
        {/* Top bar */}
        <header className="relative z-10 flex items-center justify-between px-6 sm:px-10 py-5">
          <button
            type="button"
            onClick={() => setPage?.('landing')}
            className="font-display text-2xl text-ink dark:text-white tracking-tighterish"
          >
            Paddock<span className="text-accent">.</span>
          </button>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setPage?.('privacy')}
              className="hidden sm:inline text-sm font-semibold text-ink-muted dark:text-white/40 hover:text-ink dark:hover:text-white/70 transition-colors"
              type="button"
            >
              Privacy
            </button>

            <button
              onClick={scrollToForm}
              className="text-sm font-semibold text-ink dark:text-white hover:text-accent dark:hover:text-accent transition-colors"
              type="button"
            >
              {recovery ? 'Reset' : 'Jump to form'}
            </button>
          </div>
        </header>

        {/* Hero */}
        <div className="relative flex-1 flex items-center justify-center px-5 pb-16 sm:pb-20">
          <div className="w-full max-w-[1080px] grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left */}
            <div
              className={`space-y-6 transition-all duration-700 ${
                mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
              }`}
            >
              <h1 className="font-display text-[2.75rem] sm:text-[3.5rem] lg:text-[4rem] leading-[1.05] text-ink dark:text-white tracking-tighterish">
                A private <span className="text-accent">net worth tracker</span>.
              </h1>

              <p className="text-lg sm:text-xl text-ink-muted dark:text-white/45 leading-relaxed max-w-[520px]">
                Track net worth, understand monthly change, and plan with long-term projections —
                without ads or noise.
              </p>

              <div className="flex flex-wrap items-center gap-4 pt-2">
                <UpgradeButton
                  onClick={scrollToForm}
                  className="min-h-[52px] px-7"
                  size="md"
                  variant="primary"
                  disabled={loading}
                >
                  Create free account
                </UpgradeButton>

                <span className="text-sm text-ink-muted/60 dark:text-white/25">
                  No card required
                </span>
              </div>

              <div className="flex items-center gap-5 pt-4 text-xs text-ink-muted/50 dark:text-white/20">
                <span className="flex items-center gap-1.5">
                  <Lock size={13} /> Secure sign-in
                </span>
                <span className="flex items-center gap-1.5">
                  <Globe size={13} /> Multi-currency
                </span>
                <span className="flex items-center gap-1.5">
                  <Shield size={13} /> Private by design
                </span>
              </div>
            </div>

            {/* Right — form */}
            <div
              ref={formRef}
              className={`transition-all duration-700 delay-150 ${
                mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
              }`}
            >
              <div className="bg-white dark:bg-surface-dark-2 rounded-3xl shadow-card-lg border border-black/[.05] dark:border-white/[.07] p-7 sm:p-9 max-w-[440px] mx-auto lg:mx-0 lg:ml-auto">
                {!recovery && (
                  <div className="flex border-b border-black/[.06] dark:border-white/[.07] mb-7">
                    {['login', 'register'].map((m) => (
                      <button
                        key={m}
                        type="button"
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

                {!recovery ? (
                  <>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault()
                        submit()
                      }}
                      className="space-y-5"
                      autoComplete={mode === 'login' ? 'on' : 'off'}
                    >
                      <div>
                        <label className={lbl}>Email address</label>
                        <input
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          className={inp}
                          placeholder="you@example.com"
                          autoComplete="email"
                          type="email"
                          name="email"
                          enterKeyHint="next"
                        />
                      </div>

                      <div>
                        <label className={lbl}>Password</label>
                        <input
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className={inp}
                          placeholder="••••••••"
                          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                          name="password"
                          enterKeyHint="go"
                        />
                      </div>

                      <UpgradeButton
                        type="submit"
                        disabled={loading}
                        className="w-full min-h-[52px]"
                        size="md"
                        variant="primary"
                      >
                        {loading ? '…' : mode === 'login' ? 'Sign in' : 'Create account'}
                      </UpgradeButton>

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
                    </form>

                    {mode === 'register' && (
                      <p className="text-xs text-ink-muted/50 dark:text-white/20 text-center mt-4 leading-relaxed">
                        By creating an account, you agree to our{' '}
                        <button
                          type="button"
                          onClick={() => setPage('terms')}
                          className="text-accent hover:underline font-medium"
                        >
                          Terms of Service
                        </button>.
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault()
                        handleSetNewPassword()
                      }}
                      className="space-y-5"
                    >
                      <div>
                        <label className={lbl}>New password</label>
                        <input
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className={inp}
                          placeholder="At least 8 characters"
                          autoComplete="new-password"
                          name="new-password"
                          enterKeyHint="next"
                        />
                      </div>

                      <div>
                        <label className={lbl}>Confirm password</label>
                        <input
                          type="password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className={inp}
                          placeholder="Repeat password"
                          autoComplete="new-password"
                          name="confirm-password"
                          enterKeyHint="go"
                        />
                      </div>

                      <UpgradeButton
                        type="submit"
                        disabled={loading}
                        className="w-full min-h-[52px]"
                        size="md"
                        variant="primary"
                      >
                        {loading ? '…' : 'Set new password'}
                      </UpgradeButton>

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
                    </form>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Scroll hint */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 opacity-70">
          <ChevronDown size={20} className="text-ink-muted/30 dark:text-white/15" />
        </div>
      </div>

      {/* Features */}
      <section className="relative py-20 sm:py-28 px-5 border-t border-black/[.04] dark:border-white/[.04]">
        <div className="max-w-[1080px] mx-auto">
          <div className="text-center mb-14 sm:mb-20">
            <h2 className="font-display text-3xl sm:text-4xl text-ink dark:text-white tracking-tighterish">
              Replace spreadsheets with clarity
            </h2>
            <p className="text-base sm:text-lg text-ink-muted dark:text-white/40 mt-3 max-w-[560px] mx-auto">
              A calm wealth dashboard for net worth tracking, monthly progress, and long-term planning.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {FEATURES.map((f, i) => {
              const Icon = f.icon
              return (
                <div
                  key={i}
                  className="group relative bg-white dark:bg-surface-dark-2 rounded-3xl border border-black/[.05] dark:border-white/[.07] p-7 sm:p-8 shadow-card hover:shadow-card-hover transition-all duration-280 ease-smooth"
                >
                  <div className="w-11 h-11 rounded-2xl bg-accent/10 dark:bg-accent/10 flex items-center justify-center mb-5 transition-transform duration-220 ease-smooth group-hover:translate-y-[-1px]">
                    <Icon size={20} className="text-accent" />
                  </div>
                  <h3 className="text-base font-semibold tracking-tightish text-ink dark:text-white mb-2">
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

      {/* Pro teaser */}
      <section className="relative py-16 sm:py-24 px-5 border-t border-black/[.04] dark:border-white/[.04]">
        <div className="max-w-[640px] mx-auto">
          <div className="bg-white dark:bg-surface-dark-2 rounded-3xl border border-black/[.06] dark:border-white/[.08] shadow-card p-8 sm:p-10 text-center relative overflow-hidden">
            <div className="absolute top-[-12px] right-[-10px] opacity-[.03] pointer-events-none">
              <Crown size={160} className="text-ink dark:text-white" />
            </div>

            <div className="relative">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-black/[.03] dark:bg-white/[.06] border border-black/[.06] dark:border-white/[.10] mb-5">
                <Crown size={14} className="opacity-80 text-ink dark:text-white" />
                <span className="text-sm font-semibold tracking-tightish text-ink dark:text-white">
                  Paddock Pro
                </span>
              </div>

              <h3 className="font-display text-2xl sm:text-3xl text-ink dark:text-white tracking-tighterish mb-3">
                Deeper modelling. Longer horizons.
              </h3>
              <p className="text-sm text-ink-muted dark:text-white/40 leading-relaxed mb-6 max-w-[460px] mx-auto">
                Unlimited accounts, extended projections, and advanced planning tools — when you’re ready.
              </p>

              <UpgradeButton
                onClick={() => {
                  try { localStorage.setItem('upgrade_reason', 'auth_pro_teaser') } catch {}
                  setPage?.('upgrade')
                }}
                size="md"
                variant="pro"
              >
                Explore Pro
              </UpgradeButton>
            </div>
          </div>
        </div>
      </section>

      <footer className="relative py-10 px-5 border-t border-black/[.04] dark:border-white/[.04]">
        <div className="max-w-[1080px] mx-auto flex items-center justify-between">
          <button
            type="button"
            onClick={() => setPage?.('landing')}
            className="font-display text-lg text-ink dark:text-white tracking-tightish"
          >
            Paddock<span className="text-accent">.</span>
          </button>

          <div className="flex items-center gap-5 text-xs text-ink-muted/40 dark:text-white/15">
            <button type="button" onClick={() => setPage?.('terms')} className="hover:text-ink dark:hover:text-white/50 transition-colors">
              Terms
            </button>
            <button type="button" onClick={() => setPage?.('privacy')} className="hover:text-ink dark:hover:text-white/50 transition-colors">
              Privacy
            </button>
            <button type="button" onClick={() => setPage?.('security')} className="hover:text-ink dark:hover:text-white/50 transition-colors">
              Security
            </button>
          </div>
        </div>
      </footer>
    </div>
  )
}