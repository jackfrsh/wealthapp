import React from 'react'
import {
  GuideShell,
  H2,
  P,
  UL,
  Callout,
  GuideLink,
} from '../../components/GuideLayout'
import { usePublicNavigation } from '../public/navigation'

export default function LongTermProjectionGuide() {
  const { navigateTo } = usePublicNavigation()

  return (
    <GuideShell
      title="Guide"
      onBack={() => navigateTo('/guides')}
      navigateTo={navigateTo}
    >
      <div className="guide-kicker">Long-term wealth projection tool</div>

      <h1 className="guide-h1">How long-term wealth projections actually work</h1>

      <p className="guide-lead">
        A long-term projection is not a promise — it’s a model. The value is in making
        assumptions explicit so you can see what needs to be true for a target to be achievable.
      </p>

      <H2>The three drivers of a projection</H2>
      <UL>
        <li>Your starting net worth.</li>
        <li>Your contributions over time.</li>
        <li>Your rate of return, including fees or drag.</li>
      </UL>

      <H2>Why 1 year is useful — and why it’s limited</H2>
      <P>
        Short horizon projections are great for building the habit and understanding momentum.
        But the decisions that really change outcomes — savings rate, risk, and time horizon —
        usually play out over 5–40 years.
      </P>

      <H2>Milestones make the plan feel real</H2>
      <UL>
        <li>First £10k / £50k / £100k.</li>
        <li>Halfway to target.</li>
        <li>A financial-independence threshold.</li>
      </UL>

      <H2>Optimisation vs guesswork</H2>
      <P>
        Most people try to hit a target by tweaking numbers randomly. A better question is:
        what contribution rate is required to reach the target, given your horizon and assumptions?
      </P>

      <Callout>
        Pro exists for this exact use case: longer horizons, inflation-adjusted views, one-off
        deposits, and an Optimiser that tells you the required contribution to hit your target.
      </Callout>

      <H2>Next steps</H2>
      <div className="guide-links">
        <GuideLink to="/guides/multi-currency-net-worth-tracker" navigateTo={navigateTo}>
          Multi-currency tracking explained 
        </GuideLink>
        <GuideLink to="/guides/inflation-adjusted-net-worth" navigateTo={navigateTo}>
          Inflation-adjusted net worth explained 
        </GuideLink>
      </div>
    </GuideShell>
  )
}
