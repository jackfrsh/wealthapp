import React from 'react'
import { GuideShell, H2, P } from '../components/GuideLayout'

export default function Security({ navigateTo }) {
  return (
    <GuideShell
      title="Security"
      onBack={() => navigateTo('/')}
      navigateTo={navigateTo}
      backLabel="Back to Paddock"
    >
      <div className="guide-kicker">Security</div>
      <h1 className="guide-h1">Security at Paddock</h1>

      <p className="guide-lead">
        Paddock is designed to feel calm and simple on the surface, but the
        foundations are built to be trustworthy. Security is part of the product,
        not an afterthought.
      </p>

      <H2>Secure authentication</H2>
      <P>
        Sign-in, password reset, and session management are handled through
        industry-standard authentication infrastructure. Credentials are never stored
        in plain text, and sessions are managed with modern security practices.
      </P>

      <H2>Payments handled by Stripe</H2>
      <P>
        All billing and subscription management is processed by Stripe. Your card
        details are handled entirely within Stripe&apos;s PCI-compliant environment —
        they never touch Paddock&apos;s servers.
      </P>

      <H2>Minimal data surface</H2>
      <P>
        Paddock is designed around manual input rather than mandatory bank linking.
        This means fewer connected financial accounts, fewer integrations, and a
        smaller surface area where trust needs to be extended.
      </P>

      <H2>Encrypted in transit</H2>
      <P>
        All connections to Paddock are encrypted using HTTPS. Data is transmitted
        securely between your browser and our servers at all times.
      </P>

      <H2>Conservative by design</H2>
      <P>
        The product is deliberately built with fewer moving parts, fewer third-party
        integrations, and fewer places where data is exposed. This is a deliberate
        design choice — simplicity reduces risk.
      </P>

      <H2>Contact</H2>
      <P>
        If you have questions about security at Paddock, you can reach us at
        hello@getpaddock.com.
      </P>
    </GuideShell>
  )
}