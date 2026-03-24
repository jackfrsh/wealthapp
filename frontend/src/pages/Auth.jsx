import React, { useState, useRef, useEffect, useMemo } from 'react'
import {
  supabase,
  setAuthPersistenceMode,
  getAuthPersistenceMode,
  clearStoredAuthSession,
} from '../supabase'
import UpgradeButton from '../components/UpgradeButton'
import { useApp } from '../App'
import { Shield, Globe, BarChart2, Lock, Check } from 'lucide-react'

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

function getAuthModeFromUrl() {
  try {
    const params = new URLSearchParams(window.location.search)
    const mode = (params.get('mode') || '').toLowerCase()
    if (mode === 'signup' || mode === 'register') return 'register'
    return 'login'
  } catch {
    return 'login'
  }
}

function getPasswordChecks(value) {
  return {
    length: value.length >= 8,
    lower: /[a-z]/.test(value),
    upper: /[A-Z]/.test(value),
    number: /[0-9]/.test(value),
  }
}

function isStrongPassword(value) {
  const checks = getPasswordChecks(value)
  return checks.length && checks.lower && checks.upper && checks.number
}

function mapAuthErrorMessage(message, fallback = 'Could not complete sign in.') {
  const msg = String(message || '').toLowerCase()

  if (!msg) return fallback

  if (msg.includes('already registered') || msg.includes('already exists')) {
    return 'Account already exists — please sign in.'
  }

  if (msg.includes('invalid login credentials')) {
    return 'Email or password is incorrect.'
  }

  if (msg.includes('email not confirmed')) {
    return 'Please confirm your email before signing in.'
  }

  if (
    msg.includes('password should') ||
    msg.includes('password must') ||
    msg.includes('uppercase') ||
    msg.includes('lowercase')
  ) {
    return 'Use at least 8 characters, including uppercase and lowercase letters and a number.'
  }

  if (msg.includes('expired') && msg.includes('link')) {
    return 'This link has expired. Please request a new one.'
  }

  return fallback
}

function FeatureCard({ icon: Icon, title, body }) {
  return (
    <div className="rounded-3xl border border-black/[.05] dark:border-white/[.07] bg-white/72 dark:bg-white/[.04] backdrop-blur-xl p-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)] dark:shadow-none">
      <div className="w-10 h-10 rounded-2xl bg-accent/10 flex items-center justify-center mb-4">
        <Icon size={18} className="text-accent" />
      </div>
      <h3 className="text-sm font-semibold text-ink dark:text-white mb-1">{title}</h3>
      <p className="text-sm text-ink-muted dark:text-white/35 leading-relaxed">{body}</p>
    </div>
  )
}

function PasswordChecklist({ value, className = '' }) {
  const checks = getPasswordChecks(value)

  const itemClass = (ok) =>
    [
      'flex items-center gap-2 text-[12px] leading-relaxed transition-colors',
      ok ? 'text-ink dark:text-white' : 'text-ink-muted/70 dark:text-white/38',
    ].join(' ')

  const Icon = ({ ok }) =>
    ok ? (
      <Check size={13} className="shrink-0" />
    ) : (
      <div className="h-[13px] w-[13px] rounded-full border border-current/35 shrink-0" />
    )

  return (
    <div
      className={[
        'mt-3 rounded-2xl border border-black/[.06] dark:border-white/[.08] bg-black/[.02] dark:bg-white/[.04] px-3.5 py-3 space-y-2',
        className,
      ].join(' ')}
    >
      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted/55 dark:text-white/28">
        Password requirements
      </div>

      <div className={itemClass(checks.length)}>
        <Icon ok={checks.length} />
        <span>At least 8 characters</span>
      </div>

      <div className={itemClass(checks.upper)}>
        <Icon ok={checks.upper} />
        <span>One uppercase letter</span>
      </div>

      <div className={itemClass(checks.lower)}>
        <Icon ok={checks.lower} />
        <span>One lowercase letter</span>
      </div>

      <div className={itemClass(checks.number)}>
        <Icon ok={checks.number} />
        <span>One number</span>
      </div>
    </div>
  )
}

export default function AuthPage({ onLogin }) {
  const { showToast, setPage } = useApp()

  const [mode, setMode] = useState(getAuthModeFromUrl)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [sharedComputer, setSharedComputer] = useState(
    () => getAuthPersistenceMode() === 'session'
  )

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

  useEffect(() => {
    const syncModeFromUrl = () => {
      setMode(getAuthModeFromUrl())
    }

    syncModeFromUrl()
    window.addEventListener('popstate', syncModeFromUrl)
    return () => window.removeEventListener('popstate', syncModeFromUrl)
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

        if (!code && !implicit && modeParam !== 'recovery') {
          setMode(getAuthModeFromUrl())
          return
        }

        setRecovery(true)
        setMode('login')
        setError('')
        setNotice('')

        if (code) {
          const { error: exErr } = await supabase.auth.exchangeCodeForSession(window.location.href)
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
        setError(mapAuthErrorMessage(e?.message, 'Password recovery link is invalid or expired.'))
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [])

  const canSubmit = useMemo(() => {
    const email = username.trim()
    if (!email || !email.includes('@') || loading) return false
    if (mode === 'login') return password.length > 0
    return isStrongPassword(password)
  }, [username, password, loading, mode])

  const canSetPassword = useMemo(() => {
    return (
      isStrongPassword(newPassword) &&
      confirmPassword.length > 0 &&
      newPassword === confirmPassword &&
      !loading
    )
  }, [newPassword, confirmPassword, loading])

  const prepareSessionStorageMode = () => {
    const nextMode = sharedComputer ? 'session' : 'persistent'
    setAuthPersistenceMode(nextMode)
    clearStoredAuthSession()
  }

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

    const email = username.trim()

    if (mode === 'register' && !isStrongPassword(password)) {
      setError('Use at least 8 characters, including uppercase and lowercase letters and a number.')
      return
    }

    setLoading(true)
    try {
      prepareSessionStorageMode()

      if (mode === 'register') {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        })
        if (signUpError) throw signUpError

        showToast?.('Account created.', 'success')

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
        try {
          const url = new URL(window.location.href)
          url.searchParams.set('mode', 'signin')
          window.history.replaceState({}, '', `${url.pathname}?${url.searchParams.toString()}`)
        } catch {}
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
      setError(
        mapAuthErrorMessage(
          e?.message,
          mode === 'login' ? 'Could not sign in.' : 'Could not create your account.'
        )
      )
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

      const redirectTo = `${window.location.origin}/auth?mode=recovery`
      const { error } = await supabase.auth.resetPasswordForEmail(emailToUse, { redirectTo })
      if (error) throw error

      setNotice('Password reset email sent. Check your inbox and spam folder.')
      showToast?.('Password reset email sent.', 'success')
    } catch (e) {
      setError(mapAuthErrorMessage(e?.message, 'Could not send password reset email.'))
    } finally {
      setLoading(false)
    }
  }

  const handleSetNewPassword = async () => {
    setError('')
    setNotice('')

    if (!isStrongPassword(newPassword)) {
      setError('Use at least 8 characters, including uppercase and lowercase letters and a number.')
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
        throw new Error('Auth session missing. Please reopen the reset link or request a new one.')
      }

      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error

      setRecovery(false)
      setNewPassword('')
      setConfirmPassword('')
      window.history.replaceState({}, '', `${window.location.pathname}?mode=signin`)

      setNotice('Password updated. Please sign in.')
      showToast?.('Password updated.', 'success')
    } catch (e) {
      setError(mapAuthErrorMessage(e?.message, 'Could not update password.'))
    } finally {
      setLoading(false)
    }
  }

  const inp =
    'w-full px-4 py-3 sm:py-3.5 rounded-2xl border border-black/[.08] dark:border-white/[.08] ' +
    'bg-white/92 dark:bg-surface-dark-2 text-ink dark:text-white text-base ' +
    'focus:outline-none focus:ring-4 focus:ring-accent/15 focus:border-accent/60 ' +
    'transition-all duration-180 ease-smooth'

  const lbl =
    'block text-xs font-semibold text-ink-3 dark:text-white/50 mb-2 tracking-[0.02em]'

    const headline = recovery
    ? 'Reset your password.'
    : mode === 'register'
      ? 'Start planning.'
      : 'Welcome back.'
  
  const subcopy = recovery
    ? 'Choose a new password to regain access to your account.'
    : mode === 'register'
      ? 'Create your account to model ISA deadlines, long-term projections and next steps in one calm, private dashboard.'
      : 'Sign in to continue planning with clarity.'

  return (
    <div className="min-h-screen overflow-x-hidden brand-auth-bg text-ink dark:text-white">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-18%] right-[-10%] w-[560px] h-[560px] bg-accent/[.05] dark:bg-accent/[.08] rounded-full blur-[160px]" />
        <div className="absolute bottom-[-16%] left-[-14%] w-[520px] h-[520px] bg-black/[.02] dark:bg-white/[.02] rounded-full blur-[180px]" />
      </div>

      <div className="relative min-h-screen flex flex-col">
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
              {recovery ? 'Reset password' : mode === 'register' ? 'Create account' : 'Sign in'}
            </button>
          </div>
        </header>

        <div className="relative flex-1 flex items-center justify-center px-5 py-10 sm:py-16">
          <div className="w-full max-w-[1080px] grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-start lg:items-center">
            <div
              className={`space-y-6 transition-all duration-700 order-1 ${
                mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
              }`}
            >
              <p className="text-sm font-semibold tracking-[.12em] uppercase text-ink-muted/55 dark:text-white/25">
              Private wealth planning
              </p>

              <h1 className="font-display text-[2.35rem] sm:text-[3.5rem] lg:text-[4rem] font-semibold leading-[1.04] text-ink dark:text-white tracking-tighterish">
                {headline}
              </h1>

              <p className="text-lg sm:text-xl text-ink-muted dark:text-white/50 leading-relaxed max-w-[560px]">
                {subcopy}
              </p>

              {!recovery ? (
                <>
                  <div className="hidden lg:flex flex-wrap items-center gap-4 pt-2">
                    <UpgradeButton
                      onClick={scrollToForm}
                      className="min-h-[52px] px-7"
                      size="md"
                      variant="primary"
                      disabled={loading}
                    >
                      {mode === 'register' ? 'Create account' : 'Sign in securely'}
                    </UpgradeButton>

                    <span className="text-sm text-ink-muted/60 dark:text-white/25">
  Private by design • No bank linking • No card required
</span>
                  </div>

                  <div className="hidden lg:grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
                  <FeatureCard
  icon={BarChart2}
  title="Built for decisions"
  body="Model the next move with clearer projections and long-term context."
/>
<FeatureCard
  icon={Globe}
  title="Private by design"
  body="No bank linking. No ad clutter. Just a calmer way to plan wealth."
/>
                  </div>

                  <div className="hidden lg:flex items-center gap-5 pt-2 text-xs text-ink-muted/50 dark:text-white/20">
                  <span className="flex items-center gap-1.5">
  <Lock size={13} /> Secure sign-in
</span>
<span className="flex items-center gap-1.5">
  <BarChart2 size={13} /> Built for decisions
</span>
<span className="flex items-center gap-1.5">
  <Shield size={13} /> Private by design
</span>
                  </div>
                </>
              ) : null}
            </div>

            <div
              ref={formRef}
              className={`transition-all duration-700 delay-150 order-2 ${
                mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
              }`}
            >
              <div className="bg-white/88 dark:bg-surface-dark-2/92 backdrop-blur-xl rounded-[28px] sm:rounded-3xl shadow-card-lg border border-black/[.05] dark:border-white/[.07] p-5 sm:p-7 lg:p-9 max-w-[440px] mx-auto lg:mx-0 lg:ml-auto">
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

                          try {
                            const url = new URL(window.location.href)
                            url.searchParams.set('mode', m === 'register' ? 'signup' : 'signin')
                            window.history.replaceState({}, '', `${url.pathname}?${url.searchParams.toString()}`)
                          } catch {}
                        }}
                        className={`pb-3.5 px-5 text-sm font-semibold border-b-2 transition-colors -mb-px min-h-[44px] ${
                          mode === m
                            ? 'text-ink dark:text-white border-ink dark:border-accent'
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
                      Enter a strong new password for your account.
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
                          placeholder={mode === 'login' ? 'Enter your password' : 'Create a strong password'}
                          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                          name="password"
                          enterKeyHint="go"
                        />

                        {mode !== 'login' && (
                          <>
                            <p className="mt-2 text-[12px] leading-relaxed text-ink-muted/60 dark:text-white/40">
                              Use a strong password to protect your account.
                            </p>
                            <PasswordChecklist value={password} />
                          </>
                        )}
                      </div>

                      <label className="flex items-start gap-3 rounded-2xl border border-black/[.06] dark:border-white/[.08] bg-black/[.02] dark:bg-white/[.04] px-4 py-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={sharedComputer}
                          onChange={(e) => setSharedComputer(e.target.checked)}
                          className="mt-1 h-4 w-4 shrink-0 rounded border-black/20 dark:border-white/20"
                        />
                        <span className="min-w-0">
                          <span className="block text-sm font-medium text-ink dark:text-white">
                            This is a shared computer
                          </span>
                          <span className="block mt-1 text-[12px] leading-relaxed text-ink-muted/65 dark:text-white/35">
                            We’ll avoid keeping you signed in after you close the browser. For maximum safety, log out before you leave.
                          </span>
                        </span>
                      </label>

                      <UpgradeButton
                        type="submit"
                        disabled={!canSubmit}
                        className="w-full min-h-[50px] sm:min-h-[52px]"
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

                    <div className="lg:hidden pt-6 space-y-4">
                      <div className="flex items-center justify-center gap-4 text-xs text-ink-muted/55 dark:text-white/22">
                        <span className="flex items-center gap-1.5">
                          <Lock size={13} /> Secure sign-in
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Shield size={13} /> Private
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FeatureCard
  icon={BarChart2}
  title="Built for decisions"
  body="Model the next move with clearer projections and long-term context."
/>
<FeatureCard
  icon={Globe}
  title="Private by design"
  body="No bank linking. No ad clutter. Just a calmer way to plan wealth."
/>
                      </div>
                    </div>
                  </>
                ) : (
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
                        placeholder="Create a strong password"
                        autoComplete="new-password"
                        name="new-password"
                        enterKeyHint="next"
                      />

                      <PasswordChecklist value={newPassword} />
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

                      {confirmPassword.length > 0 && (
                        <div
                          className={[
                            'mt-2 text-[12px]',
                            newPassword === confirmPassword
                              ? 'text-ink dark:text-white'
                              : 'text-ink-muted/70 dark:text-white/38',
                          ].join(' ')}
                        >
                          {newPassword === confirmPassword ? 'Passwords match.' : 'Passwords must match.'}
                        </div>
                      )}
                    </div>

                    <UpgradeButton
                      type="submit"
                      disabled={!canSetPassword}
                      className="w-full min-h-[50px] sm:min-h-[52px]"
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
                        window.history.replaceState({}, '', `${window.location.pathname}?mode=signin`)
                      }}
                      disabled={loading}
                      className="w-full text-xs font-semibold text-ink-muted dark:text-white/35 hover:text-ink dark:hover:text-white/60 transition-colors"
                    >
                      Back to sign in
                    </button>
                  </form>
                )}
              </div>
            </div>

            {!recovery ? <div className="lg:hidden order-3 pt-1" /> : null}
          </div>
        </div>

        <footer className="relative py-8 px-5 border-t border-black/[.04] dark:border-white/[.04]">
          <div className="max-w-[1080px] mx-auto flex items-center justify-between">
            <button
              type="button"
              onClick={() => setPage?.('landing')}
              className="font-display text-lg text-ink dark:text-white tracking-tightish"
            >
              Paddock<span className="text-accent">.</span>
            </button>

            <div className="flex items-center gap-5 text-xs text-ink-muted/40 dark:text-white/40">
              <button
                type="button"
                onClick={() => setPage?.('terms')}
                className="hover:text-ink dark:hover:text-white/50 transition-colors"
              >
                Terms
              </button>
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
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}