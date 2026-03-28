import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Check, X as XIcon } from 'lucide-react'
import {
  supabase,
  setAuthPersistenceMode,
  getAuthPersistenceMode,
} from '../supabase'
import UpgradeButton from './UpgradeButton'
import Card from './Card'

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

function GoogleMark(props) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path
        fill="#4285F4"
        d="M21.805 12.227c0-.682-.061-1.338-.175-1.969H12v3.726h5.5a4.703 4.703 0 0 1-2.04 3.087v2.565h3.3c1.93-1.777 3.045-4.4 3.045-7.409Z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.7 0 4.965-.896 6.62-2.424l-3.3-2.565c-.915.614-2.086.977-3.32.977-2.553 0-4.717-1.724-5.49-4.04H3.1v2.64A9.997 9.997 0 0 0 12 22Z"
      />
      <path
        fill="#FBBC05"
        d="M6.51 13.948A5.99 5.99 0 0 1 6.203 12c0-.677.116-1.334.307-1.948V7.412H3.1A9.997 9.997 0 0 0 2 12c0 1.61.384 3.135 1.1 4.588l3.41-2.64Z"
      />
      <path
        fill="#EA4335"
        d="M12 6.012c1.468 0 2.786.505 3.823 1.498l2.868-2.868C16.96 3.03 14.696 2 12 2A9.997 9.997 0 0 0 3.1 7.412l3.41 2.64c.773-2.317 2.937-4.04 5.49-4.04Z"
      />
    </svg>
  )
}

export default function AuthModal({
  open,
  onClose,
  initial = 'register',
  forceMode = null,
}) {
  const panelRef = useRef(null)
  const firstFieldRef = useRef(null)

  const [mode, setMode] = useState(initial)
  const [recovery, setRecovery] = useState(forceMode === 'recovery')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [sharedComputer, setSharedComputer] = useState(
    () => getAuthPersistenceMode() === 'session'
  )

  const [newPassword, setNewPasswordValue] = useState('')
  const [confirmPassword, setConfirmPasswordValue] = useState('')

  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setMode(initial)
    setRecovery(forceMode === 'recovery')
    setSharedComputer(getAuthPersistenceMode() === 'session')
    setNotice('')
    setError('')
    setLoading(false)
    requestAnimationFrame(() => firstFieldRef.current?.focus?.())
  }, [open, initial, forceMode])

  const close = () => {
    if (loading) return
    onClose?.()
  }

  useEffect(() => {
    if (!open) return

    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKeyDown = (e) => {
      if (e.key === 'Escape') close()

      if (e.key === 'Tab') {
        const root = panelRef.current
        if (!root) return
        const focusables = root.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
        if (!focusables.length) return

        const first = focusables[0]
        const last = focusables[focusables.length - 1]

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open, loading])

  useEffect(() => {
    if (!open) return
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

        if (!cancelled) requestAnimationFrame(() => firstFieldRef.current?.focus?.())
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
  }, [open])

  const canAuth = useMemo(() => {
    const clean = email.trim()
    if (!clean || !clean.includes('@') || loading) return false
    if (mode === 'login') return password.length > 0
    return isStrongPassword(password)
  }, [email, password, loading, mode])

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
  }

  const submitAuth = async () => {
    setError('')
    setNotice('')

    if (!supabase) {
      setError('Auth is not configured. Check VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY.')
      return
    }

    const clean = email.trim()

    if (!clean || !password) {
      setError('Enter your email and password.')
      return
    }

    if (mode === 'register' && !isStrongPassword(password)) {
      setError('Use at least 8 characters, including uppercase and lowercase letters and a number.')
      return
    }

    setLoading(true)

    try {
      prepareSessionStorageMode()

      if (mode === 'register') {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: clean,
          password,
        })

        if (signUpError) {
          const msg = String(signUpError.message || '').toLowerCase()
          if (msg.includes('already registered') || msg.includes('already exists')) {
            setMode('login')
            setError('Account already exists — please sign in.')
            return
          }
          throw signUpError
        }

        if (data?.session) {
          close()
          return
        }

        setMode('login')
        setNotice('Check your email to confirm your account, then sign in.')
        return
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: clean,
        password,
      })
      if (signInError) throw signInError

      close()
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

  const handleGoogleSignIn = async () => {
    setError('')
    setNotice('')

    if (!supabase) {
      setError('Auth is not configured. Check your env vars.')
      return
    }

    try {
      setLoading(true)

      // Keep the chosen persistence mode, but do not clear auth storage before OAuth.
      setAuthPersistenceMode(sharedComputer ? 'session' : 'persistent')

      const redirectTo = `${window.location.origin}/auth/callback`

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo },
      })

      if (error) throw error
    } catch (e) {
      setError(mapAuthErrorMessage(e?.message, 'Could not continue with Google.'))
      setLoading(false)
    }
  }

  const sendResetEmail = async () => {
    setError('')
    setNotice('')

    const clean = email.trim()
    if (!clean) {
      setNotice('Enter your email first, then select “Forgot password?”.')
      return
    }

    if (!supabase) {
      setError('Auth is not configured. Check your env vars.')
      return
    }

    setLoading(true)
    try {
      const redirectTo = `${window.location.origin}/auth?mode=recovery`
      const { error } = await supabase.auth.resetPasswordForEmail(clean, { redirectTo })
      if (error) throw error
      setNotice('Password reset email sent. Check your inbox and spam folder.')
    } catch (e) {
      setError(mapAuthErrorMessage(e?.message, 'Could not send password reset email.'))
    } finally {
      setLoading(false)
    }
  }

  const submitNewPassword = async () => {
    setError('')
    setNotice('')

    if (!supabase) {
      setError('Auth is not configured. Check your env vars.')
      return
    }

    if (!isStrongPassword(newPassword)) {
      setError('Use at least 8 characters, including uppercase and lowercase letters and a number.')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    try {
      const { data: sess } = await supabase.auth.getSession()
      if (!sess?.session) {
        throw new Error('Reset session missing. Please reopen the reset link or request a new one.')
      }

      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error

      setRecovery(false)
      setNewPasswordValue('')
      setConfirmPasswordValue('')
      try {
        window.history.replaceState({}, '', window.location.pathname)
      } catch {}

      setMode('login')
      setNotice('Password updated. Please sign in.')
    } catch (e) {
      setError(mapAuthErrorMessage(e?.message, 'Could not update password.'))
    } finally {
      setLoading(false)
    }
  }

  const inp =
    'w-full h-11 px-4 rounded-2xl border border-black/[.08] dark:border-white/[.10] ' +
    'bg-white/80 dark:bg-white/[.06] text-ink dark:text-white text-sm ' +
    'placeholder:text-ink-muted/45 dark:placeholder:text-white/25 ' +
    'focus:outline-none focus:ring-4 focus:ring-accent/15 focus:border-accent/60 transition-all'

  const tabBtn = (active) =>
    [
      'pb-3.5 px-5 text-sm font-semibold border-b-2 -mb-px min-h-[44px] transition-colors',
      active
        ? 'text-ink dark:text-white border-ink dark:border-accent'
        : 'text-ink-muted dark:text-white/35 border-transparent hover:text-ink dark:hover:text-white/60',
    ].join(' ')

  if (!open) return null

  const googleBtn =
  'w-full h-11 rounded-2xl border border-black/[.10] dark:border-white/[.10] ' +
  'bg-white dark:bg-white text-[#1f1f1f] dark:text-[#1f1f1f] ' +
  'hover:bg-[#f8f9fa] dark:hover:bg-[#f1f3f4] ' +
  'active:bg-[#eef1f3] transition-colors ' +
  'flex items-center justify-center gap-3 text-sm font-medium ' +
  'shadow-[0_1px_2px_rgba(0,0,0,0.04)]'

  return (
    <div className="fixed inset-0 z-[1000]" aria-modal="true" role="dialog" aria-label="Sign in">
      <div
        className="absolute inset-0 bg-black/35 dark:bg-black/55 backdrop-blur-sm animate-[fadeIn_.18s_ease-out]"
        onMouseDown={close}
      />

      <div className="absolute inset-0 flex items-center justify-center p-4 sm:p-6">
        <div
          ref={panelRef}
          onMouseDown={(e) => e.stopPropagation()}
          className="w-full max-w-[520px] animate-[modalIn_.22s_cubic-bezier(.2,.8,.2,1)]"
        >
          <Card className="p-0 overflow-hidden bg-white/90 dark:bg-surface-dark-2 border border-black/[.08] dark:border-white/[.10] shadow-[0_24px_60px_rgba(0,0,0,.18)]">
            <div className="px-6 sm:px-7 py-5 border-b border-black/[.06] dark:border-white/[.07] flex items-center justify-between">
              <div className="min-w-0">
                <div className="font-display text-xl text-ink dark:text-white tracking-tight">
                  Paddock<span className="text-accent">.</span>
                </div>
                <div className="text-xs text-ink-muted/60 dark:text-white/25 mt-1">
                  Net worth and long-term projections
                </div>
              </div>

              <button
                type="button"
                onClick={close}
                className="h-10 w-10 rounded-2xl border border-black/[.08] dark:border-white/[.10]
                           hover:bg-black/[.03] dark:hover:bg-white/[.06] transition-colors
                           grid place-items-center"
                aria-label="Close"
              >
                <XIcon size={16} className="opacity-80" />
              </button>
            </div>

            <div className="p-6 sm:p-7">
              {!recovery ? (
                <>
                  <div className="flex border-b border-black/[.06] dark:border-white/[.07] mb-6">
                    <button
                      type="button"
                      className={tabBtn(mode === 'login')}
                      onClick={() => {
                        setMode('login')
                        setError('')
                        setNotice('')
                      }}
                    >
                      Sign in
                    </button>
                    <button
                      type="button"
                      className={tabBtn(mode === 'register')}
                      onClick={() => {
                        setMode('register')
                        setError('')
                        setNotice('')
                      }}
                    >
                      Create account
                    </button>
                  </div>

                  {notice && !error && (
                    <div className="text-sm text-ink bg-black/[.03] dark:bg-white/[.06] px-4 py-3 rounded-2xl mb-4 animate-[fadeIn_.18s_ease-out]">
                      {notice}
                    </div>
                  )}

                  {error && (
                    <div className="text-sm text-danger bg-danger-light dark:bg-danger/10 px-4 py-3 rounded-2xl mb-4 animate-[fadeIn_.18s_ease-out]">
                      {error}
                    </div>
                  )}

<div className="space-y-4">
                    <div className="space-y-3">
                      <button
                        type="button"
                        onClick={handleGoogleSignIn}
                        disabled={loading}
                        className={googleBtn}
                      >
                        <GoogleMark className="h-[18px] w-[18px] shrink-0" />
                        <span>{mode === 'login' ? 'Sign in with Google' : 'Continue with Google'}</span>
                      </button>

                      <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                          <div className="w-full border-t border-black/[.06] dark:border-white/[.07]" />
                        </div>
                        <div className="relative flex justify-center">
                          <span className="px-3 bg-white/90 dark:bg-surface-dark-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted/55 dark:text-white/28">
                            Or continue with email
                          </span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="text-xs font-semibold text-ink-3 dark:text-white/50 mb-2">
                        Email
                      </div>
                      <input
                        ref={firstFieldRef}
                        className={inp}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        type="email"
                        autoComplete="email"
                        onKeyDown={(e) => e.key === 'Enter' && submitAuth()}
                      />
                    </div>

                    <div>
                      <div className="text-xs font-semibold text-ink-3 dark:text-white/50 mb-2">
                        Password
                      </div>

                      <input
                        className={inp}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={mode === 'login' ? 'Enter your password' : 'Create a strong password'}
                        type="password"
                        autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                        onKeyDown={(e) => e.key === 'Enter' && submitAuth()}
                      />

                      {mode !== 'login' ? (
                        <>
                          <p className="mt-2 text-[12px] leading-relaxed text-ink-3/70 dark:text-white/40">
                            Use a strong password to protect your account.
                          </p>
                          <PasswordChecklist value={password} />
                        </>
                      ) : null}
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
                      onClick={submitAuth}
                      disabled={!canAuth}
                      className="w-full min-h-[48px]"
                      size="md"
                      variant="primary"
                    >
                      {loading ? '…' : mode === 'login' ? 'Sign in' : 'Create account'}
                    </UpgradeButton>

                    {mode === 'login' && (
                      <button
                        type="button"
                        onClick={sendResetEmail}
                        disabled={loading}
                        className="w-full text-xs font-semibold text-ink-muted dark:text-white/35 hover:text-ink dark:hover:text-white/60 transition-colors"
                      >
                        Forgot password?
                      </button>
                    )}

                    {mode === 'register' && (
                      <div className="text-[11px] text-ink-muted/55 dark:text-white/20 leading-relaxed text-center">
                        No ads. No tracking cookies. Cancel anytime if you upgrade.
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="mb-5">
                    <div className="text-sm font-semibold text-ink dark:text-white">Reset password</div>
                    <div className="text-xs text-ink-muted/60 dark:text-white/30 mt-1">
                      Choose a strong new password for your account.
                    </div>
                  </div>

                  {notice && !error && (
                    <div className="text-sm text-ink bg-black/[.03] dark:bg-white/[.06] px-4 py-3 rounded-2xl mb-4 animate-[fadeIn_.18s_ease-out]">
                      {notice}
                    </div>
                  )}

                  {error && (
                    <div className="text-sm text-danger bg-danger-light dark:bg-danger/10 px-4 py-3 rounded-2xl mb-4 animate-[fadeIn_.18s_ease-out]">
                      {error}
                    </div>
                  )}

                  <div className="space-y-4">
                    <div>
                      <div className="text-xs font-semibold text-ink-3 dark:text-white/50 mb-2">
                        New password
                      </div>
                      <input
                        ref={firstFieldRef}
                        className={inp}
                        value={newPassword}
                        onChange={(e) => setNewPasswordValue(e.target.value)}
                        placeholder="Create a strong password"
                        type="password"
                        autoComplete="new-password"
                        onKeyDown={(e) => e.key === 'Enter' && submitNewPassword()}
                      />

                      <PasswordChecklist value={newPassword} />
                    </div>

                    <div>
                      <div className="text-xs font-semibold text-ink-3 dark:text-white/50 mb-2">
                        Confirm password
                      </div>
                      <input
                        className={inp}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPasswordValue(e.target.value)}
                        placeholder="Repeat password"
                        type="password"
                        autoComplete="new-password"
                        onKeyDown={(e) => e.key === 'Enter' && submitNewPassword()}
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
                      onClick={submitNewPassword}
                      disabled={!canSetPassword}
                      className="w-full min-h-[48px]"
                      size="md"
                      variant="primary"
                    >
                      {loading ? '…' : 'Set new password'}
                    </UpgradeButton>

                    <button
                      type="button"
                      onClick={() => {
                        if (loading) return
                        setRecovery(false)
                        setNewPasswordValue('')
                        setConfirmPasswordValue('')
                        setError('')
                        setNotice('')
                        try {
                          window.history.replaceState({}, '', window.location.pathname)
                        } catch {}
                      }}
                      className="w-full text-xs font-semibold text-ink-muted dark:text-white/35 hover:text-ink dark:hover:text-white/60 transition-colors"
                    >
                      Back to sign in
                    </button>
                  </div>
                </>
              )}
            </div>
          </Card>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes modalIn {
          from { opacity: 0; transform: translateY(10px) scale(.985); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  )
}