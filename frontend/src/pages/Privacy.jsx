import React from 'react'
import { GuideShell, H2, P } from '../components/GuideLayout'

export default function Privacy({ navigateTo }) {
  return (
    <GuideShell
      title="Privacy"
      onBack={() => navigateTo('/')}
      navigateTo={navigateTo}
      backLabel="Back to Paddock"
    >
      <div className="guide-kicker">Privacy</div>
      <h1 className="guide-h1">Privacy at Paddock</h1>

      <p className="guide-lead">
        Paddock is designed to help you understand your wealth without turning your
        data into a product. Data collection is minimal, product decisions are
        straightforward, and the ad-driven patterns common in consumer finance tools
        have no place here.
      </p>

      <H2>Built around privacy</H2>
      <P>
        Paddock is built around manual input, clear modelling, and a private dashboard
        experience. The product exists to help you track and plan with intention — not
        to maximise engagement through advertising or unnecessary data collection.
      </P>

      <H2>No advertising model</H2>
      <P>
        Paddock is not supported by third-party advertising. There are no ad networks,
        no tracking pixels, and no data shared with advertisers. The experience is
        designed to remain focused, calm, and free from ad clutter.
      </P>

      <H2>No bank linking</H2>
      <P>
        Paddock does not require bank connections to function. You can build and
        maintain your wealth model without granting access to your financial accounts.
        Your data stays under your control.
      </P>

      <H2>Authentication and billing</H2>
      <P>
        Account sign-in and password management are handled through industry-standard
        authentication infrastructure with secure session handling. Billing and
        subscription management are processed by Stripe. These services support secure
        access and paid plans — they are not used to build an advertising profile or
        share data with third parties.
      </P>

      <H2>Data handling</H2>
      <P>
        The information you enter into Paddock — account balances, goals, and planning
        assumptions — is stored securely and used solely to power your dashboard and
        projections. It is not sold, shared with third parties, or used for purposes
        beyond operating the product.
      </P>

      <H2>Contact</H2>
      <P>
        If you have questions about how Paddock handles your data, you can reach us at
        hello@getpaddock.com.
      </P>
    </GuideShell>
  )
}