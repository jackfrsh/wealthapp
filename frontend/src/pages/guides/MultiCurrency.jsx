import React from 'react'
import { useApp } from '../../App'
import {
  GuideShell,
  H2,
  P,
  UL,
  ProTip,
  GuideLink,
} from '../../components/GuideLayout'

export default function MultiCurrencyGuide() {
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
      <div className="guide-kicker">Multi-currency net worth tracker</div>

      <h1 className="guide-h1">Multi-currency net worth tracking explained</h1>

      <p className="guide-lead">
        If you hold assets in more than one currency — a USD brokerage, EUR cash, overseas
        property, or crypto — a normal single-currency tracker quickly becomes misleading.
        A multi-currency net worth tracker keeps your totals consistent by converting everything
        into one base currency using up-to-date exchange rates.
      </p>

      <ProTip>
        The goal isn’t to predict FX perfectly — it’s to keep your dashboard and projections
        internally consistent so you can make decisions with clarity.
      </ProTip>

      <H2>Why multi-currency totals go wrong</H2>
      <P>
        Without conversion, totals are not totals — they’re a pile of numbers in different
        units. Even if you convert manually once, your net worth can drift simply because FX
        rates move daily. That makes month-to-month progress hard to trust.
      </P>

      <H2>What a good multi-currency tracker should do</H2>
      <UL>
        <li>Pick a base currency, such as GBP.</li>
        <li>Convert each account balance into that base using a daily rate.</li>
        <li>Keep totals, milestones, and projections in the same base currency.</li>
      </UL>

      <H2>Who this matters for</H2>
      <UL>
        <li>People paid in a foreign currency.</li>
        <li>Investors using US platforms.</li>
        <li>People with overseas cash or property.</li>
        <li>Anyone planning to relocate in the next 5–10 years.</li>
      </UL>

      <H2>How Paddock handles it</H2>
      <P>
        Paddock is designed for deliberate planning: manual input, multi-currency accounts,
        and daily FX checking so your dashboard totals and 1-year projection remain coherent.
        Pro expands this into long-horizon modelling with inflation adjustment and optimisation.
      </P>

      <H2>Next steps</H2>
      <div className="guide-links">
        <GuideLink to="/guides/long-term-wealth-projection" navigateTo={navigateTo}>
          How long-term wealth projections work →
        </GuideLink>
        <GuideLink to="/guides/inflation-adjusted-net-worth" navigateTo={navigateTo}>
          Inflation-adjusted net worth explained →
        </GuideLink>
      </div>
    </GuideShell>
  )
}