import React from 'react'
import Card from '../../components/Card'
import Button from '../../components/Button'
import { GuideCTA, GuideLink, GuideShell, H2, P, UL } from '../../components/GuideLayout'
import { useSEO } from '../../useSEO'
import { usePublicNavigation } from '../public/navigation'

const OPTIONS = [
  {
    name: 'Paddock',
    bestFor: 'Private, deliberate wealth tracking',
    method: 'Manual entry',
    focus: 'Total wealth, projections, ISAs, pensions, property, multi-currency',
    privacy: 'No bank connection required',
  },
  {
    name: 'Emma',
    bestFor: 'Automatic spending overview',
    method: 'Open banking',
    focus: 'Budgeting, subscriptions, day-to-day accounts',
    privacy: 'Requires account connections',
  },
  {
    name: 'Moneyhub',
    bestFor: 'Broad automatic aggregation',
    method: 'Open banking',
    focus: 'Connected account aggregation and adviser workflows',
    privacy: 'Requires account connections',
  },
  {
    name: 'Spreadsheet',
    bestFor: 'Maximum manual control',
    method: 'Manual',
    focus: 'Anything you build yourself',
    privacy: 'Local if you keep it local',
  },
]

export default function BestNetWorthAppsUK() {
  const { navigateTo, openPaddock } = usePublicNavigation()

  useSEO({
    title: 'Best Net Worth Tracking Apps UK — Paddock',
    description:
      'A practical comparison of UK net worth tracking apps for ISAs, pensions, savings, property, multi-currency accounts, and privacy.',
    canonicalPath: '/best-net-worth-tracking-apps-uk',
  })

  return (
    <GuideShell
      title="Guide"
      onBack={() => navigateTo('/guides')}
      navigateTo={navigateTo}
    >
      <div className="guide-kicker">UK comparison</div>
      <h1 className="guide-h1">Best net worth tracking apps UK</h1>
      <p className="guide-lead">
        A practical comparison for UK users who want to track wealth across ISAs, pensions,
        savings, property, and multiple currencies, not just spending.
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        {OPTIONS.map((option) => (
          <Card key={option.name} pad="lg">
            <h2 className="font-display text-2xl text-ink dark:text-white">
              {option.name}
            </h2>
            <p className="mt-3 text-sm leading-7 text-ink-muted/90 dark:text-white/50">
              Best for: {option.bestFor}
            </p>
            <div className="mt-5 space-y-3 text-sm leading-6 text-ink-muted/85 dark:text-white/45">
              <div><strong className="text-ink dark:text-white">Entry:</strong> {option.method}</div>
              <div><strong className="text-ink dark:text-white">Focus:</strong> {option.focus}</div>
              <div><strong className="text-ink dark:text-white">Privacy:</strong> {option.privacy}</div>
            </div>
          </Card>
        ))}
      </div>

      <H2>Which is best for you?</H2>
      <P>
        If automatic bank syncing and spending categories are the priority, a budgeting app may
        be a better fit. If the goal is a complete, private balance sheet for long-term wealth,
        Paddock takes a different approach: manual entry, no bank linking, and a product shaped
        around assets, liabilities, and projections.
      </P>

      <H2>Why Paddock is different</H2>
      <UL>
        <li>It is designed for UK wealth accounts: ISAs, SIPPs, savings, property, and liabilities.</li>
        <li>It supports multi-currency tracking without turning your dashboard into a spreadsheet.</li>
        <li>It avoids open banking entirely, so you do not share bank credentials or transaction access.</li>
        <li>It focuses on long-term progress rather than daily transaction noise.</li>
      </UL>

      <H2>Honest trade-offs</H2>
      <P>
        Paddock is not for someone who wants every balance to sync automatically with no input.
        Manual entry takes a little time. The reason to choose it is privacy, control, and a
        more deliberate relationship with the numbers.
      </P>

      <GuideCTA
        onClick={openPaddock}
        buttonText="Create your free account"
      >
        Track your wealth privately, clearly, and without bank linking.
      </GuideCTA>

      <H2>Related</H2>
      <div className="guide-links">
        <GuideLink to="/why-i-track-wealth-manually-instead-of-using-open-banking-apps" navigateTo={navigateTo}>
          Why manual wealth tracking can be better 
        </GuideLink>
        <GuideLink to="/tools/net-worth-calculator" navigateTo={navigateTo}>
          Net worth calculator 
        </GuideLink>
      </div>

      <div className="mt-8">
        <Button variant="secondary" onClick={() => navigateTo('/guides')}>
          Back to guides
        </Button>
      </div>
    </GuideShell>
  )
}
