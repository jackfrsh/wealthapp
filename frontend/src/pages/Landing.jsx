// frontend/src/pages/Landing.jsx
import React, { useEffect, useMemo, useState } from 'react'
import { ArrowRight, Check, Crown, Lock } from 'lucide-react'
import { useApp } from '../App'
import Card from '../components/Card'
import Button from '../components/Button'
import AuthModal from '../components/AuthModal'

function hasRecoveryIntent() {
  try {
    const url = new URL(window.location.href)
    if (url.searchParams.get('mode') === 'recovery') return true

    const raw = window.location.hash || ''
    const h = raw.startsWith('#') ? raw.slice(1) : raw
    const hp = new URLSearchParams(h)
    const type = hp.get('type')
    const at = hp.get('access_token')
    const rt = hp.get('refresh_token')
    if (type === 'recovery' && at && rt) return true

    return false
  } catch {
    return false
  }
}

function scrollTo(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

export default function Landing() {
  const { setPage } = useApp()

  const [authOpen, setAuthOpen] = useState(false)
  const [authInitial, setAuthInitial] = useState('register') // 'login' | 'register'
  const [forceRecovery, setForceRecovery] = useState(false)

  // Auto-open modal for recovery links
  useEffect(() => {
    if (!hasRecoveryIntent()) return
    setForceRecovery(true)
    setAuthInitial('login')
    setAuthOpen(true)
  }, [])

  const openAuth = (initial = 'register') => {
    setForceRecovery(false)
    setAuthInitial(initial)
    setAuthOpen(true)
  }

  const productBullets = useMemo(
    () => [
      'Net worth dashboard across cash, ISAs, pensions, property & more',
      'Monthly change explained (contributions, markets, balance updates)',
      'Long-term projections with clear assumptions',
      'Private by design — no ads, no trackers',
    ],
    []
  )

  return (
    <div className="min-h-screen bg-surface dark:bg-surface-dark paddock-backdrop overflow-x-hidden">
      {/* Top nav */}
      <header className="sticky top-0 z-20 border-b border-black/[.04] dark:border-white/[.05] bg-white/55 dark:bg-surface-dark/55 backdrop-blur-xl">
        <div className="mx-auto max-w-6xl px-5 sm:px-6 py-4 flex items-center justify-between">
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="font-display text-xl text-ink dark:text-white tracking-tight"
          >
            Paddock<span className="text-accent">.</span>
          </button>

          <nav className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => scrollTo('product')}
              className="hidden sm:inline px-3 py-2 rounded-xl text-sm font-semibold text-ink-muted/70 hover:text-ink dark:text-white/40 dark:hover:text-white transition-colors"
            >
              Product
            </button>
            <button
              type="button"
              onClick={() => scrollTo('pro')}
              className="hidden sm:inline px-3 py-2 rounded-xl text-sm font-semibold text-ink-muted/70 hover:text-ink dark:text-white/40 dark:hover:text-white transition-colors"
            >
              Pro
            </button>
            <button
              type="button"
              onClick={() => openAuth('login')}
              className="px-3 py-2 rounded-xl text-sm font-semibold text-ink-muted/70 hover:text-ink dark:text-white/40 dark:hover:text-white transition-colors"
            >
              Sign in
            </button>
            <Button
              variant="primary"
              className="h-10 px-4 rounded-2xl"
              onClick={() => openAuth('register')}
            >
              Create account
            </Button>
          </nav>
        </div>
      </header>

      {/* HERO */}
      <section className="mx-auto max-w-6xl px-5 sm:px-6 pt-12 sm:pt-16 pb-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14 items-start">
          {/* Copy */}
          <div className="pt-2">
            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-[-0.03em] text-ink dark:text-white">
              A private net worth tracker.
              <span className="block text-ink-muted/65 dark:text-white/40 text-3xl sm:text-4xl lg:text-5xl tracking-[-0.02em]">
                Built for long-term wealth planning.
              </span>
            </h1>

            <p className="mt-5 text-base sm:text-lg text-ink-muted/70 dark:text-white/45 max-w-xl">
              A calm wealth dashboard that replaces spreadsheets — track net worth, understand monthly
              change, and model your future with clear assumptions.
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Button
                variant="primary"
                className="h-12 px-6 rounded-2xl"
                onClick={() => openAuth('register')}
              >
                Create free account
              </Button>

              <button
                type="button"
                onClick={() => openAuth('login')}
                className="h-12 px-5 rounded-2xl text-sm font-semibold border border-black/[.08] dark:border-white/[.10] hover:bg-black/[.03] dark:hover:bg-white/[.06] transition-colors text-ink dark:text-white"
              >
                Sign in
              </button>

              <span className="text-sm text-ink-muted/60 dark:text-white/25">
                No card required
              </span>
            </div>

            <div className="mt-6 grid gap-2 text-sm text-ink dark:text-white/70">
              {productBullets.map((t) => (
                <div key={t} className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-accent shrink-0" />
                  <span>{t}</span>
                </div>
              ))}
            </div>

            <div className="mt-7 flex items-center gap-4 text-xs text-ink-muted/55 dark:text-white/20">
              <span className="inline-flex items-center gap-2">
                <Lock size={14} /> Secure sign-in
              </span>
              <span className="inline-flex items-center gap-2">
                <Check size={14} /> No ads / no trackers
              </span>
            </div>
          </div>

          {/* Product “images” (mock previews) */}
          <div id="product" className="space-y-4 lg:pt-2">
            {/* Big preview */}
            <Card className="p-0 overflow-hidden bg-white/70 dark:bg-white/[.04] backdrop-blur-xl border border-black/[.06] dark:border-white/[.08] shadow-card-lg">
              <div className="p-5 sm:p-6">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-medium tracking-[.14em] uppercase text-ink-muted/50 dark:text-white/25">
                    Net worth
                  </div>
                  <div className="text-xs text-ink-muted/55 dark:text-white/25">
                    Example dashboard
                  </div>
                </div>

                <div className="mt-4 rounded-2xl border border-black/[.06] dark:border-white/[.07] bg-white/75 dark:bg-white/[.05] p-5">
                  <div className="text-xs text-ink-muted/60 dark:text-white/30">Total</div>
                  <div className="mt-2 text-4xl font-semibold tracking-[-0.02em] text-ink dark:text-white [font-variant-numeric:tabular-nums]">
                    £205,990
                  </div>

                  <div className="mt-4 flex items-center justify-between text-xs text-ink-muted/60 dark:text-white/30">
                    <span>This month</span>
                    <span className="text-ink dark:text-white/70 [font-variant-numeric:tabular-nums]">
                      +£1,240
                    </span>
                  </div>

                  {/* Mini “chart” */}
                  <div className="mt-4 h-24 rounded-2xl border border-black/[.06] dark:border-white/[.06] bg-black/[.02] dark:bg-white/[.04] overflow-hidden relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-accent/10 via-transparent to-black/[.03] dark:to-white/[.05]" />
                    <div className="absolute bottom-0 left-0 right-0 h-16 opacity-90">
                      <div className="h-full w-full relative">
                        <div className="absolute inset-x-0 bottom-0 h-10 bg-accent/15 blur-[10px]" />
                        <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-accent/25 to-transparent" />
                        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-accent/70" />
                      </div>
                    </div>
                    <div className="absolute inset-0 flex items-end justify-between px-4 pb-3 text-[10px] text-ink-muted/50 dark:text-white/20">
                      <span>Jan</span>
                      <span>Apr</span>
                      <span>Jul</span>
                      <span>Oct</span>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Two smaller previews */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Accounts */}
              <Card className="p-5 bg-white/70 dark:bg-white/[.04] backdrop-blur-xl border border-black/[.06] dark:border-white/[.08] shadow-card">
                <div className="text-xs font-medium tracking-[.14em] uppercase text-ink-muted/50 dark:text-white/25">
                  Accounts
                </div>

                <div className="mt-4 space-y-3">
                  {[
                    ['Barclays Current', 'GBP', '£12,540'],
                    ['Vanguard ISA', 'GBP', '£38,120'],
                    ['SIPP', 'GBP', '£102,600'],
                  ].map(([name, cur, val]) => (
                    <div
                      key={name}
                      className="flex items-center justify-between rounded-2xl border border-black/[.06] dark:border-white/[.07] bg-white/75 dark:bg-white/[.05] px-4 py-3"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-ink dark:text-white truncate">
                          {name}
                        </div>
                        <div className="text-xs text-ink-muted/60 dark:text-white/30">{cur}</div>
                      </div>
                      <div className="text-sm font-semibold text-ink dark:text-white [font-variant-numeric:tabular-nums]">
                        {val}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Outlook */}
              <Card className="p-5 bg-white/70 dark:bg-white/[.04] backdrop-blur-xl border border-black/[.06] dark:border-white/[.08] shadow-card">
                <div className="text-xs font-medium tracking-[.14em] uppercase text-ink-muted/50 dark:text-white/25">
                  Outlook
                </div>

                <div className="mt-4 rounded-2xl border border-black/[.06] dark:border-white/[.07] bg-white/75 dark:bg-white/[.05] p-4 relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-accent/10 via-transparent to-black/[.03] dark:to-white/[.05]" />

                  <div className="relative">
                    <div className="text-xs text-ink-muted/60 dark:text-white/30">
                      Target
                    </div>
                    <div className="mt-1 text-sm font-semibold text-ink dark:text-white">
                      £250k in ~3.9 years
                    </div>

                    <div className="mt-4 h-20 rounded-xl bg-black/[.03] dark:bg-white/[.06] border border-black/[.06] dark:border-white/[.08] relative overflow-hidden">
                      <div className="absolute left-0 right-0 bottom-0 h-10 bg-gradient-to-t from-accent/25 to-transparent" />
                      <div className="absolute bottom-5 left-3 right-3 h-[2px] bg-accent/70" />
                      <div className="absolute bottom-4 left-[72%] h-6 w-[2px] bg-white/60 dark:bg-black/30" />
                      <div className="absolute bottom-2 left-[72%] text-[10px] text-ink-muted/60 dark:text-white/25">
                        goal
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between text-[10px] text-ink-muted/50 dark:text-white/20">
                      <span>Now</span>
                      <span>5y</span>
                      <span>10y</span>
                      <span>30y</span>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* PRO (single section, not pushy) */}
      <section id="pro" className="px-5 sm:px-6 py-20 sm:py-24 border-t border-black/[.03] dark:border-white/[.03]">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-[740px] mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-black/[.03] dark:bg-white/[.06] border border-black/[.06] dark:border-white/[.10]">
              <Crown size={14} className="opacity-80" />
              <span className="text-sm font-semibold text-ink dark:text-white">Paddock Pro</span>
            </div>

            <h2 className="mt-5 font-display text-3xl sm:text-4xl text-ink dark:text-white tracking-tight">
              Go further when you’re ready.
            </h2>
            <p className="mt-3 text-base text-ink-muted dark:text-white/40 leading-relaxed">
              Unlimited accounts, longer timelines, and advanced planning tools — without turning the
              product into “noise”.
            </p>

            <div className="mt-7 flex items-center justify-center gap-3">
              <Button
                variant="pro"
                className="h-12 px-6 rounded-2xl"
                onClick={() => {
                  try {
                    localStorage.setItem('upgrade_reason', 'landing_pro')
                  } catch {}
                  setPage('upgrade')
                }}
              >
                See Pro pricing
              </Button>

              <button
                type="button"
                onClick={() => openAuth('register')}
                className="h-12 px-5 rounded-2xl text-sm font-semibold border border-black/[.08] dark:border-white/[.10] hover:bg-black/[.03] dark:hover:bg-white/[.06] transition-colors text-ink dark:text-white"
              >
                Start free
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-5 sm:px-6 py-10 border-t border-black/[.03] dark:border-white/[.03]">
        <div className="mx-auto max-w-6xl flex items-center justify-between gap-6">
          <div className="font-display text-lg text-ink dark:text-white tracking-tight font-semibold">
            Paddock<span className="text-accent">.</span>
          </div>

          <div className="flex items-center gap-5 text-xs text-ink-muted/50 dark:text-white/20">
            <button type="button" onClick={() => setPage('privacy')} className="hover:text-ink dark:hover:text-white/50 transition-colors">
              Privacy
            </button>
            <button type="button" onClick={() => setPage('security')} className="hover:text-ink dark:hover:text-white/50 transition-colors">
              Security
            </button>
          </div>
        </div>
      </footer>

      {/* Auth modal */}
      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        initial={authInitial}
        forceMode={forceRecovery ? 'recovery' : null}
      />
    </div>
  )
}