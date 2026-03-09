import React from 'react'
import { useApp } from '../../App'
import {
  GuideShell,
  H2,
  P,
  Divider,
  GuideLink,
} from '../../components/GuideLayout'

export default function InflationAdjustedGuide() {
  const { setPage } = useApp()

  const navigateTo = (path) => {
    if (path === '/') return setPage('landing')
    if (path === '/guides') return setPage('guides_index')
    if (path === '/guides/multi-currency-net-worth-tracker') return setPage('guide_multi_currency')
    if (path === '/guides/long-term-wealth-projection') return setPage('guide_long_term_projection')
    if (path === '/guides/inflation-adjusted-net-worth') return setPage('guide_inflation_adjusted')
    if (path === '/privacy') return setPage('privacy')
    if (path === '/security') return setPage('security')
    if (path === '/terms') return setPage('terms')
  }

  return (
    <GuideShell
      title="Guide"
      onBack={() => setPage('guides_index')}
      navigateTo={navigateTo}
    >
      <div className="guide-kicker">Inflation-adjusted net worth</div>

      <h1 className="guide-h1">Inflation-adjusted net worth: real terms vs nominal</h1>

      <p className="guide-lead">
        A projection can look great in nominal money while quietly losing purchasing power.
        Inflation-adjusted modelling keeps your plan grounded in what your future money can
        actually buy.
      </p>

      <H2>Nominal: the number on the statement</H2>
      <P>
        Nominal returns describe the growth of your balance in raw currency terms. If your
        portfolio grows by 7%, nominally you have more money.
      </P>

      <H2>Real terms: purchasing power after inflation</H2>
      <P>
        Real returns adjust for inflation. If inflation is 3% and your portfolio returns 7%,
        your real return is roughly 4%. That is the number that matters for long-term planning.
      </P>

      <Divider />

      <H2>Why this matters for long horizons</H2>
      <P>
        Over 20–40 years, small differences compound. A plan that looks safe in nominal terms
        can be borderline in real terms — especially if your target is based on freedom,
        optionality, or lifestyle.
      </P>

      <H2>Where Pro fits</H2>
      <P>
        Pro adds inflation-adjusted views so you can see your trajectory in today’s money,
        alongside one-off deposits and longer horizons. It’s built for planning decades ahead
        with fewer illusions.
      </P>

      <H2>Next steps</H2>
      <div className="guide-links">
        <GuideLink to="/guides/multi-currency-net-worth-tracker" navigateTo={navigateTo}>
          Multi-currency tracking explained →
        </GuideLink>
        <GuideLink to="/guides/long-term-wealth-projection" navigateTo={navigateTo}>
          How long-term wealth projections work →
        </GuideLink>
      </div>
    </GuideShell>
  )
}