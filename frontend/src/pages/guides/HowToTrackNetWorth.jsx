import React from 'react'
import SiteFooter from '../../components/SiteFooter'

function SectionLabel({ children }) {
  return <div className="section-label">{children}</div>
}

export default function HowToTrackNetWorth({ navigateTo }) {
  return (
    <div className="landing-shell">
      <section className="hero-section hero-section-guide">
        <div className="container">
          <div className="page-topbar">
            <button
              type="button"
              onClick={() => navigateTo('/')}
              className="brand page-brand page-brand-lg"
              aria-label="Go to home"
            >
              Paddock<span>.</span>
            </button>

            <button
              type="button"
              className="guide-back-link"
              onClick={() => navigateTo('/')}
            >
              Back to home
            </button>
          </div>

          <div className="hero-copy">
            <div className="hero-kicker">Guide</div>

            <h1>
              How to track your net worth.
              <br />
              Clearly.
            </h1>

            <p className="hero-sub">
              A practical framework for understanding what you own, what you owe, and whether your
              wealth is actually moving in the right direction over time.
            </p>

            <div className="hero-actions">
              <a href="https://app.getpaddock.com/auth?mode=signup" className="btn btn-primary">
                Try Paddock
              </a>

              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => navigateTo('/net-worth-tracker')}
              >
                View net worth page
              </button>
            </div>

            <div className="hero-tags">
              <span>What to include</span>
              <span>How often to update</span>
              <span>Why trends matter</span>
              <span>Manual by design</span>
            </div>
          </div>
        </div>
      </section>

      <section className="container section">
        <SectionLabel>Framework</SectionLabel>
        <h2>Start with the right definition.</h2>
        <p className="section-copy narrow">
          Net worth is usually your assets minus your liabilities. Assets may include cash,
          investments, pensions, property and other major holdings. Liabilities may include a
          mortgage, loans, credit balances or other debts.
        </p>

        <div className="split-columns">
          <div>
            <h3>List what you own.</h3>
            <div className="line" />
            <p>
              Include the accounts and assets that genuinely contribute to long-term wealth, such as
              cash, investments, pensions and property.
            </p>
          </div>

          <div>
            <h3>List what you owe.</h3>
            <div className="line" />
            <p>
              Include liabilities that meaningfully affect the total, such as mortgages, loans or
              other debt balances.
            </p>
          </div>

          <div>
            <h3>Focus on the direction.</h3>
            <div className="line" />
            <p>
              The number itself matters, but the trend matters more. What you are really tracking is
              whether your wealth is moving steadily in the right direction.
            </p>
          </div>
        </div>
      </section>

      <section className="section-border">
        <div className="container section two-col">
          <div>
            <SectionLabel>Cadence</SectionLabel>
            <h2>Consistency matters more than frequency.</h2>
            <p className="section-copy narrow">
              A monthly review done properly is usually more useful than constant checking. Wealth
              compounds slowly. The point of tracking is to stay oriented, not to create more noise.
            </p>
            <p className="section-copy narrow">
              For most people, monthly is enough to stay current without turning wealth tracking into
              another source of friction.
            </p>
          </div>

          <div>
            <SectionLabel>Why Paddock</SectionLabel>
            <h2>Why manual tracking can help.</h2>
            <p className="section-copy narrow">
              Manual tracking encourages intentional review. It lets you decide what belongs in your
              picture, when to update it, and how often to look. That can be a better fit for
              long-term wealth than a product built to stream constant account activity.
            </p>
            <p className="section-copy narrow">
              For Paddock, that is part of the design philosophy. The product aims to feel calm,
              private and trustworthy rather than noisy.
            </p>
          </div>
        </div>
      </section>

      <section className="section-border">
        <div className="container section">
          <SectionLabel>Related pages</SectionLabel>
          <h2>Explore related guides and pages.</h2>
          <p className="section-copy">
            Keep moving through the core ideas behind structured wealth tracking.
          </p>

          <div className="use-links-grid use-links-grid-3">
            <button
              type="button"
              className="use-link-item"
              onClick={() => navigateTo('/net-worth-tracker')}
            >
              <h3>Net worth tracking</h3>
              <div className="line" />
              <p>See the full picture in one premium dashboard built for long-term wealth.</p>
            </button>

            <button
              type="button"
              className="use-link-item"
              onClick={() => navigateTo('/track-isas-pensions-savings')}
            >
              <h3>Track ISAs and pensions</h3>
              <div className="line" />
              <p>Bring key UK wealth accounts together in a single calm view.</p>
            </button>

            <button
              type="button"
              className="use-link-item"
              onClick={() => navigateTo('/spreadsheet-alternative-net-worth-tracking')}
            >
              <h3>Replace spreadsheets</h3>
              <div className="line" />
              <p>Replace fragile financial workbooks with a clearer structured workflow.</p>
            </button>
          </div>
        </div>
      </section>

      <section className="section-border">
        <div className="container section">
          <SectionLabel>FAQ</SectionLabel>
          <h2>Common questions.</h2>

          <div className="faq-grid">
            <div className="faq-card">
              <h3>Should I include my pension in net worth?</h3>
              <p>
                Many people do, because pensions are often one of the biggest parts of long-term
                wealth. The important thing is to use a consistent approach over time.
              </p>
            </div>

            <div className="faq-card">
              <h3>Should I include my home?</h3>
              <p>
                You can. If property is a meaningful part of your balance sheet, including it can
                make the picture more complete. Consistency is what matters most.
              </p>
            </div>

            <div className="faq-card">
              <h3>How often should I track my net worth?</h3>
              <p>
                Monthly is usually enough. That cadence is often frequent enough to stay aware
                without turning wealth tracking into constant checking.
              </p>
            </div>

            <div className="faq-card">
              <h3>Do I need automatic bank syncing?</h3>
              <p>
                No. For long-term wealth tracking, manual updates can often be enough, especially
                when the goal is clarity rather than live transaction monitoring.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="section-border">
        <div className="container final-cta">
          <h2>Build a clearer net worth habit.</h2>
          <p className="section-copy center narrow-center">
            Track what matters, review it consistently, and keep your long-term direction visible.
          </p>

          <div className="hero-actions center">
            <a href="https://app.getpaddock.com/auth?mode=signup" className="btn btn-primary">
              Try Paddock
            </a>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => navigateTo('/net-worth-tracker')}
            >
              View net worth page
            </button>
          </div>
        </div>
      </section>

      <SiteFooter navigateTo={navigateTo} />
    </div>
  )
}
