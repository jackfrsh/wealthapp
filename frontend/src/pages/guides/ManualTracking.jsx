import React from 'react'
import {
  Callout,
  Divider,
  GuideCTA,
  GuideLink,
  GuideShell,
  H2,
  P,
  UL,
} from '../../components/GuideLayout'
import { useSEO } from '../../useSEO'
import { usePublicNavigation } from '../public/navigation'

export default function ManualTracking() {
  const { navigateTo, openPaddock } = usePublicNavigation()

  useSEO({
    title: 'Why I Track Wealth Manually Instead of Using Open Banking Apps — Paddock',
    description:
      'A founder perspective on manual, privacy-first wealth tracking for people with ISAs, pensions, multi-currency accounts, and long-term plans.',
    canonicalPath: '/why-i-track-wealth-manually-instead-of-using-open-banking-apps',
  })

  return (
    <GuideShell
      title="Guide"
      onBack={() => navigateTo('/guides')}
      navigateTo={navigateTo}
    >
      <div className="guide-kicker">Founder perspective</div>
      <h1 className="guide-h1">Why I track wealth manually instead of using open banking apps</h1>
      <p className="guide-lead">
        Automatic syncing is convenient. But as wealth gets spread across pensions, ISAs,
        property, overseas savings, and multiple currencies, a synced total can become an
        incomplete picture presented with too much confidence.
      </p>

      <H2>What open banking tools get right</H2>
      <P>
        Connected tools are genuinely useful for spending awareness. They are good at showing
        where money went last month, spotting subscriptions, and making day-to-day accounts easier
        to scan.
      </P>
      <P>
        That is a different job from long-term wealth tracking. Spending tools are built around
        transactions. Wealth tracking is about the balance sheet: what you own, what you owe, and
        whether the whole position is strengthening over time.
      </P>

      <H2>Where the gaps appear</H2>
      <P>
        Pensions are not always connected. Overseas accounts may be invisible. Property values are
        often estimates. Some investment integrations lag, fail, or include only part of the
        account. The result can look polished while still missing important pieces.
      </P>
      <P>
        The issue is not that automatic tools are bad. It is that they can make it hard to know
        what is included, what is missing, and whether the headline number is trustworthy.
      </P>

      <Callout>
        Deliberate entry is not a workaround for automation. It is a different relationship with
        the numbers, and for serious wealth tracking it can be the calmer one.
      </Callout>

      <H2>Why manual entry changes the habit</H2>
      <P>
        Updating balances manually forces a short review. You touch each account, check the major
        values, and leave with a clearer sense of what changed. That can be more useful than a
        passive feed that updates constantly but explains little.
      </P>
      <P>
        For most people, this does not need to be daily. A monthly update is often enough to keep
        a complete view without turning wealth tracking into noise.
      </P>

      <H2>Who manual tracking suits</H2>
      <UL>
        <li>Your wealth spans ISAs, pensions, cash, investments, property, or overseas accounts.</li>
        <li>You are thinking in years or decades rather than weekly spending categories.</li>
        <li>You care about privacy and would rather not share bank access for every account.</li>
        <li>You have a spreadsheet that works, but it is becoming harder to maintain.</li>
      </UL>

      <Divider />

      <H2>Where Paddock fits</H2>
      <P>
        Paddock is built around this deliberate workflow: manual balances, multi-currency support,
        ISAs and pensions alongside other accounts, and long-term projections without bank linking.
      </P>
      <P>
        If you want full automation above all else, it will not be the right fit. If you want a
        calmer, more private way to maintain a complete wealth picture, that is exactly the point.
      </P>

      <GuideCTA
        onClick={openPaddock}
        buttonText="Try Paddock — it's free"
      >
        Private, manual-entry wealth tracking for ISAs, pensions, savings, property, and
        multi-currency accounts. No bank connection required.
      </GuideCTA>

      <H2>Related</H2>
      <div className="guide-links">
        <GuideLink to="/best-net-worth-tracking-apps-uk" navigateTo={navigateTo}>
          Best net worth tracking apps UK 
        </GuideLink>
        <GuideLink to="/tools/pension-drawdown-calculator" navigateTo={navigateTo}>
          Pension drawdown calculator 
        </GuideLink>
      </div>
    </GuideShell>
  )
}
