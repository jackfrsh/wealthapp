import React from 'react'
import Card from '../components/Card'
import { GuideShell, H2, P, UL } from '../components/GuideLayout'
import { useSEO } from '../useSEO'
import { usePublicNavigation } from './public/navigation'

export default function Support() {
  const { navigateTo } = usePublicNavigation()

  useSEO({
    title: 'Support — Paddock',
    description:
      'Contact Paddock support for account, billing, bug report, and general product questions.',
    canonicalPath: '/support',
  })

  return (
    <GuideShell
      title="Support"
      onBack={() => navigateTo('/')}
      navigateTo={navigateTo}
      backLabel="Back to Paddock"
    >
      <div className="guide-kicker">Support</div>
      <h1 className="guide-h1">Help with Paddock</h1>
      <p className="guide-lead">
        Need help with your account, billing, or something that does not look right? Email us
        and we will take a look.
      </p>

      <Card pad="lg">
        <H2>Contact support</H2>
        <P>The best way to reach us is by email. Include as much detail as you can so we can help quickly.</P>
        <a
          href="mailto:hello@getpaddock.com"
          className="guide-inline-link text-lg font-semibold"
        >
          hello@getpaddock.com
        </a>
      </Card>

      <H2>Good things to include</H2>
      <UL>
        <li>What happened.</li>
        <li>What you expected to happen.</li>
        <li>Your device model and app/browser version.</li>
        <li>Screenshots, if helpful.</li>
      </UL>

      <H2>We can help with</H2>
      <UL>
        <li>Account access.</li>
        <li>Billing and subscriptions.</li>
        <li>Bug reports.</li>
        <li>General product questions.</li>
      </UL>
    </GuideShell>
  )
}
