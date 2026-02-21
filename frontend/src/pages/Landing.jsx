import React, { useMemo, useState } from 'react'
import {
  TrendingUp,
  BarChart2,
  Target,
  Shield,
  Lock,
  Trash2,
  ArrowRight,
  Banknote,
} from 'lucide-react'

import { useApp } from '../App'
import Button from '../components/Button'
import Card from '../components/Card'
import { supabase } from '../supabase'

export default function Landing() {
  const { setPage, handleLogin } = useApp()

  const [mode, setMode] = useState('signup') // 'signup' | 'signin'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const canSubmit = useMemo(() => {
    const e = email.trim()
    return e.length > 3 && e.includes('@') && password.length >= 8 && !busy
  }, [email, password, busy])

  function scrollToSignup() {
    document.getElementById('get-started')?.scrollIntoView({ behavior: 'smooth' })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)

    try {
      if (!supabase) {
        throw new Error(
          'Auth is not configured (missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).'
        )
      }

      const cleanEmail = email.trim()

      if (mode === 'signup') {
        const { error: signUpError } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
        })

        if (signUpError) {
          const msg = String(signUpError.message || '').toLowerCase()

          // Smooth UX: if already registered, switch to sign-in automatically
          if (msg.includes('already registered')) {
            setMode('signin')
            setError('Account already exists — please sign in.')
            return
          }

          throw signUpError
        }

        // If email confirmations are enabled, user must confirm.
        setMode('signin')
        setError('Check your email to confirm your account, then sign in.')
        return
      }

      // Sign in
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      })
      if (signInError) throw signInError

      // Your app uses handleLogin(email) to set authed + route
      handleLogin?.(data?.user?.email || cleanEmail)
    } catch (err) {
      setError(err?.message || 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface dark:bg-surface-dark">
      {/* Top bar */}
      <div className="mx-auto max-w-6xl px-6 pt-6">
        <div className="flex items-center justify-between">
          <div className="font-display text-xl text-ink dark:text-white tracking-tight">
            [Brand]<span className="text-accent">.</span>
          </div>

          <button
            onClick={() => {
              setError('')
              setMode((m) => (m === 'signup' ? 'signin' : 'signup'))
            }}
            className="text-sm font-medium text-ink-muted/70 hover:text-ink dark:text-white/50 dark:hover:text-white transition-colors"
          >
            {mode === 'signup' ? 'Sign in' : 'Create account'}
          </button>
        </div>
      </div>

      {/* Hero */}
      <div id="get-started" className="mx-auto max-w-6xl px-6 pt-14 pb-14">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
          {/* Left: copy + signup */}
          <div>
            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight text-ink dark:text-white">
              Build serious wealth.
              <span className="block text-ink-muted/70 dark:text-white/45 text-3xl sm:text-4xl lg:text-5xl">
                With clarity.
              </span>
            </h1>

            <p className="mt-5 text-base sm:text-lg text-ink-muted/70 dark:text-white/45 max-w-xl">
              A private dashboard for tracking your net worth, measuring monthly progress, and
              staying on course toward your long-term goals.
            </p>

            <div className="mt-8">
              <Card className="p-5">
                <form onSubmit={handleSubmit} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      type="email"
                      placeholder="Email"
                      autoComplete="email"
                      className="h-11 rounded-2xl border border-black/[.06] dark:border-white/[.06] bg-white/70 dark:bg-white/5 px-4 text-sm text-ink dark:text-white placeholder:text-ink-muted/50 dark:placeholder:text-white/25 focus:outline-none focus:ring-4 focus:ring-black/10 dark:focus:ring-white/10"
                    />
                    <input
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      type="password"
                      placeholder="Password (8+ chars)"
                      autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                      className="h-11 rounded-2xl border border-black/[.06] dark:border-white/[.06] bg-white/70 dark:bg-white/5 px-4 text-sm text-ink dark:text-white placeholder:text-ink-muted/50 dark:placeholder:text-white/25 focus:outline-none focus:ring-4 focus:ring-black/10 dark:focus:ring-white/10"
                    />
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    <Button
                      type="submit"
                      variant="primary"
                      disabled={!canSubmit}
                      className="w-full sm:w-auto"
                    >
                      {mode === 'signup'
                        ? busy
                          ? 'Creating…'
                          : 'Start building'
                        : busy
                        ? 'Signing in…'
                        : 'Sign in'}
                    </Button>

                    <Button
                      type="button"
                      variant="secondary"
                      className="w-full sm:w-auto"
                      onClick={() => {
                        setError('')
                        setMode((m) => (m === 'signup' ? 'signin' : 'signup'))
                      }}
                    >
                      {mode === 'signup' ? 'I already have an account' : 'Create an account'}
                    </Button>
                  </div>

                  <div className="text-xs text-ink-muted/50 dark:text-white/25">
                    No ads. No budgeting. No noise.
                  </div>

                  {error ? (
                    <div className="text-sm text-ink dark:text-white">
                      <span className="text-ink-muted/70 dark:text-white/45">{error}</span>
                    </div>
                  ) : null}
                </form>
              </Card>
            </div>
          </div>

          {/* Right: product preview (placeholder) */}
          <div className="lg:justify-self-end w-full">
            <Card className="p-0 overflow-hidden">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-black/[.02] to-transparent dark:from-white/[.03]" />

                <div className="p-6">
                  <div className="text-xs font-medium tracking-[.14em] uppercase text-ink-muted/50 dark:text-white/25">
                    Preview
                  </div>

                  <div className="mt-4 rounded-2xl border border-black/[.06] dark:border-white/[.06] bg-white/60 dark:bg-white/[.04] p-5">
                    <div className="text-xs text-ink-muted/60 dark:text-white/30">Net worth</div>
                    <div className="mt-2 text-4xl font-semibold tracking-[-0.02em] text-ink dark:text-white [font-variant-numeric:tabular-nums]">
                      £205,990
                    </div>
                    <div className="mt-3 h-2 rounded-full bg-black/[.06] dark:bg-white/[.08] overflow-hidden">
                      <div className="h-full w-[72%] bg-accent rounded-full" />
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs text-ink-muted/60 dark:text-white/30">
                      <span>This month</span>
                      <span className="[font-variant-numeric:tabular-nums]">+£1,240</span>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-4">
                    <div className="rounded-2xl border border-black/[.06] dark:border-white/[.06] bg-white/60 dark:bg-white/[.04] p-4">
                      <div className="text-xs text-ink-muted/60 dark:text-white/30">Projection</div>
                      <div className="mt-2 text-sm font-medium text-ink dark:text-white">
                        £250k in 3.9y
                      </div>
                      <div className="mt-3 h-16 rounded-xl bg-black/[.04] dark:bg-white/[.06]" />
                    </div>
                    <div className="rounded-2xl border border-black/[.06] dark:border-white/[.06] bg-white/60 dark:bg-white/[.04] p-4">
                      <div className="text-xs text-ink-muted/60 dark:text-white/30">
                        Monthly delta
                      </div>
                      <div className="mt-2 text-sm font-medium text-ink dark:text-white">
                        +£1,240
                      </div>
                      <div className="mt-3 h-16 rounded-xl bg-black/[.04] dark:bg-white/[.06]" />
                    </div>
                  </div>

                  <div className="mt-5 text-xs text-ink-muted/50 dark:text-white/25">
                    Swap this preview for real product screenshots once UI is final.
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Clarity */}
      <section className="px-6 sm:px-10 py-16 sm:py-24 border-t border-black/[.04] dark:border-white/[.04]">
        <div className="max-w-[640px] mx-auto">
          <h2 className="text-2xl sm:text-3xl font-semibold text-ink dark:text-white tracking-tight">
            Clarity over noise
          </h2>
          <p className="mt-4 text-base text-ink-muted dark:text-white/40 leading-relaxed">
            This isn't budgeting software and it isn't a trading platform. It's a quiet, focused
            tool for understanding your financial position and moving forward with intention.
          </p>

          <div className="mt-8 space-y-4">
            {[
              'See your complete financial position in one place',
              "Measure what's driving your growth each month",
              'Project your long-term trajectory with confidence',
            ].map((item) => (
              <div key={item} className="flex items-start gap-3 text-sm text-ink dark:text-white/70">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-accent shrink-0" />
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Builders */}
      <section className="px-6 sm:px-10 py-16 sm:py-24 border-t border-black/[.04] dark:border-white/[.04]">
        <div className="max-w-[640px] mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-semibold text-ink dark:text-white tracking-tight">
            Designed for builders
          </h2>
          <p className="mt-4 text-base text-ink-muted dark:text-white/40 leading-relaxed">
            Built for ambitious professionals focused on the future. Not budgeting. Not trading.
            Just a clear view of where you are and where you're heading.
          </p>
        </div>
      </section>

      {/* Core */}
      <section className="px-6 sm:px-10 py-16 sm:py-24 border-t border-black/[.04] dark:border-white/[.04]">
        <div className="max-w-[860px] mx-auto">
          <h2 className="text-2xl sm:text-3xl font-semibold text-ink dark:text-white tracking-tight text-center mb-10">
            The core experience
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {[
              {
                Icon: TrendingUp,
                title: 'Net Worth',
                desc: 'Every account in one number — ISAs, pensions, crypto, property, cash.',
              },
              {
                Icon: BarChart2,
                title: 'Monthly Change',
                desc: 'See exactly what moved and why, each month.',
              },
              {
                Icon: Target,
                title: 'Long-Term Projection',
                desc: 'Compound growth modelling so you can plan decades ahead.',
              },
            ].map(({ Icon, title, desc }) => (
              <Card key={title}>
                <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center mb-4">
                  <Icon size={18} className="text-accent" />
                </div>
                <h3 className="text-sm font-medium text-ink dark:text-white mb-1.5">{title}</h3>
                <p className="text-sm text-ink-muted dark:text-white/40 leading-relaxed">{desc}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pro */}
      <section className="px-6 sm:px-10 py-16 sm:py-24 border-t border-black/[.04] dark:border-white/[.04]">
        <div className="max-w-[560px] mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-semibold text-ink dark:text-white tracking-tight">
            Go further with Pro
          </h2>
          <p className="mt-4 text-base text-ink-muted dark:text-white/40 leading-relaxed mb-8">
            Upgrade to Pro for unlimited accounts, full-timeline projections, and advanced planning
            tools.
          </p>
          <Button variant="pro" onClick={scrollToSignup}>
            Upgrade to Pro
          </Button>
        </div>
      </section>

      {/* Private */}
      <section className="px-6 sm:px-10 py-16 sm:py-24 border-t border-black/[.04] dark:border-white/[.04]">
        <div className="max-w-[640px] mx-auto">
          <h2 className="text-2xl sm:text-3xl font-semibold text-ink dark:text-white tracking-tight text-center mb-8">
            Private by design
          </h2>

          <div className="space-y-4">
            {[
              { Icon: Banknote, text: 'We never sell your data' },
              { Icon: Shield, text: 'No ads. Ever' },
              { Icon: Lock, text: 'Encrypted in transit' },
              { Icon: Trash2, text: 'Delete your account at any time' },
            ].map(({ Icon, text }) => (
              <div key={text} className="flex items-center gap-3 text-sm text-ink dark:text-white/70">
                <Icon size={16} className="text-ink-muted dark:text-white/30 shrink-0" />
                {text}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-6 sm:px-10 py-20 sm:py-28 border-t border-black/[.04] dark:border-white/[.04]">
        <div className="max-w-[560px] mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-semibold text-ink dark:text-white tracking-tight">
            Build wealth with intention.
          </h2>
          <div className="mt-6">
            <Button onClick={scrollToSignup} className="inline-flex items-center">
              Start building <ArrowRight size={16} className="ml-1" />
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative py-8 px-6 sm:px-10 border-t border-black/[.04] dark:border-white/[.04]">
        <div className="max-w-[1100px] mx-auto flex items-center justify-between">
          <div className="font-display text-lg text-ink dark:text-white tracking-tight font-semibold">
            [Brand]<span className="text-accent">.</span>
          </div>
          <div className="flex items-center gap-5 text-xs text-ink-muted/50 dark:text-white/20">
            <button
              onClick={() => setPage('privacy')}
              className="hover:text-ink dark:hover:text-white/50 transition-colors"
            >
              Privacy
            </button>
            <button
              onClick={() => setPage('security')}
              className="hover:text-ink dark:hover:text-white/50 transition-colors"
            >
              Security
            </button>
          </div>
        </div>
      </footer>
    </div>
  )
}