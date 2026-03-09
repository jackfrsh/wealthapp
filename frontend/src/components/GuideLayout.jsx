import React from 'react'
import SiteFooter from './SiteFooter'

function isModifiedEvent(e) {
  return e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0
}

export function H2({ children }) {
  return <h2 className="guide-h2">{children}</h2>
}

export function P({ children }) {
  return <p className="guide-p">{children}</p>
}

export function UL({ children }) {
  return <ul className="guide-ul">{children}</ul>
}

export function Callout({ children }) {
  return (
    <div className="guide-callout">
      <div className="guide-callout-text">{children}</div>
    </div>
  )
}

export function ProTip({ children }) {
  return (
    <div className="guide-protip">
      <div className="guide-protip-label">Pro tip</div>
      <div className="guide-protip-text">{children}</div>
    </div>
  )
}

export function Example({ children }) {
  return (
    <div className="guide-example">
      <div className="guide-example-label">Worked example</div>
      <div className="guide-example-text">{children}</div>
    </div>
  )
}

export function Divider() {
  return <div className="guide-divider" />
}

export function GuideCTA({ children, onClick, buttonText }) {
  return (
    <div className="guide-cta-box">
      <p className="guide-cta-text">{children}</p>
      <button type="button" className="btn btn-primary guide-cta-btn" onClick={onClick}>
        {buttonText || "Get started — it's free"}
      </button>
    </div>
  )
}

export function GuideLink({ to, navigateTo, children, className = '' }) {
  const handleClick = (e) => {
    if (isModifiedEvent(e)) return
    e.preventDefault()
    navigateTo(to)
  }

  return (
    <a href={to} onClick={handleClick} className={`guide-link-card ${className}`.trim()}>
      {children}
    </a>
  )
}

export function GuideShell({
  title,
  onBack,
  navigateTo,
  backLabel,
  children,
}) {
  const resolvedBackLabel =
    backLabel || (title === 'Guides' ? 'Back to Paddock' : 'Back to Guides')

  return (
    <div className="landing-shell">
      <section className="hero-section hero-section-guide">
        <div className="container">
          <div className="guide-page-header">
            <button
              type="button"
              onClick={() => navigateTo('/')}
              className="brand guide-brand"
              aria-label="Go to home"
            >
              Paddock<span>.</span>
            </button>

            <button
              type="button"
              onClick={onBack}
              className="guide-back-link"
              aria-label={resolvedBackLabel}
            >
              ← {resolvedBackLabel}
            </button>
          </div>

          <div className="hero-copy guide-hero-copy">
            <div className="hero-kicker">{title === 'Guides' ? 'Library' : title}</div>
          </div>
        </div>
      </section>

      <section className="container section guide-page-section">
        <article className="guide-article">{children}</article>
      </section>

      <SiteFooter navigateTo={navigateTo} />
    </div>
  )
}
