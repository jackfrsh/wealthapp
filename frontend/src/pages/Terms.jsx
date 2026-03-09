import React from 'react'
import { GuideShell, H2, P } from '../components/GuideLayout'

export default function Terms({ navigateTo }) {
  return (
    <GuideShell
      title="Terms"
      onBack={() => navigateTo('/')}
      navigateTo={navigateTo}
      backLabel="Back to Paddock"
    >
      <div className="guide-kicker">Terms</div>
      <h1 className="guide-h1">Terms of use</h1>

      <p className="guide-lead">
        Paddock is an informational tool designed to help you track wealth, model
        progress, and plan more deliberately. It is not personal financial advice,
        regulated investment advice, or a guarantee of future outcomes.
      </p>

      <H2>Nature of the product</H2>
      <P>
        Paddock provides dashboards, projections, milestones, and planning tools
        based on the information you enter and the assumptions used in the model.
        Outputs are intended to support understanding and planning — not to replace
        professional financial judgement.
      </P>

      <H2>No guarantee of outcomes</H2>
      <P>
        Projections are estimates only. Markets move, inflation changes, exchange
        rates vary, and personal circumstances evolve. A projection should be
        understood as a model, not a promise.
      </P>

      <H2>User responsibility</H2>
      <P>
        You are responsible for the accuracy of the information you enter and for how
        you use the output. Decisions about saving, investing, borrowing, tax,
        retirement, or financial planning remain your responsibility.
      </P>

      <H2>Accounts and subscriptions</H2>
      <P>
        Account access is managed through secure authentication infrastructure. Paid
        plans and subscriptions are processed by Stripe. Trial terms, pricing, and
        cancellation options are presented clearly within the product.
      </P>

      <H2>Availability</H2>
      <P>
        Paddock is provided on an as-is basis. While we work to keep the service
        reliable and available, we do not guarantee uninterrupted access. We may
        update, modify, or discontinue features as the product evolves.
      </P>

      <H2>Changes to these terms</H2>
      <P>
        These terms may be updated from time to time. Continued use of Paddock after
        changes are published constitutes acceptance of the revised terms.
      </P>

      <H2>Contact</H2>
      <P>
        If you have questions about these terms, you can reach us at
        hello@getpaddock.com.
      </P>
    </GuideShell>
  )
}