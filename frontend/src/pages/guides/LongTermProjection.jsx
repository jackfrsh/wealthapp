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

function H2({ children }) {
  return <h2 className="mt-8 text-base font-semibold text-ink dark:text-white">{children}</h2>
}

function P({ children }) {
  return <p className="mt-3 text-sm text-ink-muted dark:text-white/60 leading-relaxed">{children}</p>
}

function Callout({ children }) {
  return (
    <div className="mt-5 rounded-2xl border border-accent/15 dark:border-accent/20 bg-accent/[.04] dark:bg-accent/[.07] p-4 sm:p-5">
      <div className="text-sm text-ink dark:text-white/85 leading-relaxed">{children}</div>
    </div>
  )
}

export default function LongTermProjectionGuide() {
  const { setPage } = useApp()

  return (
    <div className="min-h-screen bg-surface dark:bg-surface-dark">
      <TopBar title="Guide" />

      <div className="mx-auto max-w-3xl px-5 sm:px-6 py-8 sm:py-10">
        <Card className="p-7 sm:p-8">
          <div className="text-xs font-semibold tracking-[.14em] uppercase text-ink-muted/55 dark:text-white/25">
            Long term wealth projection tool
          </div>

          <h1 className="mt-3 font-display text-2xl sm:text-3xl font-semibold tracking-tight text-ink dark:text-white">
            How long-term wealth projections actually work
          </h1>

          <p className="mt-3 text-sm text-ink-muted dark:text-white/60 leading-relaxed">
            A long-term projection is not a promise — it’s a model. The value is in making assumptions explicit so you
            can see what needs to be true for a target to be achievable.
          </p>

          <H2>The three drivers of a projection</H2>
          <P>
            Most long-horizon projections reduce to three inputs:
            <br />• your starting net worth
            <br />• your contributions over time
            <br />• the rate of return (and fees/drag)
          </P>

          <H2>Why “1 year” is useful — and why it’s limited</H2>
          <P>
            Short horizon projections are great for building the habit and understanding momentum. But the decisions that
            change outcomes — savings rate, risk, time horizon — usually play out over 5–40 years.
          </P>

          <H2>Milestones make the plan feel real</H2>
          <P>
            Milestones are checkpoints that keep the plan grounded. Instead of “someday I’ll have £X”, you can track:
            <br />• first £10k / £50k / £100k
            <br />• halfway-to-target
            <br />• “financially independent” threshold
          </P>

          <H2>Optimisation vs guesswork</H2>
          <P>
            Most people try to hit a target by tweaking numbers randomly. A better approach is to ask one clear question:
            “What contribution rate is required to reach my target, given my horizon and assumptions?”
          </P>

          <Callout>
            Pro exists for this exact use case: longer horizons (5–40 years), inflation-adjusted views, one-off deposits,
            and an Optimiser that tells you the required contribution to hit your target.
          </Callout>

          <H2>Next steps</H2>
          <div className="mt-3 space-y-2 text-sm">
            <button
              type="button"
              onClick={() => setPage('guide_multi_currency')}
              className="block text-left w-full rounded-2xl border border-black/[.06] dark:border-white/[.08] px-4 py-3 hover:bg-black/[.03] dark:hover:bg-white/[.06] transition-colors text-ink dark:text-white"
            >
              Multi-currency tracking explained →
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