import React from 'react'
import { GuideShell, GuideLink } from '../../components/GuideLayout'

export default function GuideIndex({ navigateTo }) {
  return (
    <GuideShell
  title="Guides"
  onBack={() => navigateTo('/')}
  navigateTo={navigateTo}
>
      <h1 className="guide-h1">Guides</h1>

      <p className="guide-lead">
        Clear, practical explanations of how wealth tracking, projections, and long-term
        planning actually work — written for people who want to understand the mechanics,
        not just the marketing.
      </p>

      <div className="guide-links" style={{ marginTop: 24 }}>
        <GuideLink to="/guides/long-term-wealth-projection" navigateTo={navigateTo}>
          How long-term wealth projections work →
        </GuideLink>

        <GuideLink to="/guides/multi-currency-net-worth-tracker" navigateTo={navigateTo}>
          Multi-currency net worth tracking explained →
        </GuideLink>

        <GuideLink to="/guides/inflation-adjusted-net-worth" navigateTo={navigateTo}>
          Inflation-adjusted net worth: real terms vs nominal →
        </GuideLink>
      </div>
    </GuideShell>
  )
}