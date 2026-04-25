import React, { useEffect, useRef, useState } from 'react'
import { useApp } from '../App'
import Card from '../components/Card'
import Button from '../components/Button'
import AuthModal from '../components/AuthModal'
import { useSEO } from '../useSEO'

import homeShot from '../assets/landing/paddock-home.png'
import outlookShot from '../assets/landing/paddock-plan.png'
import insightsShot from '../assets/landing/paddock-decisions.png'
import homeShotWebp from '../assets/landing/paddock-home.webp'
import outlookShotWebp from '../assets/landing/paddock-plan.webp'
import insightsShotWebp from '../assets/landing/paddock-decisions.webp'

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

function SectionLabel({ children }) {
  return (
    <div className="text-xs font-medium tracking-[.14em] uppercase text-ink-muted/50 dark:text-white/20">
      {children}
    </div>
  )
}

function useReveal() {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReducedMotion) {
      el.style.opacity = '1'
      el.style.transform = 'none'
      return
    }

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

function Screenshot({ src, webp, alt, className = '', loading = 'lazy' }) {
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
      <picture>
        {webp ? <source srcSet={webp} type="image/webp" /> : null}
        <img src={src} alt={alt} className="w-full h-auto block relative" loading={loading} />
      </picture>
    </div>
  )
}

export default function Landing() {
  const { setPage } = useApp()

  useSEO({
    title: 'Paddock — Private Wealth Planning',
    description:
      'Model ISA deadlines, mortgage trade-offs, pensions and long-term projections in one calm, private dashboard built for decisions, not just balance checking.',
    canonicalPath: '/',
  })

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

  return (
    <div className="min-h-screen bg-surface dark:bg-surface-dark paddock-backdrop overflow-x-hidden">
      {/* NAV */}
      <header className="sticky top-0 z-20 border-b border-black/[.04] dark:border-white/[.05] bg-white/55 dark:bg-surface-dark/55 backdrop-blur-xl">
        <div className="mx-auto max-w-6xl px-5 sm:px-6 h-16 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setPage('landing')}
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
            <button
              type="button"
              onClick={() => setPage('tools_index')}
              className="hidden sm:inline px-3 py-2 rounded-xl text-sm font-semibold text-ink-muted/70 hover:text-ink dark:text-white/40 dark:hover:text-white transition-colors"
            >
              Tools
            </button>
            <button
              type="button"
              onClick={() => setPage('guides_index')}
              className="hidden sm:inline px-3 py-2 rounded-xl text-sm font-semibold text-ink-muted/70 hover:text-ink dark:text-white/40 dark:hover:text-white transition-colors"
            >
              Guides
            </button>

            <div className="w-px h-4 bg-black/[.08] dark:bg-white/[.08] mx-2 hidden sm:block" />

            <button
              type="button"
              onClick={() => openAuth('login')}
              className="px-3 py-2 rounded-xl text-sm font-semibold text-ink-muted/70 hover:text-ink dark:text-white/40 dark:hover:text-white transition-colors"
            >
              Sign in
            </button>

            <Button variant="primary" className="h-10 px-4 rounded-2xl" onClick={() => openAuth('register')}>
              Create account
            </Button>
          </nav>
        </div>
      </header>

      {/* HERO */}
      <section className="mx-auto max-w-6xl px-5 sm:px-6 pt-24 sm:pt-32 lg:pt-40 pb-12 sm:pb-16">
        <div className="max-w-[820px]">
        <div className="text-sm font-semibold tracking-[.12em] uppercase text-ink-muted/60 dark:text-white/30 mb-4">
  Private wealth planning
</div>

<h1 className="font-display text-[2.85rem] sm:text-6xl lg:text-[4.35rem] font-semibold tracking-[-0.03em] leading-[1.03] text-ink dark:text-white">
  Your wealth.
  <br />
  Planned.
</h1>

<p className="mt-5 sm:mt-6 text-lg sm:text-xl text-ink-3/90 dark:text-white/50 tracking-[-0.01em] max-w-[46rem]">
  Model ISA deadlines, mortgage trade-offs, pensions and long-term projections in one calm, private dashboard — built for decisions, not just balance checking.
</p>

          <div className="mt-8 sm:mt-10 flex flex-wrap items-center gap-3">
            <Button variant="primary" className="h-12 px-6 rounded-2xl" onClick={() => openAuth('register')}>
              Get started — it&apos;s free
            </Button>

            <button
              type="button"
              onClick={() => openAuth('login')}
              className="h-12 px-5 rounded-2xl text-sm font-semibold border border-black/[.08] dark:border-white/[.10] hover:bg-black/[.03] dark:hover:bg-white/[.06] transition-colors text-ink dark:text-white"
            >
              Sign in
            </button>
          </div>

          <p className="mt-4 text-xs text-ink-muted/55 dark:text-white/20">
  Free to start • No credit card required • Private by design • No bank linking
</p>

<div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-ink-muted/55 dark:text-white/20">
  <span>ISA deadline awareness</span>
  <span>Mortgage trade-off modelling</span>
  <span>Long-term projections</span>
  <span>No bank linking</span>
  <span>Private by design</span>
</div>
        </div>
      </section>

      {/* SCREENSHOT 1 */}
      <section className="mx-auto max-w-6xl px-5 sm:px-6 pb-10">
  <Reveal>
    <Screenshot
      src={insightsShot}
      webp={insightsShotWebp}
      alt="Paddock decisions view showing planning tools and next-step modelling"
      loading="eager"
    />
    <p className="mt-5 text-sm text-ink-muted/50 dark:text-white/20">
      Decision tools for ISA timing, contribution changes and long-term trade-offs.
    </p>
  </Reveal>
</section>

      {/* USE PAGES */}
      <section className="border-t border-black/[.03] dark:border-white/[.03]">
        <div className="mx-auto max-w-6xl px-5 sm:px-6 py-16 sm:py-20">
          <Reveal>
          <SectionLabel>Use Paddock for</SectionLabel>
<h2 className="mt-3 font-display text-3xl sm:text-4xl font-semibold text-ink dark:text-white tracking-tight">
  Built for real wealth planning.
</h2>
<p className="mt-4 text-sm sm:text-base text-ink-muted/65 dark:text-white/35 max-w-xl leading-relaxed">
  Explore the core ways people use Paddock to see wealth clearly, plan ahead, and stay focused on long-term progress.
</p>

            <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                {
                  title: 'Net worth tracking',
                  body: 'See assets and liabilities together in one calm dashboard.',
                  page: 'net_worth_tracker',
                },
                {
                  title: 'Track ISAs and pensions',
                  body: 'Bring core UK wealth accounts into one clear long-term view.',
                  page: 'track_isas_pensions_savings',
                },
                {
                  title: 'Replace spreadsheets',
                  body: 'Move from fragile tabs and formulas to a cleaner structured workflow.',
                  page: 'spreadsheet_alternative',
                },
                {
                  title: 'How to track your net worth',
                  body: 'Learn what to include, how often to update, and what matters most.',
                  page: 'how_to_track_net_worth',
                },
              ].map(({ title, body, page }) => (
                <button
                  key={title}
                  type="button"
                  onClick={() => setPage(page)}
                  className="text-left rounded-3xl border border-black/[.06] dark:border-white/[.08] bg-white/70 dark:bg-white/[.04] backdrop-blur-xl shadow-card p-6 hover:bg-black/[.02] dark:hover:bg-white/[.06] transition-colors"
                >
                  <h3 className="font-display text-base font-semibold text-ink dark:text-white tracking-tight">
                    {title}
                  </h3>
                  <div className="mt-3 h-px w-10 bg-black/[.10] dark:bg-white/[.10]" />
                  <p className="mt-3 text-sm text-ink-muted/65 dark:text-white/35 leading-relaxed">{body}</p>
                </button>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* PRODUCT */}
      <section id="product" className="mx-auto max-w-6xl px-5 sm:px-6 py-16 sm:py-20">
        <Reveal>
        <SectionLabel>Why Paddock</SectionLabel>
<h2 className="mt-3 font-display text-3xl sm:text-4xl font-semibold text-ink dark:text-white tracking-tight">
  From balances to decisions.
</h2>
<p className="mt-4 text-sm sm:text-base text-ink-muted/65 dark:text-white/35 max-w-xl leading-relaxed">
  Paddock helps you see where your wealth is heading, what is getting in the way, and what to do next — without the clutter of a generic finance app.
</p>

          <div className="mt-10 grid grid-cols-1 lg:grid-cols-3 gap-10 lg:gap-14">
          {[
  {
    title: 'One plan, always visible.',
    body: 'A named long-term goal anchors the model, so progress is measured against something real — not just a changing balance.',
  },
  {
    title: 'UK wealth context built in.',
    body: 'ISAs, pensions, property and wrapper-aware decisions are part of the experience — not bolted on later.',
  },
  {
    title: 'See the impact before you move.',
    body: 'Model contribution changes, compare paths, and understand trade-offs before you commit new money.',
  },
].map(({ title, body }) => (
              <div key={title}>
                <h3 className="font-display text-base font-semibold text-ink dark:text-white tracking-tight">
                  {title}
                </h3>
                <div className="mt-3 h-px w-10 bg-black/[.10] dark:bg-white/[.10]" />
                <p className="mt-3 text-sm text-ink-muted/65 dark:text-white/35 leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* SCENARIOS */}
      <section className="border-t border-black/[.03] dark:border-white/[.03]">
        <div className="mx-auto max-w-6xl px-5 sm:px-6 py-16 sm:py-20">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
            <Reveal>
            <SectionLabel>Decisions</SectionLabel>
<h2 className="mt-3 font-display text-3xl sm:text-4xl font-semibold text-ink dark:text-white tracking-tight">
  Know what the next pounds should do.
</h2>
<p className="mt-4 text-sm sm:text-base text-ink-muted/65 dark:text-white/35 max-w-md leading-relaxed">
  Use Paddock to model ISA timing, contribution changes, and long-term trade-offs before you make the next move.
</p>

              <div className="mt-6 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage('guide_long_term_projection')}
                  className="px-4 py-2 rounded-2xl text-sm font-semibold border border-black/[.08] dark:border-white/[.10] hover:bg-black/[.03] dark:hover:bg-white/[.06] transition-colors text-ink dark:text-white"
                >
                  Long-term projections
                </button>
                <button
                  type="button"
                  onClick={() => setPage('guide_multi_currency')}
                  className="px-4 py-2 rounded-2xl text-sm font-semibold border border-black/[.08] dark:border-white/[.10] hover:bg-black/[.03] dark:hover:bg-white/[.06] transition-colors text-ink dark:text-white"
                >
                  Multi-currency tracking
                </button>
                <button
                  type="button"
                  onClick={() => setPage('guide_inflation_adjusted')}
                  className="px-4 py-2 rounded-2xl text-sm font-semibold border border-black/[.08] dark:border-white/[.10] hover:bg-black/[.03] dark:hover:bg-white/[.06] transition-colors text-ink dark:text-white"
                >
                  Inflation-adjusted views
                </button>
              </div>
            </Reveal>

            <Reveal>
              <Screenshot src={insightsShot} webp={insightsShotWebp} alt="Paddock insights showing scenario modelling" />
              <p className="mt-5 text-sm text-ink-muted/50 dark:text-white/20">
              Decision tools for ISA timing, contribution changes and long-term trade-offs.
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      {/* PROJECTION */}
      <section className="border-t border-black/[.03] dark:border-white/[.03]">
        <div className="mx-auto max-w-6xl px-5 sm:px-6 py-16 sm:py-20">
          <Reveal>
          <SectionLabel>Projection</SectionLabel>
<h2 className="mt-3 font-display text-3xl sm:text-4xl font-semibold text-ink dark:text-white tracking-tight">
  See the path, not just the total.
</h2>
<p className="mt-4 text-sm sm:text-base text-ink-muted/65 dark:text-white/35 max-w-xl leading-relaxed">
  Project your current path, compare it to the pace required, and understand the gap long before it becomes a surprise.
</p>
          </Reveal>

          <Reveal className="mt-10">
            <Screenshot
              src={outlookShot}
              webp={outlookShotWebp}
              alt="Paddock projection view showing trajectory graph with projected and required net worth curves over time"
            />
            <p className="mt-5 text-sm text-ink-muted/50 dark:text-white/20">
            Long-term projection with visible assumptions, target path and trajectory.
            </p>
          </Reveal>
        </div>
      </section>

    

      {/* TRUST */}
      <section className="border-t border-black/[.03] dark:border-white/[.03]">
        <div className="mx-auto max-w-6xl px-5 sm:px-6 py-16 sm:py-20">
          <Reveal>
            <SectionLabel>Trust</SectionLabel>
            <h2 className="mt-3 font-display text-3xl sm:text-4xl font-semibold text-ink dark:text-white tracking-tight">
              Private by design.
            </h2>
            <p className="mt-4 text-sm sm:text-base text-ink-muted/65 dark:text-white/35 max-w-xl leading-relaxed">
  No ads. No trackers. No bank linking. Paddock is intentionally manual, so your data stays private and your numbers stay deliberate.
</p>

            <div className="mt-10 grid grid-cols-1 lg:grid-cols-3 gap-10 lg:gap-14">
              {[
                {
                  title: 'No ads. No ad tracking.',
                  body: 'The product is designed to stay focused, private and free from ad clutter.',
                },
                {
                  title: 'Secure authentication.',
                  body: 'Industry-standard sign-in with protected sessions and secure password management.',
                },
                {
                  title: 'Payments by Stripe.',
                  body: 'Card details are handled entirely by Stripe — they never touch our servers.',
                },
              ].map(({ title, body }) => (
                <div key={title}>
                  <h3 className="text-sm font-semibold text-ink dark:text-white">{title}</h3>
                  <p className="mt-1.5 text-sm text-ink-muted/60 dark:text-white/30 leading-relaxed">{body}</p>
                </div>
              ))}
            </div>

            <div className="mt-10 flex items-center gap-3 flex-wrap">
              <button
                type="button"
                onClick={() => setPage('terms')}
                className="px-4 py-2 rounded-2xl text-sm font-semibold border border-black/[.08] dark:border-white/[.10] hover:bg-black/[.03] dark:hover:bg-white/[.06] transition-colors text-ink dark:text-white"
              >
                Terms
              </button>
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

      {/* PRICING */}
      <section id="pricing" className="border-t border-black/[.03] dark:border-white/[.03]">
        <div className="mx-auto max-w-6xl px-5 sm:px-6 py-16 sm:py-20">
          <Reveal>
            <SectionLabel>Pricing</SectionLabel>
            <h2 className="mt-3 font-display text-3xl sm:text-4xl font-semibold text-ink dark:text-white tracking-tight">
              Simple.
            </h2>
            <p className="mt-4 text-sm text-ink-muted/65 dark:text-white/35 max-w-xl leading-relaxed">
  Start free to track your wealth clearly. Upgrade when you want to plan years ahead and model what to do next.
</p>
          </Reveal>

          <Reveal className="mt-10 grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
  <Card className="p-7 sm:p-8 bg-white/70 dark:bg-white/[.04] backdrop-blur-xl border border-black/[.06] dark:border-white/[.08] shadow-card flex flex-col h-full">
    <div className="text-sm font-semibold text-ink-muted/70 dark:text-white/40">Free</div>
    <div className="mt-3 text-3xl font-semibold text-ink dark:text-white tracking-tight">£0</div>
    <p className="mt-3 text-sm text-ink dark:text-white/85 font-medium">See your wealth clearly.</p>
    <p className="mt-2 text-sm text-ink-muted/55 dark:text-white/25">
      Private by design. Most people update once after payday.
    </p>

    <div className="mt-7 space-y-2.5 text-sm text-ink-muted/70 dark:text-white/40">
      <p>Net worth dashboard</p>
      <p>Snapshots + milestones</p>
      <p>Multi-currency accounts</p>
      <p>Daily FX checking</p>
      <p>Monthly what-if contribution modelling</p>
      <p>1-year projection</p>
      <p>Up to 3 accounts</p>
    </div>

    <div className="mt-auto pt-8">
      <button
        type="button"
        onClick={() => openAuth('register')}
        className="h-11 px-5 rounded-2xl text-sm font-semibold border border-black/[.08] dark:border-white/[.10] hover:bg-black/[.03] dark:hover:bg-white/[.06] transition-colors text-ink dark:text-white"
      >
        Create account
      </button>
    </div>
  </Card>

  <Card className="p-7 sm:p-8 bg-white/70 dark:bg-white/[.04] backdrop-blur-xl border border-accent/20 dark:border-accent/25 shadow-card flex flex-col h-full">
    <div className="flex items-center justify-between">
      <div className="text-sm font-semibold text-ink dark:text-white">Pro</div>
      <div className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold leading-none bg-accent/10 text-accent dark:bg-accent/15">
        Recommended
      </div>
    </div>

    <div className="mt-3 flex items-baseline gap-1.5">
      <span className="text-3xl font-semibold text-ink dark:text-white tracking-tight">£6</span>
      <span className="text-sm font-semibold text-ink-muted/55 dark:text-white/25">/month</span>
    </div>

    <p className="mt-2 text-sm text-ink-muted/55 dark:text-white/25">
      £60/year (2 months free) · Includes a 7-day trial
    </p>
    <p className="mt-3 text-sm text-ink dark:text-white/90 font-medium">
      See the path, the gap, and the next move.
    </p>
    <p className="mt-2 text-sm text-ink-muted/60 dark:text-white/30">
      Plan 5–40 years ahead, compare scenarios, and understand what it takes to hit your target.
    </p>

    <div className="mt-7 space-y-2.5 text-sm text-ink-muted/70 dark:text-white/40">
      <p>Unlimited accounts</p>
      <p>5–40 year projections</p>
      <p>Full trajectory chart: projected vs required path</p>
      <p>Inflation-adjusted (real terms) view</p>
      <p>One-off deposit modelling</p>
      <p>Optimiser: calculates required monthly contribution</p>
      <p>What-if scenario comparisons</p>
    </div>

    <div className="mt-auto pt-8">
      <Button variant="primary" className="h-11 px-5 rounded-2xl" onClick={() => openAuth('register')}>
        Start free trial
      </Button>
    </div>
  </Card>
</Reveal>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="border-t border-black/[.03] dark:border-white/[.03]">
        <div className="mx-auto max-w-6xl px-5 sm:px-6 py-16 sm:py-20 text-center">
          <Reveal>
            <h2 className="font-display text-3xl sm:text-4xl font-semibold text-ink dark:text-white tracking-tight">
              Wealth isn&apos;t built by accident.
            </h2>
            <p className="mt-4 text-sm sm:text-base text-ink-muted/65 dark:text-white/35 max-w-xl leading-relaxed mx-auto">
              It&apos;s built with clarity, consistency and time. Paddock gives you a calmer way to see the numbers and keep moving.
            </p>

            <div className="mt-8 flex items-center justify-center gap-3">
              <Button variant="primary" className="h-12 px-6 rounded-2xl" onClick={() => openAuth('register')}>
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

            <p className="mt-4 text-xs text-ink-muted/55 dark:text-white/20">
              Free to start • No credit card required
            </p>
          </Reveal>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-black/[.03] dark:border-white/[.03]">
        <div className="mx-auto max-w-6xl px-5 sm:px-6 py-10 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setPage('landing')}
            className="font-display text-lg text-ink dark:text-white tracking-tight font-semibold"
          >
            Paddock<span className="text-accent">.</span>
          </button>

          <div className="flex items-center gap-5 text-xs text-ink-muted/50 dark:text-white/20">
            <button
              type="button"
              onClick={() => setPage('guides_index')}
              className="hover:text-ink dark:hover:text-white/50 transition-colors"
            >
              Guides
            </button>
            <button
              type="button"
              onClick={() => setPage('terms')}
              className="hover:text-ink dark:hover:text-white/50 transition-colors"
            >
              Terms
            </button>
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

      {/* AUTH MODAL */}
      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        initial={authInitial}
        forceMode={forceRecovery ? 'recovery' : null}
      />
    </div>
  )
}
