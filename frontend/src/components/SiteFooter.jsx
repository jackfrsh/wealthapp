import React from 'react'

export default function SiteFooter({ navigateTo }) {
  const handleNav = (path) => (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
    e.preventDefault()
    navigateTo(path)
  }

  return (
    <footer className="landing-footer">
      <div className="landing-footer-inner">
        <button
          type="button"
          onClick={() => navigateTo('/')}
          className="footer-brand"
        >
          Paddock<span>.</span>
        </button>

        <div className="footer-links">
          <button type="button" onClick={() => navigateTo('/guides')}>
            Guides
          </button>
          <button type="button" onClick={() => navigateTo('/terms')}>
            Terms
          </button>
          <button type="button" onClick={() => navigateTo('/privacy')}>
            Privacy
          </button>
          <button type="button" onClick={() => navigateTo('/security')}>
            Security
          </button>
          <span>© 2026</span>
        </div>
      </div>
    </footer>
  )
}
