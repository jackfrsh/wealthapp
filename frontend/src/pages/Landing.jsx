// frontend/src/pages/Landing.jsx
import React, { useEffect, useRef, useState } from 'react'
import { useApp } from '../App'
import Card from '../components/Card'
import Button from '../components/Button'
import AuthModal from '../components/AuthModal'

import homeShot from '../assets/landing/paddock-home.png'
import outlookShot from '../assets/landing/paddock-outlook.png'
import insightsShot from '../assets/landing/paddock-insights.png'

/* ── Recovery-link auto-open ────────────────────────────────── */

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

/* ── Scroll-triggered reveal ────────────────────────────────── */

function useReveal() {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.style.opacity = '1'
          el.style.transform = 'translateY(0)'
          obs.unobserve(el)
        }
      },
      { threshold: 0.12 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  return ref
}

function Reveal({ children, className = '' }) {
  const ref = useReveal()
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: 0,
        transform: 'translateY(16px)',
        transition:
          'opacity 0.6s cubic-bezier(0.2,0.8,0.2,1), transform 0.6s cubic-bezier(0.2,0.8,0.2,1)',
      }}
    >
      {children}
    </div>
  )
}

/* ── Helpers ────────────────────────────────────────────────── */

function scrollTo(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function SectionLabel({ children }) {
  return (
    <div className="text-xs font-medium tracking-[.14em] uppercase text-ink-muted/50 dark:text-white/20">
      {children}
    </div>
  )
}

function Screenshot({ src, alt, className = '' }) {
  return (
    <div
      className={[
        'rounded-3xl overflow-hidden border border-black/[.06] dark:border-white/[.07]',
        'shadow-[0_26px_70px_rgba(0,0,0,.14)]',
        'bg-black/[.02] dark:bg-white/[.02]',
        'relative',
        className,
      ].join(' ')}
    >
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-white/[.06] via-transparent to-black/[.04] dark:from-white/[.04] dark:to-black/[.18]" />
      <img src={src} alt={alt} className="w-full h-auto block relative" loading="lazy" />
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════ */
/*  LANDING                                                      */
/* ══════════════════════════════════════════════════════════════ */

export default function Landing() {
  const { setPage } = useApp()

  const [authOpen, setAuthOpen] = useState(false)
  const [authInitial, setAuthInitial] = useState('register')
  const [forceRecovery, setForceRecovery] = useState(false)

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

  const goUpgrade = () => {
    try {
      localStorage.setItem('upgrade_reason', 'landing_pricing')
    } catch {}
    setPage('upgrade')
  }

  return (
    <div className="min-h-screen bg-surface dark:bg-surface-dark paddock-backdrop overflow-x-hidden">
      {/* ─── NAV ─────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 border-b border-black/[.04] dark:border-white/[.05] bg-white/55 dark:bg-surface-dark/55 backdrop-blur-xl">
        <div className="mx-auto max-w-6xl px-5 sm:px-6 h-16 flex items-center justify-between">
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="font-display text-xl text-ink dark:text-white tracking-tight"
          >
            Paddock<span className="text-accent">.</span>
          </button>

          <nav className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => scrollTo('product')}
              className="hidden sm:inline px-3 py-2 rounded-xl text-sm font-semibold text-ink-muted/70 hover:text-ink dark:text-white/40 dark:hover:text-white transition-colors"
            >
              Product
            </button>
            <button
              type="button"
              onClick={() => scrollTo('pricing')}
              className="hidden sm:inline px-3 py-2 rounded-xl text-sm font-semibold text-ink-muted/70 hover:text-ink dark:text-white/40 dark:hover:text-white transition-colors"
            >
              Pricing
            </button>

            <div className="w-px h-4 bg-black/[.08] dark:bg-white/[.08] mx-2 hidden sm:block" />

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

      {/* ─── HERO ────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-5 sm:px-6 pt-28 sm:pt-36 lg:pt-44 pb-14 sm:pb-18">
        <div className="max-w-[740px]">
          <h1 className="font-display text-[2.85rem] sm:text-6xl lg:text-[4.35rem] font-semibold tracking-[-0.03em] leading-[1.06] text-ink dark:text-white">
            Long-term wealth modelling. 
          </h1>

          <p className="mt-5 sm:mt-6 text-lg sm:text-xl text-ink-3/80 dark:text-white/35 tracking-[-0.01em] max-w-[42rem]">
          Track net worth. Set a target. Model the projection.
          </p>

          <div className="mt-8 sm:mt-10 flex flex-wrap items-center gap-3">
            <Button
              variant="primary"
              className="h-12 px-6 rounded-2xl"
              onClick={() => openAuth('register')}
            >
              Create account
            </Button>

            <button
              type="button"
              onClick={() => openAuth('login')}
              className="h-12 px-5 rounded-2xl text-sm font-semibold border border-black/[.08] dark:border-white/[.10] hover:bg-black/[.03] dark:hover:bg-white/[.06] transition-colors text-ink dark:text-white"
            >
              Sign in
            </button>

            <span className="text-sm text-ink-muted/55 dark:text-white/20">
              
            </span>
          </div>

          {/* Quiet trust line (no hype, no “premium”) */}
          <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-ink-muted/55 dark:text-white/20">
            <span>No ads</span>
            <span>No tracking cookies</span>
            <span>Stripe billing</span>
          </div>
        </div>
      </section>

      {/* ─── SCREENSHOT 1: DASHBOARD ─────────────────────── */}
      <section className="mx-auto max-w-6xl px-5 sm:px-6 pb-8">
        <Reveal>
          <Screenshot
            src={homeShot}
            alt="Paddock dashboard showing total wealth, milestone tracking, 90-day trend, and retirement plan progress"
          />
          <p className="mt-5 text-sm text-ink-muted/50 dark:text-white/20">
            Net worth dashboard with milestone tracking and plan progress.
          </p>
        </Reveal>
      </section>

      {/* ─── STRUCTURE ───────────────────────────────────── */}
      <section id="product" className="mx-auto max-w-6xl px-5 sm:px-6 py-18 sm:py-24">
        <Reveal>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 lg:gap-14">
            {[
              {
                title: 'One target',
                body: 'A single financial goal anchors the model. Milestones adapt as your net worth changes.',
              },
              {
                title: 'Your accounts',
                body: 'ISAs, SIPPs, crypto, property, cash. Multi-currency. Manual input — you control the data.',
              },
              {
                title: 'Visible assumptions',
                body: 'Contribution, return rate, and time horizon are always shown alongside the projection.',
              },
            ].map(({ title, body }) => (
              <div key={title}>
                <h3 className="font-display text-base font-semibold text-ink dark:text-white tracking-tight">
                  {title}
                </h3>
                <div className="mt-3 h-px w-10 bg-black/[.10] dark:bg-white/[.10]" />
                <p className="mt-3 text-sm text-ink-muted/65 dark:text-white/35 leading-relaxed">
                  {body}
                </p>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* ─── PROJECTION ──────────────────────────────────── */}
      <section className="border-t border-black/[.03] dark:border-white/[.03]">
        <div className="mx-auto max-w-6xl px-5 sm:px-6 py-20 sm:py-28">
          <Reveal>
            <SectionLabel>Projection</SectionLabel>
            <h2 className="mt-3 font-display text-3xl sm:text-4xl font-semibold text-ink dark:text-white tracking-tight">
              Model your trajectory.
            </h2>
            <p className="mt-4 text-sm sm:text-base text-ink-muted/65 dark:text-white/35 max-w-xl leading-relaxed">
              A long-horizon projection that updates with each snapshot, with inputs kept visible.
            </p>
          </Reveal>

          <Reveal className="mt-12 sm:mt-14">
            <Screenshot
              src={outlookShot}
              alt="Paddock projection view showing trajectory graph with projected and required net worth curves over 30 years"
            />
          </Reveal>
        </div>
      </section>

      {/* ─── SCENARIOS ───────────────────────────────────── */}
      <section className="border-t border-black/[.03] dark:border-white/[.03]">
        <div className="mx-auto max-w-6xl px-5 sm:px-6 py-20 sm:py-28">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <Reveal>
              <SectionLabel>Scenarios</SectionLabel>
              <h2 className="mt-3 font-display text-3xl sm:text-4xl font-semibold text-ink dark:text-white tracking-tight">
                Test changes before you commit.
              </h2>
              <p className="mt-4 text-sm sm:text-base text-ink-muted/65 dark:text-white/35 max-w-md leading-relaxed">
                Adjust contributions or add a lump sum and see the timeline shift.
              </p>
            </Reveal>

            <Reveal>
              <Screenshot
                src={insightsShot}
                alt="Paddock insights showing what-if scenario modelling with contribution slider and timeline impact"
              />
            </Reveal>
          </div>
        </div>
      </section>

      {/* ─── POSITIONING ─────────────────────────────────── */}
      <section className="border-t border-black/[.03] dark:border-white/[.03]">
        <div className="mx-auto max-w-6xl px-5 sm:px-6 py-18 sm:py-24">
          <Reveal>
            <p className="font-display text-xl sm:text-2xl font-medium text-ink dark:text-white/80 tracking-[-0.01em] leading-relaxed max-w-2xl">
              Paddock is structured financial modelling built around a single goal — with every assumption visible.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ─── TRUST ───────────────────────────────────────── */}
      <section className="border-t border-black/[.03] dark:border-white/[.03]">
        <div className="mx-auto max-w-6xl px-5 sm:px-6 py-18 sm:py-24">
          <Reveal>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 lg:gap-14">
              {[
                {
                  title: 'No ads. No tracking cookies.',
                  body: 'The product does not run advertising trackers.',
                },
                {
                  title: 'Secure sign-in.',
                  body: 'Password reset and session security handled by Supabase Auth.',
                },
                {
                  title: 'Stripe billing.',
                  body: 'Subscriptions are managed by Stripe. Cancel anytime.',
                },
              ].map(({ title, body }) => (
                <div key={title}>
                  <h3 className="text-sm font-semibold text-ink dark:text-white">{title}</h3>
                  <p className="mt-1.5 text-sm text-ink-muted/60 dark:text-white/30 leading-relaxed">
                    {body}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-10 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setPage('privacy')}
                className="px-4 py-2 rounded-2xl text-sm font-semibold border border-black/[.08] dark:border-white/[.10] hover:bg-black/[.03] dark:hover:bg-white/[.06] transition-colors text-ink dark:text-white"
              >
                Privacy
              </button>
              <button
                type="button"
                onClick={() => setPage('security')}
                className="px-4 py-2 rounded-2xl text-sm font-semibold border border-black/[.08] dark:border-white/[.10] hover:bg-black/[.03] dark:hover:bg-white/[.06] transition-colors text-ink dark:text-white"
              >
                Security
              </button>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ─── PRICING ─────────────────────────────────────── */}
      <section id="pricing" className="border-t border-black/[.03] dark:border-white/[.03]">
        <div className="mx-auto max-w-6xl px-5 sm:px-6 py-20 sm:py-28">
          <Reveal>
            <SectionLabel>Pricing</SectionLabel>
            <h2 className="mt-3 font-display text-3xl sm:text-4xl font-semibold text-ink dark:text-white tracking-tight">
              Simple.
            </h2>
            <p className="mt-3 text-sm sm:text-base text-ink-muted/65 dark:text-white/35 max-w-xl leading-relaxed">
              Start free. Upgrade when you want longer horizons and deeper modelling.
            </p>
          </Reveal>

          <Reveal className="mt-10 grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Free */}
            <Card className="p-7 sm:p-8 bg-white/70 dark:bg-white/[.04] backdrop-blur-xl border border-black/[.06] dark:border-white/[.08] shadow-card">
              <div className="text-sm font-semibold text-ink-muted/70 dark:text-white/40">Free</div>
              <div className="mt-3 text-3xl font-semibold text-ink dark:text-white tracking-tight">£0</div>
              <p className="mt-1.5 text-sm text-ink-muted/55 dark:text-white/25">Core tracking</p>

              <div className="mt-6 space-y-2 text-sm text-ink-muted/65 dark:text-white/35">
                <p>Net worth tracking</p>
                <p>Up to 3 accounts</p>
                <p>1 year projections</p>
              </div>

              <div className="mt-8">
                <button
                  type="button"
                  onClick={() => openAuth('register')}
                  className="h-11 px-5 rounded-2xl text-sm font-semibold border border-black/[.08] dark:border-white/[.10] hover:bg-black/[.03] dark:hover:bg-white/[.06] transition-colors text-ink dark:text-white"
                >
                  Create account
                </button>
              </div>
            </Card>

            {/* Pro */}
            <Card className="p-7 sm:p-8 bg-white/70 dark:bg-white/[.04] backdrop-blur-xl border border-black/[.06] dark:border-white/[.08] shadow-card">
              <div className="text-sm font-semibold text-ink dark:text-white">Pro</div>

              <div className="mt-3 flex items-baseline gap-1.5">
                <span className="text-3xl font-semibold text-ink dark:text-white tracking-tight">£6</span>
                <span className="text-sm font-semibold text-ink-muted/55 dark:text-white/25">/month</span>
              </div>

              <p className="mt-1.5 text-sm text-ink-muted/55 dark:text-white/25">
                or £60/year · Annual includes a 7-day trial
              </p>

              <div className="mt-6 space-y-2 text-sm text-ink-muted/65 dark:text-white/35">
                <p>Unlimited accounts</p>
                <p>Longer projections (5–30 years)</p>
                <p>Scenarios and modelling tools</p>
                <p>Multi-currency</p>
              </div>

              <div className="mt-2">
                <button
                  type="button"
                  onClick={() => openAuth('register')}
                  className="h-11 px-5 rounded-2xl text-sm font-semibold border border-black/[.08] dark:border-white/[.10] hover:bg-black/[.03] dark:hover:bg-white/[.06] transition-colors text-ink dark:text-white"
                >
                  Start free
                </button>
               </div>
              <p className="mt-4 text-sm text-ink-muted/55 dark:text-white/25">
                Cancel anytime.
              </p>
            </Card>
          </Reveal>
        </div>
      </section>

      {/* ─── FINAL CTA ───────────────────────────────────── */}
      <section className="border-t border-black/[.03] dark:border-white/[.03]">
        <div className="mx-auto max-w-6xl px-5 sm:px-6 py-20 sm:py-28 text-center">
          <Reveal>
            <h2 className="font-display text-3xl sm:text-4xl font-semibold text-ink dark:text-white tracking-tight">
              Start modelling.
            </h2>
            <div className="mt-8 flex items-center justify-center gap-3">
              <Button
                variant="primary"
                className="h-12 px-6 rounded-2xl"
                onClick={() => openAuth('register')}
              >
                Create account
              </Button>
              <button
                type="button"
                onClick={() => openAuth('login')}
                className="h-12 px-5 rounded-2xl text-sm font-semibold border border-black/[.08] dark:border-white/[.10] hover:bg-black/[.03] dark:hover:bg-white/[.06] transition-colors text-ink dark:text-white"
              >
                Sign in
              </button>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ─── FOOTER ──────────────────────────────────────── */}
      <footer className="border-t border-black/[.03] dark:border-white/[.03]">
        <div className="mx-auto max-w-6xl px-5 sm:px-6 py-10 flex items-center justify-between">
          <div className="font-display text-lg text-ink dark:text-white tracking-tight font-semibold">
            Paddock<span className="text-accent">.</span>
          </div>

          <div className="flex items-center gap-5 text-xs text-ink-muted/50 dark:text-white/20">
            <button
              type="button"
              onClick={() => setPage('privacy')}
              className="hover:text-ink dark:hover:text-white/50 transition-colors"
            >
              Privacy
            </button>
            <button
              type="button"
              onClick={() => setPage('security')}
              className="hover:text-ink dark:hover:text-white/50 transition-colors"
            >
              Security
            </button>
            <span>© 2026</span>
          </div>
        </div>
      </footer>

      {/* ─── AUTH MODAL ──────────────────────────────────── */}
      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        initial={authInitial}
        forceMode={forceRecovery ? 'recovery' : null}
      />
    </div>
  )
}