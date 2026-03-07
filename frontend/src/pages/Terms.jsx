// frontend/src/pages/Terms.jsx
import React, { useCallback } from 'react'
import { useApp } from '../App'
import Card from '../components/Card'
import { ArrowLeft } from 'lucide-react'
import { useSEO } from '../useSEO'

export default function Terms() {
  const { setPage, authed } = useApp()

  useSEO({
    title: 'Terms — Paddock',
    description:
      'Terms of Service for Paddock. We offer a free tier with limited features and a paid Pro subscription.',
    canonicalPath: '/terms',
  })

  const handleClose = useCallback(() => {
    try {
      if (window.history.length > 1) {
        window.history.back()
        return
      }
    } catch {}

    setPage(authed ? 'home' : 'landing')
  }, [authed, setPage])

  const Section = ({ title, children }) => (
    <div className="mt-8 first:mt-0">
      <h2 className="text-base font-semibold text-ink dark:text-white mb-3">{title}</h2>
      <div className="space-y-3 text-sm text-ink-muted dark:text-white/40 leading-relaxed">
        {children}
      </div>
    </div>
  )

  return (
    <div className="min-h-screen px-4 sm:px-6 lg:px-8 py-10 bg-surface dark:bg-surface-dark">
      <div className="mx-auto max-w-3xl space-y-6">
        <button
          type="button"
          onClick={handleClose}
          className="inline-flex items-center gap-2 text-sm font-semibold text-ink-muted dark:text-white/40 hover:text-ink dark:hover:text-white transition-colors"
        >
          <ArrowLeft size={16} /> Back
        </button>

        <Card className="p-8 sm:p-10">
          <h1 className="font-display text-3xl text-ink dark:text-white tracking-tight">
            Terms of Service
          </h1>
          <p className="mt-2 text-xs text-ink-muted/50 dark:text-white/25">
            Last updated: 1 March 2026
          </p>

          <div className="mt-6 space-y-3 text-sm text-ink-muted dark:text-white/40 leading-relaxed">
            <p>
              These Terms of Service (&quot;Terms&quot;) govern your use of Paddock (the
              &quot;Service&quot;). By creating an account or using the Service, you agree
              to these Terms.
            </p>
            <p>
              Paddock is currently operated by an individual in the United Kingdom. We
              may update our legal/trading details as the business is formally set up. If
              you have questions, contact us at{' '}
              <a
                href="mailto:hello@getpaddock.com"
                className="text-accent hover:underline font-medium"
              >
                hello@getpaddock.com
              </a>
              .
            </p>
          </div>

          <div className="mt-8 divide-y divide-black/[.06] dark:divide-white/[.06]">
            <Section title="1. What Paddock is">
              <p>
                Paddock is a personal net worth tracker and wealth dashboard. You enter
                account balances manually, and Paddock calculates your total net worth,
                tracks changes over time, and models long-term projections based on
                assumptions you provide.
              </p>
              <p>
                Paddock is not a financial advisor, investment platform, or bank. We do
                not provide financial advice, execute trades, or hold your money. The
                projections and insights shown are estimates based on your inputs and
                should not be relied upon as financial guidance.
              </p>
            </Section>

            <Section title="2. Your account">
              <p>
                You must provide a valid email address to create an account. You are
                responsible for maintaining the security of your account credentials.
              </p>
              <p>You must be at least 18 years old to use Paddock.</p>
              <p>
                You must not use automated tools to create accounts, attempt to access
                other users&apos; data, or otherwise abuse the Service, including trials,
                limits, or pricing.
              </p>
            </Section>

            <Section title="3. Free and Pro plans">
              <p>
                Paddock offers a free tier with limited features and a paid Pro
                subscription. Pro is billed monthly or annually through Stripe. Prices
                are displayed at checkout.
              </p>
              <p>
                We may change prices from time to time. If you are an existing subscriber,
                we will provide at least 30 days&apos; notice of any price change, and any
                change will take effect at your next renewal.
              </p>
              <p>
                Annual plans may include a free trial period. You can cancel at any time
                through the billing portal in Settings. Cancellations take effect at the
                end of your current billing period.
              </p>
              <p>
                Except where required by law, we do not provide partial refunds for unused
                time.
              </p>
              <p>
                If payment fails, we may retry collection. If payment remains unsuccessful,
                your account may be downgraded to the free tier. Your data is preserved —
                you can re-subscribe at any time.
              </p>
            </Section>

            <Section title="4. Your data">
              <p>
                You own the data you enter into Paddock. We store it to provide the
                Service and do not sell your financial data. See our{' '}
                <button
                  type="button"
                  onClick={() => setPage('privacy')}
                  className="text-accent hover:underline font-medium"
                >
                  Privacy Policy
                </button>{' '}
                for details on how we handle personal data.
              </p>
              <p>
                You can request deletion of your account and associated personal data at
                any time by contacting us. We aim to delete or anonymise your data within
                30 days, except where we need to keep certain records for legal,
                accounting, or security reasons, for example billing records.
              </p>
            </Section>

            <Section title="5. Acceptable use">
              <p>
                You agree not to reverse-engineer or scrape the Service, use automated
                tools to create accounts or submit data, attempt to access other users&apos;
                data, or use Paddock for any illegal purpose.
              </p>
              <p>
                We reserve the right to suspend or terminate accounts that violate these
                Terms.
              </p>
            </Section>

            <Section title="6. Accuracy and limitations">
              <p>
                Paddock relies on data you enter. We do not verify the accuracy of your
                balances, and net worth calculations are only as accurate as the data you
                provide.
              </p>
              <p>
                Foreign exchange rates are approximate and sourced from third-party
                providers. They may differ from rates offered by your bank or broker.
              </p>
              <p>
                Projections use simplified compound growth models and do not account for
                taxes, fees, or market volatility, and may not account for inflation unless
                you explicitly enable an inflation setting. They are planning tools, not
                predictions.
              </p>
            </Section>

            <Section title="7. Service availability">
              <p>
                We aim for high availability but do not guarantee uninterrupted access.
                Maintenance windows, infrastructure issues, or third-party outages may
                temporarily affect the Service.
              </p>
              <p>
                To the extent permitted by law, we are not responsible for losses arising
                from service interruptions or the unavailability of the Service.
              </p>
            </Section>

            <Section title="8. Limitation of liability">
              <p>
                Nothing in these Terms excludes or limits liability where it would be
                unlawful to do so, including for fraud, or for death or personal injury
                caused by our negligence.
              </p>
              <p>
                To the maximum extent permitted by law, Paddock and its operator are not
                liable for any indirect, incidental, or consequential damages arising from
                your use of the Service, including financial decisions made based on data
                displayed in Paddock.
              </p>
              <p>
                Our total liability for any claim related to the Service is limited to the
                amount you paid for Pro in the 12 months preceding the claim, or £50,
                whichever is greater.
              </p>
              <p>
                Nothing in these Terms affects your statutory rights as a consumer.
              </p>
            </Section>

            <Section title="9. Changes to these terms">
              <p>
                We may update these Terms from time to time. Material changes will be
                communicated via email or an in-app notice at least 14 days before taking
                effect. Continued use of Paddock after changes take effect constitutes
                acceptance.
              </p>
            </Section>

            <Section title="10. Governing law">
              <p>
                These Terms are governed by the laws of England and Wales. Any disputes
                will be subject to the exclusive jurisdiction of the courts of England and
                Wales.
              </p>
            </Section>

            <Section title="Contact">
              <p>
                Questions about these Terms? Email us at{' '}
                <a
                  href="mailto:hello@getpaddock.com"
                  className="text-accent hover:underline font-medium"
                >
                  hello@getpaddock.com
                </a>
              </p>
            </Section>
          </div>
        </Card>
      </div>
    </div>
  )
}