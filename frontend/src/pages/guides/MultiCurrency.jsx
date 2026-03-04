import React from 'react'
import { X } from 'lucide-react'
import { useApp } from '../../App'
import Card from '../../components/Card'

function TopBar({ title }) {
  const { setPage } = useApp()
  return (
    <div className="sticky top-0 z-20 bg-white/70 dark:bg-surface-dark/70 backdrop-blur-xl border-b border-black/[.05] dark:border-white/[.06]">
      <div className="mx-auto max-w-3xl px-5 sm:px-6 h-14 flex items-center justify-between">
        <div className="w-10" />
        <div className="text-sm font-semibold text-ink dark:text-white">{title}</div>
        <button
          type="button"
          onClick={() => setPage('landing')}
          className="w-10 h-10 grid place-items-center rounded-2xl border border-black/[.06] dark:border-white/[.08] hover:bg-black/[.03] dark:hover:bg-white/[.06] transition-colors"
          aria-label="Close"
          title="Close"
        >
          <X size={18} className="text-ink dark:text-white" />
        </button>
      </div>
    </div>
  )
}

function ProTip({ children }) {
  return (
    <div className="rounded-2xl border border-black/[.06] dark:border-white/[.08] bg-black/[.02] dark:bg-white/[.04] p-4 sm:p-5">
      <div className="text-xs font-semibold tracking-wide uppercase text-ink-muted/60 dark:text-white/30">
        Pro tip
      </div>
      <div className="mt-2 text-sm text-ink dark:text-white/80 leading-relaxed">{children}</div>
    </div>
  )
}

function H2({ children }) {
  return <h2 className="mt-8 text-base font-semibold text-ink dark:text-white">{children}</h2>
}

function P({ children }) {
  return <p className="mt-3 text-sm text-ink-muted dark:text-white/60 leading-relaxed">{children}</p>
}

export default function MultiCurrencyGuide() {
  const { setPage } = useApp()

  return (
    <div className="min-h-screen bg-surface dark:bg-surface-dark">
      <TopBar title="Guide" />

      <div className="mx-auto max-w-3xl px-5 sm:px-6 py-8 sm:py-10">
        <Card className="p-7 sm:p-8">
          <div className="text-xs font-semibold tracking-[.14em] uppercase text-ink-muted/55 dark:text-white/25">
            Multi currency net worth tracker
          </div>

          <h1 className="mt-3 font-display text-2xl sm:text-3xl font-semibold tracking-tight text-ink dark:text-white">
            Multi-currency net worth tracking explained
          </h1>

          <p className="mt-3 text-sm text-ink-muted dark:text-white/60 leading-relaxed">
            If you hold assets in more than one currency — a USD brokerage, EUR cash, overseas property, or crypto — a
            normal “single-currency” tracker quickly becomes misleading. A multi-currency net worth tracker keeps your
            totals consistent by converting everything into one base currency using up-to-date exchange rates.
          </p>

          <ProTip>
            The goal isn’t to predict FX perfectly — it’s to keep your dashboard and projections internally consistent so
            you can make decisions with clarity.
          </ProTip>

          <H2>Why multi-currency totals go wrong</H2>
          <P>
            Without conversion, totals are not totals — they’re a pile of numbers in different units. Even if you convert
            manually once, your net worth can drift simply because FX rates move daily. That makes month-to-month progress
            hard to trust.
          </P>

          <H2>What a good multi-currency tracker should do</H2>
          <P>
            A solid approach is simple:
            <br />• Pick a base currency (e.g. GBP)
            <br />• Convert each account balance into that base using a daily rate
            <br />• Keep your totals, milestones, and projections in the same base currency
          </P>

          <H2>Who this matters for</H2>
          <P>
            Multi-currency tracking is especially valuable if you:
            <br />• get paid in a foreign currency
            <br />• invest via US platforms
            <br />• hold overseas cash or property
            <br />• plan to relocate in the next 5–10 years
          </P>

          <H2>How Paddock handles it</H2>
          <P>
            Paddock is designed for deliberate planning: manual input, multi-currency accounts, and daily FX checking so
            your dashboard totals and 1-year projection remain coherent. Pro expands this into long-horizon modelling with
            inflation adjustment and optimisation.
          </P>

          <H2>Next steps</H2>
          <div className="mt-3 space-y-2 text-sm">
            <button
              type="button"
              onClick={() => setPage('guide_long_term_projection')}
              className="block text-left w-full rounded-2xl border border-black/[.06] dark:border-white/[.08] px-4 py-3 hover:bg-black/[.03] dark:hover:bg-white/[.06] transition-colors text-ink dark:text-white"
            >
              How long-term wealth projections work →
            </button>
            <button
              type="button"
              onClick={() => setPage('guide_inflation_adjusted')}
              className="block text-left w-full rounded-2xl border border-black/[.06] dark:border-white/[.08] px-4 py-3 hover:bg-black/[.03] dark:hover:bg-white/[.06] transition-colors text-ink dark:text-white"
            >
              Inflation-adjusted net worth explained →
            </button>
          </div>
        </Card>

        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={() => setPage('landing')}
            className="h-11 px-6 rounded-2xl text-sm font-semibold border border-black/[.08] dark:border-white/[.10] hover:bg-black/[.03] dark:hover:bg-white/[.06] transition-colors text-ink dark:text-white"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}