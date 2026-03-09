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
            <div className="hero-kicker">Net worth tracking</div>

            <h1>
              A net worth tracker.
              <br />
              For long-term wealth.
            </h1>

            <p className="hero-sub">
              Track cash, investments, pensions, property and liabilities in one calm dashboard —
              with long-term projections, visible progress, and privacy-first manual tracking.
            </p>

            <div className="hero-actions">
              <a href="https://app.getpaddock.com/auth?mode=signup" className="btn btn-primary">
                Create account
              </a>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => navigateTo('/')}
              >
                Back to home
              </button>
            </div>

            <div className="hero-tags">
              <span>Cash, investments and pensions</span>
              <span>Assets and liabilities together</span>
              <span>No ads</span>
              <span>No bank linking</span>
            </div>
          </div>
        </div>
      </section>

      <section className="container section">
        <SectionLabel>Overview</SectionLabel>
        <h2>See your full financial picture in one place.</h2>
        <p className="section-copy narrow">
          Paddock is built for people whose wealth is spread across more than one account, provider
          or asset type. Instead of checking cash in one place, investments in another, pensions
          somewhere else, and liabilities separately, you can keep the full picture together in one
          structured view.
        </p>

        <div className="split-columns">
          <div>
            <h3>Track total wealth clearly.</h3>
            <div className="line" />
            <p>
              Net worth is not just a single account balance. It is the relationship between what
              you own, what you owe, and whether your overall position is moving in the right
              direction over time.
            </p>
          </div>

          <div>
            <h3>Stay focused on long-term progress.</h3>
            <div className="line" />
            <p>
              The point is not to create more daily financial noise. The point is to maintain a
              clear and consistent view of whether your wealth is strengthening over time.
            </p>
          </div>

          <div>
            <h3>Keep control with manual tracking.</h3>
            <div className="line" />
            <p>
              Manual entry is part of the product identity. It keeps the experience lighter, more
              deliberate, and more private than a product built around constant account syncing.
            </p>
          </div>
        </div>
      </section>

      <section className="section-border">
        <div className="container section two-col">
          <div>
            <SectionLabel>What to include</SectionLabel>
            <h2>What counts toward net worth?</h2>
            <p className="section-copy narrow">
              Net worth is usually the value of your assets minus your liabilities. For many people,
              that includes cash savings, investment accounts, pensions, property and other major
              assets on one side, with mortgages, loans, credit balances or other liabilities on the
              other.
            </p>
            <p className="section-copy narrow">
              The goal is not to chase a perfect daily number. It is to maintain a calm, consistent
              view that helps you understand the bigger picture.
            </p>
          </div>

          <div>
            <SectionLabel>Why Paddock</SectionLabel>
            <h2>Why manual tracking can be better.</h2>
            <p className="section-copy narrow">
              Manual tracking is slower than automated syncing, but it can also be cleaner. You
              decide what counts, how often to update it, and which accounts matter to your real
              long-term picture.
            </p>
            <p className="section-copy narrow">
              For a product like Paddock, that trade-off is deliberate. The aim is not to overwhelm
              you with feeds, alerts and financial noise. It is to give you one reliable place to
              review your position with intent.
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
              onClick={() => navigateTo('/track-isas-pensions-savings')}
            >
              <h3>Track ISAs and pensions</h3>
              <div className="line" />
              <p>See core UK wealth accounts together so your progress is easier to understand.</p>
            </button>

            <button
              type="button"
              className="use-link-item"
              onClick={() => navigateTo('/spreadsheet-alternative-net-worth-tracking')}
            >
              <h3>Replace spreadsheets</h3>
              <div className="line" />
              <p>Move from scattered tabs and formulas to a calmer structured workflow.</p>
            </button>

            <button
              type="button"
              className="use-link-item"
              onClick={() => navigateTo('/how-to-track-your-net-worth')}
            >
              <h3>How to track your net worth</h3>
              <div className="line" />
              <p>A practical framework for what to include, how often to update, and what matters.</p>
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
              <h3>Is Paddock a budgeting app?</h3>
              <p>
                No. Paddock is built around wealth tracking rather than day-to-day budgeting. The
                focus is on net worth, long-term progress and a clearer overall financial picture.
              </p>
            </div>

            <div className="faq-card">
              <h3>Do I need to link bank accounts?</h3>
              <p>
                No. This build is manual-entry by design. That keeps the experience simpler, more
                deliberate and more private.
              </p>
            </div>

            <div className="faq-card">
              <h3>Should pensions be included in net worth?</h3>
              <p>
                Many people include pensions because they are a major part of long-term wealth. What
                matters most is staying consistent in how you measure your position over time.
              </p>
            </div>

            <div className="faq-card">
              <h3>How often should I update my numbers?</h3>
              <p>
                Monthly is enough for most people. The goal is not constant checking. It is a steady
                view of how your wealth is changing over time.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="section-border">
        <div className="container final-cta">
          <h2>Track wealth with more clarity.</h2>
          <p className="section-copy center narrow-center">
            Paddock gives you one premium place to review your assets, liabilities and long-term
            direction — without turning wealth tracking into noise.
          </p>

          <div className="hero-actions center">
            <a href="https://app.getpaddock.com/auth?mode=signup" className="btn btn-primary">
              Create account
            </a>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => navigateTo('/')}
            >
              Explore Paddock
            </button>
          </div>
        </div>
      </section>

      <SiteFooter navigateTo={navigateTo} />
    </div>
  )
}
