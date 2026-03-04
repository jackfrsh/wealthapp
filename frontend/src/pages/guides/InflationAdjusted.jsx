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

function Divider() {
  return <div className="my-7 h-px bg-black/[.06] dark:bg-white/[.08]" />
}

export default function InflationAdjustedGuide() {
  const { setPage } = useApp()

  return (
    <div className="min-h-screen bg-surface dark:bg-surface-dark">
      <TopBar title="Guide" />

      <div className="mx-auto max-w-3xl px-5 sm:px-6 py-8 sm:py-10">
        <Card className="p-7 sm:p-8">
          <div className="text-xs font-semibold tracking-[.14em] uppercase text-ink-muted/55 dark:text-white/25">
            Inflation adjusted net worth
          </div>

          <h1 className="mt-3 font-display text-2xl sm:text-3xl font-semibold tracking-tight text-ink dark:text-white">
            Inflation-adjusted net worth: real terms vs nominal
          </h1>

          <p className="mt-3 text-sm text-ink-muted dark:text-white/60 leading-relaxed">
            A projection can look great in “nominal” money while quietly losing purchasing power. Inflation-adjusted
            modelling (real terms) keeps your plan grounded in what your future money can actually buy.
          </p>

          <H2>Nominal: the number on the statement</H2>
          <P>
            Nominal returns describe the growth of your balance in raw currency terms. If your portfolio grows by 7%,
            nominally you have more money.
          </P>

          <H2>Real terms: purchasing power after inflation</H2>
          <P>
            Real returns adjust for inflation. If inflation is 3% and your portfolio returns 7%, your real return is
            roughly 4%. That 4% is what matters for long-term planning.
          </P>

          <Divider />

          <H2>Why this matters for long horizons</H2>
          <P>
            Over 20–40 years, small differences compound. A plan that looks “safe” in nominal terms can be borderline in
            real terms — especially if your target is lifestyle-based (freedom, optionality, time).
          </P>

          <H2>Where Pro fits</H2>
          <P>
            Pro adds inflation-adjusted views so you can see your trajectory in today’s money, alongside one-off deposits
            and longer horizons. It’s built for planning decades ahead with fewer illusions.
          </P>

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
              onClick={() => setPage('guide_long_term_projection')}
              className="block text-left w-full rounded-2xl border border-black/[.06] dark:border-white/[.08] px-4 py-3 hover:bg-black/[.03] dark:hover:bg-white/[.06] transition-colors text-ink dark:text-white"
            >
              How long-term wealth projections work →
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