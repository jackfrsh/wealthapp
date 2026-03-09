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
            <div className="hero-kicker">Spreadsheet alternative</div>

            <h1>
              A cleaner alternative to spreadsheets.
              <br />
              For tracking net worth.
            </h1>

            <p className="hero-sub">
              Keep the control of manual tracking, without relying on scattered tabs, fragile
              formulas and a process that gets harder to maintain as your financial life grows.
            </p>

            <div className="hero-actions">
              <a href="https://app.getpaddock.com/auth?mode=signup" className="btn btn-primary">
                Get started
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
              <span>Still manual</span>
              <span>More structured</span>
              <span>Long-term focused</span>
              <span>Private by design</span>
            </div>
          </div>
        </div>
      </section>

      <section className="container section">
        <SectionLabel>Overview</SectionLabel>
        <h2>Spreadsheets are powerful, until they become maintenance.</h2>
        <p className="section-copy narrow">
          A spreadsheet can be a good starting point. It is flexible, familiar and easy to open.
          But once wealth is spread across multiple account types, currencies or liabilities, the
          sheet often becomes a system you have to maintain rather than a tool that gives you
          clarity.
        </p>

        <div className="split-columns">
          <div>
            <h3>Tabs multiply.</h3>
            <div className="line" />
            <p>
              What starts as a simple workbook often grows into something harder to review at a
              glance, especially once categories, formulas and historic snapshots start to build up.
            </p>
          </div>

          <div>
            <h3>Confidence gets weaker.</h3>
            <div className="line" />
            <p>
              The bigger problem is not the file itself. It is how difficult it becomes to trust the
              structure quickly and stay consistent with updates over time.
            </p>
          </div>

          <div>
            <h3>Review becomes admin.</h3>
            <div className="line" />
            <p>
              The process slowly shifts from understanding your wealth to maintaining the machinery
              around it. That is the point where the tool starts working against the outcome.
            </p>
          </div>
        </div>
      </section>

      <section className="section-border">
        <div className="container section two-col">
          <div>
            <SectionLabel>Why Paddock</SectionLabel>
            <h2>What Paddock does differently.</h2>
            <p className="section-copy narrow">
              Paddock keeps the discipline of manual tracking, but gives it a more structured home.
              Accounts, asset types and liabilities live in a clearer framework rather than a custom
              spreadsheet layout you have to build and maintain yourself.
            </p>
            <p className="section-copy narrow">
              The goal is to make your total wealth obvious, not bury it inside formulas, tabs and
              worksheet logic.
            </p>
          </div>

          <div>
            <SectionLabel>Positioning</SectionLabel>
            <h2>This is not an attack on spreadsheets.</h2>
            <p className="section-copy narrow">
              Many people begin in a spreadsheet, and that makes sense. The question is not whether
              spreadsheets are good or bad. The question is whether they are still the right tool
              once your wealth picture becomes broader, more valuable and more important to review
              consistently.
            </p>
            <p className="section-copy narrow">
              Paddock is for the point where a spreadsheet still works, but no longer feels elegant.
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
              <p>See assets and liabilities together in one premium wealth dashboard.</p>
            </button>

            <button
              type="button"
              className="use-link-item"
              onClick={() => navigateTo('/track-isas-pensions-savings')}
            >
              <h3>Track ISAs and pensions</h3>
              <div className="line" />
              <p>Bring core UK wealth accounts into one clear long-term view.</p>
            </button>

            <button
              type="button"
              className="use-link-item"
              onClick={() => navigateTo('/how-to-track-your-net-worth')}
            >
              <h3>How to track your net worth</h3>
              <div className="line" />
              <p>A practical guide to what to include and what matters most.</p>
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
              <h3>Is Paddock automatic?</h3>
              <p>
                No. It is manual-entry by design. The difference is that the structure and review
                experience are cleaner than maintaining a spreadsheet over time.
              </p>
            </div>

            <div className="faq-card">
              <h3>Why not just keep using a spreadsheet?</h3>
              <p>
                You can. Paddock becomes more useful when your current sheet feels harder to
                maintain, less readable, or too fragmented to support a calm long-term review.
              </p>
            </div>

            <div className="faq-card">
              <h3>Can I still think in categories and accounts?</h3>
              <p>
                Yes. That is part of the point. Paddock keeps the structure without forcing you to
                build and maintain the structure yourself.
              </p>
            </div>

            <div className="faq-card">
              <h3>Is this for budgeting?</h3>
              <p>
                No. It is for wealth tracking. The focus is on total net worth, long-term progress
                and a clearer overall financial position.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="section-border">
        <div className="container final-cta">
          <h2>Move beyond spreadsheet maintenance.</h2>
          <p className="section-copy center narrow-center">
            Keep the control of manual tracking, with a product designed to make wealth easier to
            review and easier to trust.
          </p>

          <div className="hero-actions center">
            <a href="https://app.getpaddock.com/auth?mode=signup" className="btn btn-primary">
              Create account
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
