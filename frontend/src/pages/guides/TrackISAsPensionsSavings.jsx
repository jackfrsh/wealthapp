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
            <div className="hero-kicker">UK wealth tracking</div>

            <h1>
              Track ISAs, pensions and savings.
              <br />
              In one place.
            </h1>

            <p className="hero-sub">
              Bring your core UK wealth accounts into one calm view, so you can see how cash,
              investments and retirement savings are moving together over time.
            </p>

            <div className="hero-actions">
              <a href="https://app.getpaddock.com/auth?mode=signup" className="btn btn-primary">
                Start tracking
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
              <span>ISAs</span>
              <span>Pensions</span>
              <span>Savings accounts</span>
              <span>Manual and private</span>
            </div>
          </div>
        </div>
      </section>

      <section className="container section">
        <SectionLabel>Overview</SectionLabel>
        <h2>UK wealth is often spread across too many places.</h2>
        <p className="section-copy narrow">
          It is common to hold cash in one bank, long-term savings elsewhere, an ISA with one
          provider, and a workplace or personal pension in another portal entirely. Each account
          shows one slice of the picture. Very few show how the whole system is progressing.
        </p>

        <div className="split-columns">
          <div>
            <h3>See core accounts together.</h3>
            <div className="line" />
            <p>
              Keep your main savings, ISA balances and pension values in one structure rather than
              relying on separate provider logins and a rough mental total.
            </p>
          </div>

          <div>
            <h3>Understand the bigger picture.</h3>
            <div className="line" />
            <p>
              The goal is not to stare at isolated balances. It is to understand whether your
              overall wealth is strengthening and whether your long-term plan is moving in the right
              direction.
            </p>
          </div>

          <div>
            <h3>Review with more confidence.</h3>
            <div className="line" />
            <p>
              When pensions, cash and investments sit together, progress becomes easier to read and
              easier to review calmly.
            </p>
          </div>
        </div>
      </section>

      <section className="section-border">
        <div className="container section two-col">
          <div>
            <SectionLabel>Why this matters</SectionLabel>
            <h2>Separate provider views are never the full view.</h2>
            <p className="section-copy narrow">
              Each provider is good at showing its own balance. None of them show how your ISA
              compares with your cash position, how your pension fits into the total, or whether the
              wider picture is compounding in the way you want.
            </p>
            <p className="section-copy narrow">
              That is the gap Paddock is designed to fill. It gives you one calm surface for
              tracking long-term wealth across the accounts that matter most.
            </p>
          </div>

          <div>
            <SectionLabel>Who it is for</SectionLabel>
            <h2>Built for people already saving and investing.</h2>
            <p className="section-copy narrow">
              This is for people who already have momentum, but do not have one clear view across
              all of it. It is especially useful when pensions, cash and investments live across
              multiple providers and the total feels harder to see than it should.
            </p>
            <p className="section-copy narrow">
              It is not about hyperactive account checking. It is about staying oriented around the
              total and reviewing progress with more confidence.
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
              <p>Bring assets and liabilities together in one clear long-term view.</p>
            </button>

            <button
              type="button"
              className="use-link-item"
              onClick={() => navigateTo('/spreadsheet-alternative-net-worth-tracking')}
            >
              <h3>Replace spreadsheets</h3>
              <div className="line" />
              <p>Move from fragile tabs and formulas to a cleaner structured workflow.</p>
            </button>

            <button
              type="button"
              className="use-link-item"
              onClick={() => navigateTo('/how-to-track-your-net-worth')}
            >
              <h3>How to track your net worth</h3>
              <div className="line" />
              <p>Learn what to include, how often to update, and what matters most.</p>
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
              <h3>Can I track multiple ISAs?</h3>
              <p>
                Yes. The point is to build a complete view, not force everything into one account
                type. Multiple ISA balances can all contribute to the same broader wealth picture.
              </p>
            </div>

            <div className="faq-card">
              <h3>Should pensions be included?</h3>
              <p>
                For many people, yes. Pensions are often one of the largest parts of long-term
                wealth, so excluding them can make the total picture less useful.
              </p>
            </div>

            <div className="faq-card">
              <h3>Do I need live account syncing?</h3>
              <p>
                No. Paddock is manual by design. That keeps the workflow cleaner and lets you update
                on a cadence that suits long-term wealth tracking.
              </p>
            </div>

            <div className="faq-card">
              <h3>Is this only for investing?</h3>
              <p>
                No. It is for seeing the broader picture across cash, savings, investments and
                pensions, so you can understand total progress more clearly.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="section-border">
        <div className="container final-cta">
          <h2>See your UK wealth accounts together.</h2>
          <p className="section-copy center narrow-center">
            Bring savings, ISAs and pensions into one premium dashboard and keep your long-term
            direction easier to read.
          </p>

          <div className="hero-actions center">
            <a href="https://app.getpaddock.com/auth?mode=signup" className="btn btn-primary">
              Start tracking
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
